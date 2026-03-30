const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

router.get('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const snap = await db().collection('disputes')
      .where(req.query.role === 'worker' ? 'workerId' : 'clientId', '==', uid)
      .orderBy('createdAt','desc').limit(20).get();
    const disputes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, disputes });
  } catch(e) { return res.status(500).json({ success: false, message: 'Failed to load disputes' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db().collection('disputes').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    const d = doc.data();
    if (d.clientId !== req.user.uid && d.workerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true, dispute: { id: doc.id, ...d } });
  } catch(e) { return res.status(500).json({ success: false, message: 'Failed' }); }
});

module.exports = router;
