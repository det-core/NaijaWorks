// ============================================================
// NaijaWorks — Payment Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const paymentsController = require('../controllers/paymentsController');

// POST /api/v1/payments/initialize-job
// Client pays for a job/contract via Paystack
router.post('/initialize-job', requireAuth, paymentsController.initializeJobPayment);

// POST /api/v1/payments/verify
// Verify a payment reference after redirect
router.post('/verify', requireAuth, paymentsController.verifyPayment);

// POST /api/v1/payments/webhook
// Paystack webhook — raw body required (set in app.js)
router.post('/webhook', paymentsController.handleWebhook);

// GET /api/v1/payments/banks
// List Nigerian banks from Paystack
router.get('/banks', requireAuth, paymentsController.getBanks);

// POST /api/v1/payments/verify-account
// Verify a bank account number
router.post('/verify-account', requireAuth, paymentsController.verifyBankAccount);

// GET /api/v1/payments/history
// Get payment history for current user
router.get('/history', requireAuth, paymentsController.getPaymentHistory);

module.exports = router;
