// NaijaWorks — Withdrawals Controller
const { db, FieldValue } = require('../firebase/admin');
const walletService = require('../services/walletService');
const { validateWithdrawalAmount } = require('../utils/commission');
const { v4: uuidv4 } = require('uuid');

async function listWithdrawals(req, res) {
  try {
    const snap = await db().collection('withdrawals')
      .where('uid', '==', req.user.uid)
      .orderBy('requestedAt', 'desc').limit(20).get();
    const withdrawals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, withdrawals });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load withdrawals' });
  }
}

async function requestWithdrawal(req, res) {
  try {
    const uid = req.user.uid;
    const { amount, bankName, accountName, accountNumber, bankCode } = req.body;
    const amountNaira = parseFloat(amount);

    if (!amountNaira || !bankName || !accountName || !accountNumber) {
      return res.status(400).json({ success: false, message: 'All withdrawal fields are required' });
    }

    const validation = validateWithdrawalAmount(amountNaira);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });

    // Check wallet balance
    const wallet = await walletService.getWallet(uid);
    if (wallet.availableBalance < amountNaira) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Check no pending withdrawal
    const pendingSnap = await db().collection('withdrawals')
      .where('uid', '==', uid).where('status', '==', 'pending').limit(1).get();
    if (!pendingSnap.empty) {
      return res.status(400).json({ success: false, message: 'You already have a pending withdrawal. Please wait for it to complete.' });
    }

    const feeNaira = validation.fee.feeNaira;
    const netAmount = amountNaira - feeNaira;
    const withdrawalId = uuidv4();

    // Deduct from wallet
    await walletService.processWithdrawalDeduction(uid, withdrawalId, amountNaira, feeNaira);

    // Create withdrawal record
    await db().collection('withdrawals').doc(withdrawalId).set({
      id: withdrawalId,
      uid,
      amount: amountNaira,
      fee: feeNaira,
      netAmount,
      bankName,
      accountName,
      accountNumber,
      bankCode: bankCode || '',
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
      processedAt: null,
      notes: '',
    });

    // Notify user
    await db().collection('notifications').add({
      uid,
      type: 'withdrawal_requested',
      title: '🏦 Withdrawal Requested',
      message: `₦${netAmount.toLocaleString()} withdrawal submitted (fee: ₦${feeNaira}). Processing in 24–48 hours.`,
      relatedId: withdrawalId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true, message: 'Withdrawal request submitted', withdrawalId, netAmount, feeNaira });
  } catch(e) {
    console.error('[Withdrawals/Request]', e);
    return res.status(500).json({ success: false, message: e.message || 'Withdrawal failed' });
  }
}

async function getWithdrawal(req, res) {
  try {
    const doc = await db().collection('withdrawals').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    const withdrawal = { id: doc.id, ...doc.data() };
    if (withdrawal.uid !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true, withdrawal });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load withdrawal' });
  }
}

module.exports = { listWithdrawals, requestWithdrawal, getWithdrawal };
