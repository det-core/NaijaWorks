const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationsController');

router.get('/',                     requireAuth, ctrl.listNotifications);
router.patch('/:id/read',           requireAuth, ctrl.markRead);
router.patch('/mark-all-read',      requireAuth, ctrl.markAllRead);

module.exports = router;
