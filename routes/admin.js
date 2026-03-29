const express = require('express');
const router  = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);

router.get('/stats',                    ctrl.getDashboardStats);
router.get('/users',                    ctrl.listUsers);
router.get('/users/:uid',               ctrl.getUser);
router.patch('/users/:uid/status',      ctrl.updateUserStatus);
router.patch('/users/:uid/role',        ctrl.updateUserRole);
router.get('/jobs',                     ctrl.listJobs);
router.patch('/jobs/:id/status',        ctrl.updateJobStatus);
router.get('/payments',                 ctrl.listPayments);
router.get('/wallets',                  ctrl.listWallets);
router.get('/wallets/:uid',             ctrl.getWallet);
router.post('/wallets/:uid/credit',     ctrl.manualCredit);
router.get('/withdrawals',              ctrl.listWithdrawals);
router.patch('/withdrawals/:id/approve',ctrl.approveWithdrawal);
router.patch('/withdrawals/:id/reject', ctrl.rejectWithdrawal);
router.get('/disputes',                 ctrl.listDisputes);
router.patch('/disputes/:id/resolve',   ctrl.resolveDispute);
router.get('/categories',               ctrl.listCategories);
router.post('/categories',              ctrl.createCategory);
router.patch('/categories/:id',         ctrl.updateCategory);
router.get('/settings',                 ctrl.getSettings);
router.put('/settings',                 ctrl.updateSettings);
router.get('/analytics',                ctrl.getAnalytics);

module.exports = router;
