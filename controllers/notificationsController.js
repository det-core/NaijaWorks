// NaijaWorks — Notifications Controller
const { db, FieldValue } = require('../firebase/admin');

async function listNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit)||20, 50);
    const snap = await db().collection('notifications')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc').limit(limit).get();
    const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, notifications });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
}

async function markRead(req, res) {
  try {
    const doc = await db().collection('notifications').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    if (doc.data().uid !== req.user.uid) return res.status(403).json({ success: false, message: 'Access denied' });
    await doc.ref.update({ read: true });
    return res.json({ success: true });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function markAllRead(req, res) {
  try {
    const snap = await db().collection('notifications')
      .where('uid', '==', req.user.uid).where('read', '==', false).get();
    const batch = db().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    return res.json({ success: true });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

module.exports = { listNotifications, markRead, markAllRead };
