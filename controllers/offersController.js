// NaijaWorks — Offers Controller (Negotiation Flow)
const { db, FieldValue } = require('../firebase/admin');
const { v4: uuidv4 } = require('uuid');

async function listOffers(req, res) {
  try {
    const uid = req.user.uid;
    const { role, status, limit: lim } = req.query;
    const pageSize = Math.min(parseInt(lim) || 20, 50);

    let query = db().collection('offers');
    if (role === 'worker') query = query.where('workerId', '==', uid);
    else query = query.where('clientId', '==', uid);

    if (status && status !== 'all') query = query.where('status', '==', status);
    query = query.orderBy('createdAt', 'desc').limit(pageSize);

    const snap = await query.get();
    const offers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total  = await db().collection('offers').where(
      role === 'worker' ? 'workerId' : 'clientId', '==', uid
    ).where('status', '==', status || 'pending').get().then(s => s.size);

    return res.json({ success: true, offers, total });
  } catch(e) {
    console.error('[Offers/List]', e);
    return res.status(500).json({ success: false, message: 'Failed to load offers' });
  }
}

async function getOffer(req, res) {
  try {
    const doc = await db().collection('offers').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Offer not found' });
    const offer = { id: doc.id, ...doc.data() };
    if (offer.clientId !== req.user.uid && offer.workerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true, offer });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load offer' });
  }
}

