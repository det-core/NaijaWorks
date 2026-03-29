// ============================================================
// NaijaWorks — Auth Routes
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMaxRequests,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// POST /api/v1/auth/register
// Called after Firebase client-side sign-up to create Firestore profile
router.post('/register', authLimiter, authController.register);

// POST /api/v1/auth/login
// Updates lastLoginAt timestamp
router.post('/login', authLimiter, authController.login);

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, authController.logout);

// GET /api/v1/auth/me
// Returns current user profile
router.get('/me', requireAuth, authController.getMe);

// POST /api/v1/auth/verify-token
// Lightweight token validation check
router.post('/verify-token', authController.verifyToken);

module.exports = router;
