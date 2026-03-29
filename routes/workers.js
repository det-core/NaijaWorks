const express = require('express');
const router = express.Router();
const { requireAuth, requireWorker } = require('../middleware/auth');
const ctrl = require('../controllers/workersController');

router.get('/',            ctrl.listWorkers);
router.get('/:uid',        ctrl.getWorkerProfile);
router.put('/me',          requireAuth, requireWorker, ctrl.updateWorkerProfile);
router.post('/me/publish', requireAuth, requireWorker, ctrl.publishProfile);

module.exports = router;
