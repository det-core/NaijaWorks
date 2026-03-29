// ============================================================
// NaijaWorks — Wallet Controller
// ============================================================
const walletService = require('../services/walletService');

async function getWallet(req, res) {
  try {
    const wallet = await walletService.getWallet(req.user.uid);
    return res.json({ success: true, wallet });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load wallet' });
  }
}

async function getTransactions(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const transactions = await walletService.getTransactionHistory(req.user.uid, limit);
    return res.json({ success: true, transactions });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load transactions' });
  }
}

module.exports = { getWallet, getTransactions };
