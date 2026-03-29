const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { db, FieldValue } = require('../firebase/admin');

router.get('/me', requireAuth, async (req, res) => {
  try {
    const doc = await db().collection('users').doc(req.user.uid).get();
    return res.json({ success: true, user: doc.data() });
  } catch(e) { return res.status(500).json({ success: false, message: 'Failed' }); }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['firstName','lastName','phone','whatsappNumber','telegramUsername','bio','state','city','lga','area','companyName','preferredCategories'];
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.firstName && updates.lastName) updates.fullName = `${updates.firstName} ${updates.lastName}`;
    await db().collection('users').doc(req.user.uid).update(updates);
    return res.json({ success: true, message: 'Profile updated' });
  } catch(e) { return res.status(500).json({ success: false, message: 'Failed' }); }
});

module.exports = router;
