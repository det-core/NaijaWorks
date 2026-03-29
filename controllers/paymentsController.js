// ============================================================
// NaijaWorks — Payments Controller
// ============================================================

const paystackService = require('../services/paystackService');
const walletService = require('../services/walletService');
const { calculateCommission, nairaToKobo } = require('../utils/commission');
const { db, FieldValue } = require('../firebase/admin');
const config = require('../config/config');

/**
 * POST /api/v1/payments/initialize-job
 * Initialize Paystack transaction for a job contract.
 */
async function initializeJobPayment(req, res) {
  try {
    const { contractId } = req.body;
    const uid = req.user.uid;

    if (!contractId) {
      return res.status(400).json({ success: false, message: 'Contract ID is required' });
    }

    // Load contract
    const contractDoc = await db().collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const contract = contractDoc.data();

    // Verify ownership
    if (contract.clientId !== uid) {
      return res.status(403).json({ success: false, message: 'You are not the client for this contract' });
    }

    // Check payment status
    if (contract.paymentStatus === 'paid' || contract.paymentStatus === 'funded') {
      return res.status(409).json({ success: false, message: 'This contract has already been paid' });
    }

    // Load client profile
    const clientDoc = await db().collection('users').doc(uid).get();
    const client = clientDoc.data();

    const amountNaira = contract.agreedPrice;
    const amountKobo = nairaToKobo(amountNaira);
    const reference = paystackService.generateReference('NW-JOB');

    // Initialize with Paystack
    const paystackResponse = await paystackService.initializeTransaction({
      email: client.email,
      amountKobo,
      reference,
      metadata: {
        contractId,
        clientId: uid,
        workerId: contract.workerId,
        type: 'job_payment',
        custom_fields: [
          { display_name: 'Contract ID', variable_name: 'contract_id', value: contractId },
          { display_name: 'Platform', variable_name: 'platform', value: 'NaijaWorks' },
        ],
      },
    });

    if (!paystackResponse.status) {
      return res.status(502).json({ success: false, message: 'Payment initialization failed' });
    }

    // Save pending payment record
    await paystackService.savePaymentRecord({
      uid,
      relatedType: 'job',
      relatedId: contractId,
      provider: 'paystack',
      amountNaira,
      reference,
      status: 'pending',
    });

    // Update contract with pending reference
    await db().collection('contracts').doc(contractId).update({
      paymentReference: reference,
      paymentStatus: 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data: {
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        reference,
        amountNaira,
      },
    });

  } catch (error) {
    console.error('[Payments/InitializeJob]', error);
    return res.status(500).json({ success: false, message: error.message || 'Payment initialization failed' });
  }
}

/**
 * POST /api/v1/payments/verify
 * Verify payment after Paystack redirect.
 */
async function verifyPayment(req, res) {
  try {
    const { reference } = req.body;
    const uid = req.user.uid;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    // Check for existing verified payment
    const existingPayments = await db().collection('payments')
      .where('reference', '==', reference)
      .where('status', '==', 'success')
      .limit(1).get();

    if (!existingPayments.empty) {
      return res.status(200).json({ success: true, message: 'Payment already verified', alreadyProcessed: true });
    }

    // Verify with Paystack
    const verification = await paystackService.verifyTransaction(reference);

    if (!verification.status || verification.data.status !== 'success') {
      await paystackService.updatePaymentStatus(reference, 'failed');
      return res.status(402).json({ success: false, message: 'Payment was not successful' });
    }

    const metadata = verification.data.metadata;
    const contractId = metadata?.contractId;
    const type = metadata?.type;

    if (type === 'job_payment' && contractId) {
      await handleSuccessfulJobPayment(contractId, reference, verification.data);
    } else if (type === 'vip_subscription') {
      const workerId = metadata?.workerId;
      if (workerId) await handleSuccessfulVIPPayment(workerId, reference, verification.data);
    }

    return res.status(200).json({ success: true, message: 'Payment verified successfully' });

  } catch (error) {
    console.error('[Payments/Verify]', error);
    return res.status(500).json({ success: false, message: error.message || 'Verification failed' });
  }
}

/**
 * Handle successful job payment — fund contract, add escrow.
 */
