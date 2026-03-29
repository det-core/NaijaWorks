const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
router.get('/', requireAuth, (req, res) => res.json({ success: true, message: 'Ready' }));
module.exports = router;
