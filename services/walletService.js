// ============================================================
// NaijaWorks — Wallet Service
// All wallet operations use Firestore transactions for safety.
// ============================================================

const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

const walletsCol = () => db().collection('wallets');
const txCol = () => db().collection('walletTransactions');

/**
 * Initialize wallet for a new user (called on signup).
 */
async function initializeWallet(uid) {
  const walletRef = walletsCol().doc(uid);
  const existing = await walletRef.get();
  if (existing.exists) return;

  await walletRef.set({
    uid,
    availableBalance: 0,
    pendingBalance: 0,
    lockedBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    totalCommissionPaid: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Get wallet for a user.
 */
async function getWallet(uid) {
  const doc = await walletsCol().doc(uid).get();
  if (!doc.exists) {
    await initializeWallet(uid);
    return (await walletsCol().doc(uid).get()).data();
  }
  return doc.data();
}

/**
 * Credit worker wallet after job completion.
 * Deducts commission, credits net amount.
 */
async function creditWorkerOnCompletion(contractId, workerId, agreedPrice, commissionRate) {
  const commissionAmount = Math.round(agreedPrice * commissionRate);
  const netAmount = agreedPrice - commissionAmount;
  const txId = uuidv4();

  await db().runTransaction(async (transaction) => {
    const walletRef = walletsCol().doc(workerId);
    const walletDoc = await transaction.get(walletRef);

    if (!walletDoc.exists) throw new Error('Wallet not found for worker');

    const wallet = walletDoc.data();
    const balanceBefore = wallet.availableBalance;
    const balanceAfter = balanceBefore + netAmount;

    transaction.update(walletRef, {
      availableBalance: FieldValue.increment(netAmount),
      pendingBalance: FieldValue.increment(-agreedPrice), // move from pending
      totalEarned: FieldValue.increment(netAmount),
      totalCommissionPaid: FieldValue.increment(commissionAmount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txCol().doc(txId), {
      id: txId,
      uid: workerId,
      type: 'job_credit',
      amount: netAmount,
      fee: commissionAmount,
      balanceBefore,
      balanceAfter,
      relatedId: contractId,
      note: `Job completed. Commission: ₦${commissionAmount.toLocaleString()} (${Math.round(commissionRate * 100)}%)`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { netAmount, commissionAmount };
}

/**
 * Lock funds in client wallet (or log payment) when contract is funded.
 * In practice, the client pays directly via Paystack → server confirms.
 * This records the locked state for accounting.
 */
async function lockFundsForContract(clientId, contractId, amount) {
  const txId = uuidv4();

  await db().runTransaction(async (transaction) => {
    const walletRef = walletsCol().doc(clientId);
    const walletDoc = await transaction.get(walletRef);

    if (!walletDoc.exists) throw new Error('Wallet not found');

    const wallet = walletDoc.data();
    const balanceBefore = wallet.lockedBalance;

    transaction.update(walletRef, {
      lockedBalance: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txCol().doc(txId), {
      id: txId,
      uid: clientId,
      type: 'contract_lock',
      amount,
      fee: 0,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      relatedId: contractId,
      note: 'Funds locked for contract',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Move worker earnings from pending to available (escrow release).
 */
async function movePendingToAvailable(workerId, contractId, amount) {
  const txId = uuidv4();

  await db().runTransaction(async (transaction) => {
    const walletRef = walletsCol().doc(workerId);
    const walletDoc = await transaction.get(walletRef);
    const wallet = walletDoc.data();

    transaction.update(walletRef, {
      pendingBalance: FieldValue.increment(-amount),
      availableBalance: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txCol().doc(txId), {
      id: txId,
      uid: workerId,
      type: 'escrow_release',
      amount,
      fee: 0,
      balanceBefore: wallet.pendingBalance,
      balanceAfter: wallet.pendingBalance - amount,
      relatedId: contractId,
      note: 'Escrow released to available',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Process a withdrawal request. Deducts from available balance.
 */
async function processWithdrawalDeduction(uid, withdrawalId, amountNaira, feeNaira) {
  const totalDeduction = amountNaira; // gross amount includes fee

  await db().runTransaction(async (transaction) => {
    const walletRef = walletsCol().doc(uid);
    const walletDoc = await transaction.get(walletRef);

    if (!walletDoc.exists) throw new Error('Wallet not found');

    const wallet = walletDoc.data();
    if (wallet.availableBalance < totalDeduction) {
      throw new Error('Insufficient balance for withdrawal');
    }

    const txId = uuidv4();
    const balanceBefore = wallet.availableBalance;

    transaction.update(walletRef, {
      availableBalance: FieldValue.increment(-totalDeduction),
      totalWithdrawn: FieldValue.increment(amountNaira - feeNaira),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txCol().doc(txId), {
      id: txId,
      uid,
      type: 'withdrawal',
      amount: amountNaira,
      fee: feeNaira,
      balanceBefore,
      balanceAfter: balanceBefore - totalDeduction,
      relatedId: withdrawalId,
      note: `Withdrawal request. Fee: ₦${feeNaira}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Refund a withdrawal (if rejected by admin).
 */
async function refundWithdrawal(uid, withdrawalId, amountNaira, feeNaira) {
  const refundAmount = amountNaira;
  const txId = uuidv4();

  await db().runTransaction(async (transaction) => {
    const walletRef = walletsCol().doc(uid);
    const walletDoc = await transaction.get(walletRef);
    const wallet = walletDoc.data();

    transaction.update(walletRef, {
      availableBalance: FieldValue.increment(refundAmount),
      totalWithdrawn: FieldValue.increment(-(amountNaira - feeNaira)),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(txCol().doc(txId), {
      id: txId,
      uid,
      type: 'withdrawal_refund',
      amount: refundAmount,
      fee: 0,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance + refundAmount,
      relatedId: withdrawalId,
      note: 'Withdrawal rejected — funds returned to wallet',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Get transaction history for a user.
 */
async function getTransactionHistory(uid, limit = 20) {
  const snapshot = await txCol()
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  initializeWallet,
  getWallet,
  creditWorkerOnCompletion,
  lockFundsForContract,
  movePendingToAvailable,
  processWithdrawalDeduction,
  refundWithdrawal,
  getTransactionHistory,
};
