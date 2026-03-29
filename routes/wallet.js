const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/walletController');

router.get('/',              requireAuth, ctrl.getWallet);
router.get('/transactions',  requireAuth, ctrl.getTransactions);

module.exports = router;