async function handleSuccessfulJobPayment(contractId, reference, paystackData) {
  const contractDoc = await db().collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) throw new Error('Contract not found during verification');

  const contract = contractDoc.data();
  if (contract.paymentStatus === 'funded') return; // Already handled

  const batch = db().batch();

  // Update contract
  batch.update(db().collection('contracts').doc(contractId), {
    paymentStatus: 'funded',
    contractStatus: 'active',
    fundedAt: FieldValue.serverTimestamp(),
    paymentReference: reference,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Update job status
  if (contract.jobId) {
    batch.update(db().collection('jobs').doc(contract.jobId), {
      status: 'in_progress',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // Add to worker pending balance (escrow)
  await db().runTransaction(async (txn) => {
    const workerWalletRef = db().collection('wallets').doc(contract.workerId);
    const workerWallet = await txn.get(workerWalletRef);

    if (workerWallet.exists) {
      txn.update(workerWalletRef, {
        pendingBalance: FieldValue.increment(contract.agreedPrice),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  // Update payment record
  await paystackService.updatePaymentStatus(reference, 'success');

  // Notify worker
  await db().collection('notifications').add({
    uid: contract.workerId,
    type: 'contract_funded',
    title: '💰 Contract Funded!',
    message: `Your contract has been funded with ₦${contract.agreedPrice.toLocaleString()}. You can now begin work.`,
    relatedId: contractId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Notify client
  await db().collection('notifications').add({
    uid: contract.clientId,
    type: 'payment_success',
    title: '✅ Payment Successful',
    message: `Payment of ₦${contract.agreedPrice.toLocaleString()} confirmed. Work has begun!`,
    relatedId: contractId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Handle successful VIP subscription payment.
 */
async function handleSuccessfulVIPPayment(workerId, reference, paystackData) {
  const vipDurationMs = config.platform.vip.durationDays * 24 * 60 * 60 * 1000;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + vipDurationMs);

  const batch = db().batch();

  batch.update(db().collection('users').doc(workerId), {
    isVIP: true,
    vipPlanType: 'weekly',
    vipStartDate: startDate,
    vipEndDate: endDate,
    commissionRate: config.platform.vipCommissionRate,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  await paystackService.updatePaymentStatus(reference, 'success');

  await db().collection('notifications').add({
    uid: workerId,
    type: 'vip_activated',
    title: '⭐ VIP Activated!',
    message: `Your VIP subscription is now active until ${endDate.toLocaleDateString('en-NG')}. Enjoy 7% commission!`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * POST /api/v1/payments/webhook
 * Paystack webhook handler.
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body; // Raw Buffer from app.js

    if (!paystackService.validateWebhookSignature(rawBody, signature)) {
      console.warn('[Webhook] Invalid signature');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString());
    const { event: eventType, data } = event;

    console.log('[Webhook] Received event:', eventType);

    if (eventType === 'charge.success') {
      const reference = data.reference;
      const metadata = data.metadata;

      if (metadata?.type === 'job_payment' && metadata?.contractId) {
        await handleSuccessfulJobPayment(metadata.contractId, reference, data);
      } else if (metadata?.type === 'vip_subscription' && metadata?.workerId) {
        await handleSuccessfulVIPPayment(metadata.workerId, reference, data);
      }
    }

    if (eventType === 'transfer.success') {
      const reference = data.reference;
      // Mark withdrawal as completed
      const withdrawalSnap = await db().collection('withdrawals')
        .where('paystackTransferReference', '==', reference).limit(1).get();

      if (!withdrawalSnap.empty) {
        await withdrawalSnap.docs[0].ref.update({
          status: 'completed',
          processedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
      const reference = data.reference;
      const withdrawalSnap = await db().collection('withdrawals')
        .where('paystackTransferReference', '==', reference).limit(1).get();

      if (!withdrawalSnap.empty) {
        const withdrawal = withdrawalSnap.docs[0].data();
        await withdrawalSnap.docs[0].ref.update({
          status: 'failed',
          notes: `Transfer ${eventType} by Paystack`,
          processedAt: FieldValue.serverTimestamp(),
        });

        // Refund wallet
        const walletService = require('../services/walletService');
        await walletService.refundWithdrawal(
          withdrawal.uid,
          withdrawalSnap.docs[0].id,
          withdrawal.amount,
          withdrawal.fee
        );

        await db().collection('notifications').add({
          uid: withdrawal.uid,
          type: 'withdrawal_failed',
          title: '⚠️ Withdrawal Failed',
          message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} failed and has been refunded to your wallet.`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return res.status(500).json({ success: false });
  }
}

/**
 * GET /api/v1/payments/banks
 */
async function getBanks(req, res) {
  try {
    const banks = await paystackService.getNigerianBanks();
    return res.status(200).json({ success: true, banks });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch banks' });
  }
}

/**
 * POST /api/v1/payments/verify-account
 */
async function verifyBankAccount(req, res) {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ success: false, message: 'Account number and bank code required' });
    }

    const result = await paystackService.verifyBankAccount(accountNumber, bankCode);
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/v1/payments/history
 */
async function getPaymentHistory(req, res) {
  try {
    const uid = req.user.uid;
    const snapshot = await db().collection('payments')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load payment history' });
  }
}

module.exports = {
  initializeJobPayment,
  verifyPayment,
  handleWebhook,
  getBanks,
  verifyBankAccount,
  getPaymentHistory,
};
