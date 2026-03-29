// ============================================================
// NaijaWorks — Reviews Controller
// ============================================================
const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

async function listReviews(req, res) {
  try {
    const { workerId, limit: lim } = req.query;
    let query = db().collection('reviews');
    if (workerId) query = query.where('toUserId', '==', workerId);
    query = query.orderBy('createdAt', 'desc').limit(Math.min(parseInt(lim)||10, 50));
    const snap = await query.get();
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, reviews });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
}

async function createReview(req, res) {
  try {
    const uid = req.user.uid;
    const { contractId, toUserId, rating, reviewText } = req.body;

    if (!contractId || !toUserId || !rating) {
      return res.status(400).json({ success: false, message: 'Contract, recipient and rating required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
    }

    // Verify contract
    const contractDoc = await db().collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) return res.status(404).json({ success: false, message: 'Contract not found' });
    const contract = contractDoc.data();

    if (contract.contractStatus !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed contracts' });
    }
    if (contract.clientId !== uid && contract.workerId !== uid) {
      return res.status(403).json({ success: false, message: 'Not a party to this contract' });
    }

    // Check duplicate
    const existing = await db().collection('reviews')
      .where('contractId', '==', contractId).where('fromUserId', '==', uid).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'You already reviewed this contract' });
    }

    const reviewId = uuidv4();
    const fromDoc = await db().collection('users').doc(uid).get();

    await db().collection('reviews').doc(reviewId).set({
      id: reviewId,
      contractId,
      fromUserId: uid,
      fromUserName: fromDoc.data()?.fullName || 'User',
      toUserId,
      rating: parseInt(rating),
      reviewText: (reviewText || '').trim(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update worker rating average
    const allReviews = await db().collection('reviews').where('toUserId', '==', toUserId).get();
    const ratings = allReviews.docs.map(d => d.data().rating);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    await db().collection('users').doc(toUserId).update({
      ratingAverage: parseFloat(avg.toFixed(2)),
      ratingCount: ratings.length,
    });

    return res.status(201).json({ success: true, message: 'Review submitted', reviewId });
  } catch(e) {
    console.error('[Reviews/Create]', e);
    return res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
}

module.exports = { listReviews, createReview };


// ============================================================
// NaijaWorks — Notifications Controller
// ============================================================
const { db: db2, FieldValue: FV2 } = require('../firebase/admin');

async function listNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit)||20, 50);
    const snap = await db2().collection('notifications')
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
    const doc = await db2().collection('notifications').doc(req.params.id).get();
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
    const snap = await db2().collection('notifications')
      .where('uid', '==', req.user.uid).where('read', '==', false).get();
    const batch = db2().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    return res.json({ success: true });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// Export notifications separately since they're in the same file
// The routes import from notificationsController.js
if (require.main !== module) {
  // This file exports both — notifications controller is below
}

// Attach notifications exports for the notifications route
module.exports.listNotifications = listNotifications;
module.exports.markRead = markRead;
module.exports.markAllRead = markAllRead;
