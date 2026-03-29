// NaijaWorks — Workers Controller
const { db, FieldValue } = require('../firebase/admin');

async function listWorkers(req, res) {
  try {
    const { q, type, category, state, minPrice, maxPrice, minRating, vipOnly, sort, page, limit, featured } = req.query;
    const pageSize = Math.min(parseInt(limit) || 12, 50);
    const pageNum  = parseInt(page) || 1;

    let query = db().collection('users').where('role', '==', 'worker').where('accountStatus', '==', 'active').where('profilePublished', '==', true);

    if (type && type !== 'all') {
      if (type === 'remote')   query = query.where('remoteAvailable', '==', true);
    }
    if (state) query = query.where('state', '==', state);
    if (vipOnly === 'true') query = query.where('isVIP', '==', true);

    // Sort
    if (sort === 'vip') query = query.orderBy('isVIP', 'desc').orderBy('ratingAverage', 'desc');
    else if (sort === 'price_asc')  query = query.orderBy('basePrice', 'asc');
    else if (sort === 'price_desc') query = query.orderBy('basePrice', 'desc');
    else if (sort === 'newest')     query = query.orderBy('createdAt', 'desc');
    else query = query.orderBy('ratingAverage', 'desc');

    const snapshot = await query.limit(pageSize * pageNum).get();
    let workers = snapshot.docs.map(d => {
      const data = d.data();
      // Strip sensitive fields
      delete data.commissionRate; delete data.vipStartDate;
      return data;
    });

    // Client-side filters
    if (q) {
      const ql = q.toLowerCase();
      workers = workers.filter(w =>
        w.fullName?.toLowerCase().includes(ql) ||
        w.title?.toLowerCase().includes(ql) ||
        w.bio?.toLowerCase().includes(ql) ||
        w.skills?.some(s => s.toLowerCase().includes(ql)) ||
        w.serviceCategories?.some(c => c.toLowerCase().includes(ql))
      );
    }
    if (category) workers = workers.filter(w => w.serviceCategories?.includes(category));
    if (minPrice) workers = workers.filter(w => (w.basePrice || 0) >= parseFloat(minPrice));
    if (maxPrice) workers = workers.filter(w => (w.basePrice || 0) <= parseFloat(maxPrice));
    if (minRating) workers = workers.filter(w => (w.ratingAverage || 0) >= parseFloat(minRating));

    const total = workers.length;
    const offset = (pageNum - 1) * pageSize;
    workers = workers.slice(offset, offset + pageSize);

    return res.json({ success: true, workers, total, page: pageNum, pageSize });
  } catch(e) {
    console.error('[Workers/List]', e);
    return res.status(500).json({ success: false, message: 'Failed to load workers' });
  }
}

async function getWorkerProfile(req, res) {
  try {
    const { uid } = req.params;
    const userDoc = await db().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'worker') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }
    const worker = userDoc.data();
    // Remove server-only fields
    delete worker.commissionRate;
    return res.json({ success: true, worker });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
}

async function updateWorkerProfile(req, res) {
  try {
    const uid = req.user.uid;
    const allowed = ['title','bio','skills','serviceCategories','pricingModel','basePrice','minimumAcceptablePrice',
      'hourlyRate','dailyRate','weeklyRate','monthlyRate','fixedProjectPrice','yearsOfExperience',
      'availability','remoteAvailable','canTravel','phone','whatsappNumber','city','state','lga','area'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updatedAt = FieldValue.serverTimestamp();

    await db().collection('users').doc(uid).update(updates);
    return res.json({ success: true, message: 'Profile updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
}

async function publishProfile(req, res) {
  try {
    const uid = req.user.uid;
    const userDoc = await db().collection('users').doc(uid).get();
    const user = userDoc.data();
    if (!user.title || !user.bio || !user.serviceCategories?.length) {
      return res.status(400).json({ success: false, message: 'Complete your profile (title, bio, categories) before publishing.' });
    }
    await db().collection('users').doc(uid).update({ profilePublished: true, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, message: 'Profile is now live!' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Publish failed' });
  }
}

module.exports = { listWorkers, getWorkerProfile, updateWorkerProfile, publishProfile };
