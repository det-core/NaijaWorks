// ============================================================
// NaijaWorks — Paystack Payment Service
// ============================================================

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/config');
const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

const PAYSTACK_BASE = config.paystack.baseUrl;
const SECRET_KEY = config.paystack.secretKey;

const paystackHeaders = {
  Authorization: `Bearer ${SECRET_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Initialize a Paystack payment transaction.
 */
async function initializeTransaction({ email, amountKobo, reference, metadata, callbackUrl }) {
  try {
    const response = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
      email,
      amount: amountKobo,
      reference,
      metadata,
      callback_url: callbackUrl || config.paystack.callbackUrl,
    }, { headers: paystackHeaders });

    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Paystack init failed: ${msg}`);
  }
}

/**
 * Verify a Paystack transaction by reference.
 */
async function verifyTransaction(reference) {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: paystackHeaders }
    );
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Paystack verify failed: ${msg}`);
  }
}

/**
 * Validate Paystack webhook signature.
 * Must use raw request body (Buffer).
 */
function validateWebhookSignature(rawBody, signatureHeader) {
  const hash = crypto
    .createHmac('sha512', config.paystack.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return hash === signatureHeader;
}

/**
 * Generate a unique payment reference.
 */
function generateReference(prefix = 'NW') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Save a payment record to Firestore.
 * Prevents duplicate processing by checking reference.
 */
async function savePaymentRecord({ uid, relatedType, relatedId, provider, amountNaira, reference, status }) {
  const paymentId = uuidv4();
  const paymentRef = db().collection('payments').doc(paymentId);

  // Check for duplicate reference
  const existing = await db().collection('payments').where('reference', '==', reference).limit(1).get();
  if (!existing.empty) {
    throw new Error('Duplicate payment reference');
  }

  await paymentRef.set({
    id: paymentId,
    uid,
    relatedType,
    relatedId,
    provider,
    amount: amountNaira,
    currency: 'NGN',
    reference,
    status,
    verifiedAt: status === 'success' ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return paymentId;
}

/**
 * Update payment status (e.g., from webhook).
 */
async function updatePaymentStatus(reference, status) {
  const snapshot = await db().collection('payments').where('reference', '==', reference).limit(1).get();
  if (snapshot.empty) throw new Error('Payment record not found');

  const doc = snapshot.docs[0];
  await doc.ref.update({
    status,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  return { id: doc.id, ...doc.data(), status };
}

/**
 * Initialize Paystack transfer recipient (for withdrawals).
 * Creates a transfer recipient on Paystack for a Nigerian bank account.
 */
async function createTransferRecipient({ accountName, accountNumber, bankCode }) {
  try {
    const response = await axios.post(`${PAYSTACK_BASE}/transferrecipient`, {
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }, { headers: paystackHeaders });

    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Create recipient failed: ${msg}`);
  }
}

/**
 * Initiate transfer to a recipient (for withdrawals).
 */
async function initiateTransfer({ amount, recipientCode, reference, reason }) {
  try {
    const response = await axios.post(`${PAYSTACK_BASE}/transfer`, {
      source: 'balance',
      amount, // in kobo
      recipient: recipientCode,
      reference,
      reason: reason || 'NaijaWorks Withdrawal',
    }, { headers: paystackHeaders });

    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Transfer failed: ${msg}`);
  }
}

/**
 * Get list of Nigerian banks from Paystack.
 */
async function getNigerianBanks() {
  try {
    const response = await axios.get(`${PAYSTACK_BASE}/bank?country=nigeria&per_page=100`, {
      headers: paystackHeaders,
    });
    return response.data.data || [];
  } catch (error) {
    console.error('[Paystack] Failed to fetch banks:', error.message);
    return [];
  }
}

/**
 * Verify a bank account number with Paystack.
 */
async function verifyBankAccount(accountNumber, bankCode) {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: paystackHeaders }
    );
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Account verification failed: ${msg}`);
  }
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  validateWebhookSignature,
  generateReference,
  savePaymentRecord,
  updatePaymentStatus,
  createTransferRecipient,
  initiateTransfer,
  getNigerianBanks,
  verifyBankAccount,
};
