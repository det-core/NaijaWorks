// NaijaWorks — Jobs Controller
const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

async function listJobs(req, res) {
  try {
    const { role, status, limit: lim, page } = req.query;
    const uid = req.user.uid;
    const pageSize = Math.min(parseInt(lim) || 10, 50);

    let query = db().collection('jobs');
    if (role === 'client') query = query.where('clientId', '==', uid);
    else if (role === 'worker') query = query.where('workerId', '==', uid);

    if (status && status !== 'all') query = query.where('status', '==', status);
    query = query.orderBy('createdAt', 'desc').limit(pageSize);

    const snap = await query.get();
    const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Count stats
    let completedCount = 0, totalSpent = 0;
    if (role === 'client') {
      const allSnap = await db().collection('jobs').where('clientId', '==', uid).get();
      allSnap.docs.forEach(d => {
        if (d.data().status === 'completed') {
          completedCount++;
          totalSpent += d.data().agreedPrice || 0;
        }
      });
    }

    return res.json({ success: true, jobs, total: jobs.length, completedCount, totalSpent });
  } catch(e) {
    console.error('[Jobs/List]', e);
    return res.status(500).json({ success: false, message: 'Failed to load jobs' });
  }
}

async function getJob(req, res) {
  try {
    const doc = await db().collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Job not found' });
    const job = { id: doc.id, ...doc.data() };
    // Only client/worker/admin can see job
    if (job.clientId !== req.user.uid && job.workerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true, job });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load job' });
  }
}

async function createJob(req, res) {
  try {
    const uid = req.user.uid;
    const { title, description, category, workMode, budget, duration, location, state, city } = req.body;

    if (!title || !description || !category || !budget) {
      return res.status(400).json({ success: false, message: 'Title, description, category and budget are required' });
    }

    const jobId = uuidv4();
    const job = {
      id: jobId,
      clientId: uid,
      clientName: req.user.fullName,
      workerId: null,
      title: title.trim(),
      description: description.trim(),
      category,
      workMode: workMode || 'physical',
      budget: parseFloat(budget),
      duration: duration || '',
      location: location || '',
      state: state || '',
      city: city || '',
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db().collection('jobs').doc(jobId).set(job);
    await db().collection('users').doc(uid).update({ postedJobsCount: FieldValue.increment(1) });

    return res.status(201).json({ success: true, message: 'Job posted', jobId });
  } catch(e) {
    console.error('[Jobs/Create]', e);
    return res.status(500).json({ success: false, message: 'Failed to create job' });
  }
}

async function updateJob(req, res) {
  try {
    const doc = await db().collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Job not found' });
    if (doc.data().clientId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allowed = ['title','description','budget','duration','location','status'];
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    await db().collection('jobs').doc(req.params.id).update(updates);
    return res.json({ success: true, message: 'Job updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
}

async function deleteJob(req, res) {
  try {
    const doc = await db().collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Job not found' });
    if (doc.data().clientId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (['in_progress','funded'].includes(doc.data().status)) {
      return res.status(400).json({ success: false, message: 'Cannot delete an active job' });
    }

    await db().collection('jobs').doc(req.params.id).update({ status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, message: 'Job cancelled' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Delete failed' });
  }
}

module.exports = { listJobs, getJob, createJob, updateJob, deleteJob };
