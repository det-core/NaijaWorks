const express = require('express');
const router = express.Router();
const { requireAuth, requireWorker } = require('../middleware/auth');
const ctrl = require('../controllers/withdrawalsController');

router.get('/',        requireAuth, requireWorker, ctrl.listWithdrawals);
router.post('/',       requireAuth, requireWorker, ctrl.requestWithdrawal);
router.get('/:id',     requireAuth, ctrl.getWithdrawal);

module.exports = router;