async function createOffer(req, res) {
  try {
    const uid = req.user.uid;
    const { workerId, jobId, jobTitle, jobDescription, offeredPrice, workMode, duration, location } = req.body;

    if (!workerId || !offeredPrice || !jobTitle || !jobDescription) {
      return res.status(400).json({ success: false, message: 'Worker, job title, description and price are required' });
    }
    if (uid === workerId) {
      return res.status(400).json({ success: false, message: 'You cannot make an offer to yourself' });
    }

    // Check worker exists
    const workerDoc = await db().collection('users').doc(workerId).get();
    if (!workerDoc.exists || workerDoc.data().role !== 'worker') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }
    const worker = workerDoc.data();

    // Check minimum price
    if (worker.minimumAcceptablePrice && parseFloat(offeredPrice) < worker.minimumAcceptablePrice) {
      return res.status(400).json({
        success: false,
        message: `Minimum price for this worker is ₦${worker.minimumAcceptablePrice.toLocaleString()}`
      });
    }

    // Load client name
    const clientDoc = await db().collection('users').doc(uid).get();
    const client = clientDoc.data();

    const offerId = uuidv4();
    const offer = {
      id: offerId,
      clientId: uid,
      clientName: client.fullName,
      workerId,
      workerName: worker.fullName,
      jobId: jobId || null,
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim(),
      listedPrice: worker.basePrice || 0,
      offeredPrice: parseFloat(offeredPrice),
      minimumAcceptablePrice: worker.minimumAcceptablePrice || 0,
      counterPrice: null,
      workMode: workMode || 'physical',
      duration: duration || '',
      location: location || '',
      status: 'pending',
      negotiationHistory: [{
        action: 'offer_created',
        by: uid,
        price: parseFloat(offeredPrice),
        timestamp: new Date().toISOString(),
      }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db().collection('offers').doc(offerId).set(offer);

    // Notify worker
    await db().collection('notifications').add({
      uid: workerId,
      type: 'new_offer',
      title: '🤝 New Offer Received!',
      message: `${client.fullName} made an offer of ₦${parseFloat(offeredPrice).toLocaleString()} for "${jobTitle}"`,
      relatedId: offerId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true, message: 'Offer sent', offerId });
  } catch(e) {
    console.error('[Offers/Create]', e);
    return res.status(500).json({ success: false, message: 'Failed to send offer' });
  }
}

async function acceptOffer(req, res) {
  try {
    const uid = req.user.uid;
    const offerDoc = await db().collection('offers').doc(req.params.id).get();
    if (!offerDoc.exists) return res.status(404).json({ success: false, message: 'Offer not found' });

    const offer = offerDoc.data();
    if (offer.workerId !== uid) return res.status(403).json({ success: false, message: 'Only the worker can accept this offer' });
    if (offer.status !== 'pending' && offer.status !== 'countered') {
      return res.status(400).json({ success: false, message: `Cannot accept an offer in status: ${offer.status}` });
    }

    const agreedPrice = offer.counterPrice || offer.offeredPrice;

    // Create contract
    const { getCommissionRate, calculateCommission } = require('../utils/commission');
    const workerDoc = await db().collection('users').doc(uid).get();
    const worker = workerDoc.data();
    const commRate = getCommissionRate(worker.isVIP, worker.vipEndDate);
    const commission = calculateCommission(agreedPrice, commRate);

    const contractId = uuidv4();
    const batch = db().batch();

    batch.set(db().collection('contracts').doc(contractId), {
      id: contractId,
      clientId: offer.clientId,
      clientName: offer.clientName,
      workerId: uid,
      workerName: worker.fullName,
      jobId: offer.jobId,
      jobTitle: offer.jobTitle,
      jobDescription: offer.jobDescription,
      agreedPrice,
      commissionRateAtCreation: commRate,
      platformCommissionAmount: commission.platformCommissionAmount,
      workerNetAmount: commission.workerNetAmount,
      workMode: offer.workMode,
      duration: offer.duration,
      location: offer.location,
      paymentStatus: 'unpaid',
      contractStatus: 'awaiting_payment',
      offerId: req.params.id,
      fundedAt: null,
      workDoneAt: null,
      completedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(db().collection('offers').doc(req.params.id), {
      status: 'accepted',
      contractId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Notify client
    await db().collection('notifications').add({
      uid: offer.clientId,
      type: 'offer_accepted',
      title: '✅ Offer Accepted!',
      message: `${worker.fullName} accepted your offer of ₦${agreedPrice.toLocaleString()}. Please fund the contract to begin work.`,
      relatedId: contractId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Offer accepted. Contract created.', contractId });
  } catch(e) {
    console.error('[Offers/Accept]', e);
    return res.status(500).json({ success: false, message: 'Failed to accept offer' });
  }
}

async function declineOffer(req, res) {
  try {
    const uid = req.user.uid;
    const offerDoc = await db().collection('offers').doc(req.params.id).get();
    if (!offerDoc.exists) return res.status(404).json({ success: false, message: 'Offer not found' });

    const offer = offerDoc.data();
    if (offer.workerId !== uid && offer.clientId !== uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db().collection('offers').doc(req.params.id).update({
      status: 'declined',
      updatedAt: FieldValue.serverTimestamp(),
    });

    const notifyUid = uid === offer.workerId ? offer.clientId : offer.workerId;
    await db().collection('notifications').add({
      uid: notifyUid,
      type: 'offer_declined',
      title: '❌ Offer Declined',
      message: `Your offer for "${offer.jobTitle}" was declined.`,
      relatedId: req.params.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Offer declined' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to decline offer' });
  }
}

async function counterOffer(req, res) {
  try {
    const uid = req.user.uid;
    const { counterPrice, message } = req.body;
    if (!counterPrice || parseFloat(counterPrice) < 100) {
      return res.status(400).json({ success: false, message: 'Valid counter price required' });
    }

    const offerDoc = await db().collection('offers').doc(req.params.id).get();
    if (!offerDoc.exists) return res.status(404).json({ success: false, message: 'Offer not found' });

    const offer = offerDoc.data();
    if (offer.workerId !== uid && offer.clientId !== uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const price = parseFloat(counterPrice);
    const history = offer.negotiationHistory || [];
    history.push({ action: 'counter_offer', by: uid, price, message: message || '', timestamp: new Date().toISOString() });

    await db().collection('offers').doc(req.params.id).update({
      counterPrice: price,
      status: 'countered',
      negotiationHistory: history,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const notifyUid = uid === offer.workerId ? offer.clientId : offer.workerId;
    const notifyDoc = await db().collection('users').doc(uid).get();

    await db().collection('notifications').add({
      uid: notifyUid,
      type: 'counter_offer',
      title: '↩️ Counter Offer Received',
      message: `${notifyDoc.data()?.fullName} countered with ₦${price.toLocaleString()} for "${offer.jobTitle}"`,
      relatedId: req.params.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Counter offer sent' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Counter offer failed' });
  }
}

module.exports = { listOffers, getOffer, createOffer, acceptOffer, declineOffer, counterOffer };
