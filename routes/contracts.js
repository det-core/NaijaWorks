const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/contractsController');

router.get('/',               requireAuth, ctrl.listContracts);
router.get('/:id',            requireAuth, ctrl.getContract);
router.post('/',              requireAuth, ctrl.createContract);
router.patch('/:id/mark-done',requireAuth, ctrl.markWorkDone);
router.patch('/:id/complete', requireAuth, ctrl.completeContract);
router.patch('/:id/dispute',  requireAuth, ctrl.raiseDispute);

module.exports = router;
