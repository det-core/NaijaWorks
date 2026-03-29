// NaijaWorks — Contracts Controller
const { db, FieldValue } = require('../firebase/admin');
const walletService = require('../services/walletService');
const { v4: uuidv4 } = require('uuid');

async function listContracts(req, res) {
  try {
    const uid = req.user.uid;
    const { role, status, limit: lim } = req.query;
    const pageSize = Math.min(parseInt(lim) || 10, 50);

    let query = db().collection('contracts');
    if (role === 'worker') query = query.where('workerId', '==', uid);
    else query = query.where('clientId', '==', uid);

    if (status && status !== 'all') query = query.where('contractStatus', '==', status);
    query = query.orderBy('createdAt', 'desc').limit(pageSize);

    const snap = await query.get();
    const contracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total = contracts.length;

    return res.json({ success: true, contracts, total });
  } catch(e) {
    console.error('[Contracts/List]', e);
    return res.status(500).json({ success: false, message: 'Failed to load contracts' });
  }
}

async function getContract(req, res) {
  try {
    const doc = await db().collection('contracts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Contract not found' });
    const contract = { id: doc.id, ...doc.data() };

    if (contract.clientId !== req.user.uid && contract.workerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // If funded, reveal contact info
    let contactInfo = null;
    if (contract.paymentStatus === 'funded' &&
        (contract.clientId === req.user.uid || contract.workerId === req.user.uid)) {
      const otherUid = req.user.uid === contract.clientId ? contract.workerId : contract.clientId;
      const otherDoc = await db().collection('users').doc(otherUid).get();
      const other = otherDoc.data();
      contactInfo = {
        phone: other.phone,
        whatsappNumber: other.whatsappNumber,
        email: other.email,
        telegramUsername: other.telegramUsername,
      };
    }

    return res.json({ success: true, contract, contactInfo });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load contract' });
  }
}

async function createContract(req, res) {
  // Contracts are auto-created when an offer is accepted
  // This endpoint handles direct contract creation if needed
  return res.status(400).json({ success: false, message: 'Contracts are created via offer acceptance' });
}

async function markWorkDone(req, res) {
  try {
    const uid = req.user.uid;
    const doc = await db().collection('contracts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Contract not found' });

    const contract = doc.data();
    if (contract.workerId !== uid) return res.status(403).json({ success: false, message: 'Only the worker can mark work done' });
    if (contract.contractStatus !== 'active') {
      return res.status(400).json({ success: false, message: 'Contract must be active to mark done' });
    }

    await db().collection('contracts').doc(req.params.id).update({
      contractStatus: 'work_done',
      workDoneAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notify client
    await db().collection('notifications').add({
      uid: contract.clientId,
      type: 'work_done',
      title: '🎉 Work Completed!',
      message: `${contract.workerName} has marked the work as done for "${contract.jobTitle}". Please review and confirm to release payment.`,
      relatedId: req.params.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Work marked as done. Awaiting client confirmation.' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to mark work done' });
  }
}

async function completeContract(req, res) {
  try {
    const uid = req.user.uid;
    const doc = await db().collection('contracts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Contract not found' });

    const contract = doc.data();
    if (contract.clientId !== uid) return res.status(403).json({ success: false, message: 'Only the client can confirm completion' });
    if (!['work_done', 'active'].includes(contract.contractStatus)) {
      return res.status(400).json({ success: false, message: 'Contract is not ready for completion' });
    }
    if (contract.paymentStatus !== 'funded') {
      return res.status(400).json({ success: false, message: 'Contract must be funded before completion' });
    }

    // Credit worker wallet (deduct commission)
    await walletService.creditWorkerOnCompletion(
      req.params.id,
      contract.workerId,
      contract.agreedPrice,
      contract.commissionRateAtCreation
    );

    const batch = db().batch();

    // Update contract
    batch.update(db().collection('contracts').doc(req.params.id), {
      contractStatus: 'completed',
      paymentStatus: 'released',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update job status
    if (contract.jobId) {
      batch.update(db().collection('jobs').doc(contract.jobId), {
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Update worker completed count
    batch.update(db().collection('users').doc(contract.workerId), {
      completedJobsCount: FieldValue.increment(1),
    });

    await batch.commit();

    // Notify worker
    await db().collection('notifications').add({
      uid: contract.workerId,
      type: 'payment_released',
      title: '💸 Payment Released!',
      message: `₦${contract.workerNetAmount.toLocaleString()} has been credited to your wallet for "${contract.jobTitle}"`,
      relatedId: req.params.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Contract completed. Worker has been paid.', workerNetAmount: contract.workerNetAmount });
  } catch(e) {
    console.error('[Contracts/Complete]', e);
    return res.status(500).json({ success: false, message: e.message || 'Completion failed' });
  }
}

async function raiseDispute(req, res) {
  try {
    const uid = req.user.uid;
    const { reason, evidence } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Dispute reason required' });

    const doc = await db().collection('contracts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Contract not found' });

    const contract = doc.data();
    if (contract.clientId !== uid && contract.workerId !== uid) {
      return res.status(403).json({ success: false, message: 'Not a party to this contract' });
    }

    const disputeId = uuidv4();
    const batch = db().batch();

    batch.set(db().collection('disputes').doc(disputeId), {
      id: disputeId,
      contractId: req.params.id,
      clientId: contract.clientId,
      workerId: contract.workerId,
      raisedBy: uid,
      reason,
      evidence: evidence || '',
      status: 'open',
      adminDecision: null,
      createdAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
    });

    batch.update(db().collection('contracts').doc(req.params.id), {
      contractStatus: 'dispute',
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Notify both parties + admin
    const otherUid = uid === contract.clientId ? contract.workerId : contract.clientId;
    await db().collection('notifications').add({
      uid: otherUid,
      type: 'dispute_raised',
      title: '⚠️ Dispute Raised',
      message: `A dispute has been raised on contract "${contract.jobTitle}". Our team will review.`,
      relatedId: disputeId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true, message: 'Dispute submitted. Admin will review within 48 hours.', disputeId });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to raise dispute' });
  }
}

module.exports = { listContracts, getContract, createContract, markWorkDone, completeContract, raiseDispute };
