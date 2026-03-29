const express = require('express');
const router = express.Router();
const { requireAuth, requireClient } = require('../middleware/auth');
const ctrl = require('../controllers/jobsController');

router.get('/',      requireAuth, ctrl.listJobs);
router.get('/:id',   requireAuth, ctrl.getJob);
router.post('/',     requireAuth, requireClient, ctrl.createJob);
router.patch('/:id', requireAuth, ctrl.updateJob);
router.delete('/:id',requireAuth, ctrl.deleteJob);

module.exports = router;
