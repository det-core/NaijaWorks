const express = require('express');
const router = express.Router();
const { requireAuth, requireWorker } = require('../middleware/auth');
const ctrl = require('../controllers/vipController');

router.post('/subscribe', requireAuth, requireWorker, ctrl.initVIPPayment);
router.get('/status',     requireAuth, ctrl.getVIPStatus);

module.exports = router;
