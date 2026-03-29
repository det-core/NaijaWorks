// ============================================================
// NaijaWorks — Admin Controller
// ============================================================
const { db, FieldValue } = require('../firebase/admin');
const walletService = require('../services/walletService');
const { v4: uuidv4 } = require('uuid');

// ─── Dashboard Stats ──────────────────────────────────────
async function getDashboardStats(req, res) {
  try {
    const [usersSnap, jobsSnap, contractsSnap, withdrawalsSnap, paymentsSnap] = await Promise.all([
      db().collection('users').get(),
      db().collection('jobs').get(),
      db().collection('contracts').get(),
      db().collection('withdrawals').where('status', '==', 'pending').get(),
      db().collection('payments').where('status', '==', 'success').get(),
    ]);

    const users     = usersSnap.docs.map(d => d.data());
    const contracts = contractsSnap.docs.map(d => d.data());

    const totalRevenue = contracts
      .filter(c => c.contractStatus === 'completed')
      .reduce((sum, c) => sum + (c.platformCommissionAmount || 0), 0);

    const stats = {
      totalUsers:         users.length,
      totalWorkers:       users.filter(u => u.role === 'worker').length,
      totalClients:       users.filter(u => u.role === 'client').length,
      totalJobs:          jobsSnap.size,
      totalContracts:     contractsSnap.size,
      completedContracts: contracts.filter(c => c.contractStatus === 'completed').length,
      activeContracts:    contracts.filter(c => c.contractStatus === 'active').length,
      pendingWithdrawals: withdrawalsSnap.size,
      totalPayments:      paymentsSnap.size,
      totalRevenue,
    };

    return res.json({ success: true, stats });
  } catch(e) {
    console.error('[Admin/Stats]', e);
    return res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
}

// ─── Users ────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const { role, status, q, limit: lim, page } = req.query;
    const pageSize = Math.min(parseInt(lim) || 20, 100);

    let query = db().collection('users').orderBy('createdAt', 'desc');
    if (role && role !== 'all') query = db().collection('users').where('role', '==', role).orderBy('createdAt', 'desc');

    const snap = await query.limit(pageSize).get();
    let users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

    if (status && status !== 'all') users = users.filter(u => u.accountStatus === status);
    if (q) {
      const ql = q.toLowerCase();
      users = users.filter(u =>
        u.fullName?.toLowerCase().includes(ql) ||
        u.email?.toLowerCase().includes(ql) ||
        u.phone?.includes(q)
      );
    }

    // Strip private keys
    users = users.map(u => {
      delete u.privateKey;
      return u;
    });

    return res.json({ success: true, users, total: users.length });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to load users' });
  }
}

async function getUser(req, res) {
  try {
    const doc = await db().collection('users').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'User not found' });
    const wallet = await walletService.getWallet(req.params.uid);
    return res.json({ success: true, user: doc.data(), wallet });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function updateUserStatus(req, res) {
  try {
    const { status, reason } = req.body;
    const allowed = ['active', 'suspended', 'banned'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db().collection('users').doc(req.params.uid).update({
      accountStatus: status,
      statusReason: reason || '',
      statusUpdatedAt: FieldValue.serverTimestamp(),
      statusUpdatedBy: req.user.uid,
    });

    if (status !== 'active') {
      await db().collection('notifications').add({
        uid: req.params.uid,
        type: 'account_status',
        title: status === 'suspended' ? '⚠️ Account Suspended' : '🚫 Account Banned',
        message: reason || `Your account has been ${status}. Contact support for more information.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return res.json({ success: true, message: `User ${status}` });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
}

async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    if (!['client', 'worker', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    await db().collection('users').doc(req.params.uid).update({ role, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, message: 'Role updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
}

// ─── Jobs ─────────────────────────────────────────────────
async function listJobs(req, res) {
  try {
    const { status, limit: lim } = req.query;
    let query = db().collection('jobs').orderBy('createdAt', 'desc').limit(parseInt(lim) || 50);
    const snap = await query.get();
    let jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (status && status !== 'all') jobs = jobs.filter(j => j.status === status);
    return res.json({ success: true, jobs, total: jobs.length });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function updateJobStatus(req, res) {
  try {
    const { status } = req.body;
    await db().collection('jobs').doc(req.params.id).update({ status, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, message: 'Job updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// ─── Payments ─────────────────────────────────────────────
async function listPayments(req, res) {
  try {
    const snap = await db().collection('payments').orderBy('createdAt', 'desc').limit(100).get();
    const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, payments, total: payments.length });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// ─── Wallets ──────────────────────────────────────────────
async function listWallets(req, res) {
  try {
    const snap = await db().collection('wallets').orderBy('availableBalance', 'desc').limit(100).get();
    const wallets = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    return res.json({ success: true, wallets });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function getWallet(req, res) {
  try {
    const wallet = await walletService.getWallet(req.params.uid);
    const txs    = await walletService.getTransactionHistory(req.params.uid, 20);
    return res.json({ success: true, wallet, transactions: txs });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function manualCredit(req, res) {
  try {
    const { amount, note } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    const uid   = req.params.uid;
    const txId  = uuidv4();
    const amountN = parseFloat(amount);

    await db().runTransaction(async (txn) => {
      const walletRef = db().collection('wallets').doc(uid);
      const walletDoc = await txn.get(walletRef);
      if (!walletDoc.exists) throw new Error('Wallet not found');
      const before = walletDoc.data().availableBalance;

      txn.update(walletRef, {
        availableBalance: FieldValue.increment(amountN),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(db().collection('walletTransactions').doc(txId), {
        id: txId, uid, type: 'admin_credit', amount: amountN, fee: 0,
        balanceBefore: before, balanceAfter: before + amountN,
        relatedId: req.user.uid,
        note: note || 'Manual credit by admin',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await db().collection('notifications').add({
      uid, type: 'wallet_credit',
      title: '💰 Wallet Credited',
      message: `₦${amountN.toLocaleString()} has been added to your wallet. ${note || ''}`,
      read: false, createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: `₦${amountN.toLocaleString()} credited to wallet` });
  } catch(e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Withdrawals ──────────────────────────────────────────
async function listWithdrawals(req, res) {
  try {
    const { status } = req.query;
    let query = db().collection('withdrawals').orderBy('requestedAt', 'desc').limit(100);
    const snap = await query.get();
    let withdrawals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (status && status !== 'all') withdrawals = withdrawals.filter(w => w.status === status);
    return res.json({ success: true, withdrawals, total: withdrawals.length });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function approveWithdrawal(req, res) {
  try {
    const { notes } = req.body;
    const doc = await db().collection('withdrawals').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    const withdrawal = doc.data();
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal is not pending' });
    }

    await doc.ref.update({
      status: 'completed',
      notes: notes || 'Approved and processed by admin',
      processedAt: FieldValue.serverTimestamp(),
      processedBy: req.user.uid,
    });

    await db().collection('notifications').add({
      uid: withdrawal.uid,
      type: 'withdrawal_approved',
      title: '✅ Withdrawal Approved',
      message: `Your withdrawal of ₦${withdrawal.netAmount.toLocaleString()} has been processed and sent to ${withdrawal.bankName}.`,
      read: false, createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Withdrawal approved' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function rejectWithdrawal(req, res) {
  try {
    const { reason } = req.body;
    const doc = await db().collection('withdrawals').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    const withdrawal = doc.data();
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal is not pending' });
    }

    await doc.ref.update({
      status: 'failed',
      notes: reason || 'Rejected by admin',
      processedAt: FieldValue.serverTimestamp(),
      processedBy: req.user.uid,
    });

    // Refund wallet
    await walletService.refundWithdrawal(withdrawal.uid, req.params.id, withdrawal.amount, withdrawal.fee);

    await db().collection('notifications').add({
      uid: withdrawal.uid,
      type: 'withdrawal_rejected',
      title: '⚠️ Withdrawal Rejected',
      message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was rejected and refunded to your wallet. Reason: ${reason || 'See admin notes'}`,
      read: false, createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Withdrawal rejected and refunded' });
  } catch(e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// ─── Disputes ─────────────────────────────────────────────
async function listDisputes(req, res) {
  try {
    const { status } = req.query;
    let query = db().collection('disputes').orderBy('createdAt', 'desc').limit(100);
    const snap = await query.get();
    let disputes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (status && status !== 'all') disputes = disputes.filter(d => d.status === status);
    return res.json({ success: true, disputes, total: disputes.length });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function resolveDispute(req, res) {
  try {
    const { decision, winner, notes } = req.body;
    // winner: 'client' | 'worker' | 'split'
    if (!decision) return res.status(400).json({ success: false, message: 'Decision required' });

    const doc = await db().collection('disputes').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Dispute not found' });
    const dispute = doc.data();

    const batch = db().batch();

    batch.update(db().collection('disputes').doc(req.params.id), {
      status: 'resolved',
      adminDecision: decision,
      adminWinner: winner || null,
      adminNotes: notes || '',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: req.user.uid,
    });

    batch.update(db().collection('contracts').doc(dispute.contractId), {
      contractStatus: winner === 'client' ? 'cancelled' : 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Notify both parties
    const notifyBoth = async (uid, msg) => {
      await db().collection('notifications').add({
        uid, type: 'dispute_resolved',
        title: '⚖️ Dispute Resolved',
        message: msg,
        read: false, createdAt: FieldValue.serverTimestamp(),
      });
    };

    await notifyBoth(dispute.clientId, `Your dispute has been resolved: ${decision}`);
    await notifyBoth(dispute.workerId, `Your dispute has been resolved: ${decision}`);

    return res.json({ success: true, message: 'Dispute resolved' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// ─── Categories ───────────────────────────────────────────
async function listCategories(req, res) {
  try {
    const snap = await db().collection('categories').orderBy('name').get();
    const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, categories });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, type, icon } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type required' });
    const id = name.toLowerCase().replace(/\s+/g, '_');
    await db().collection('categories').doc(id).set({
      id, name, type, icon: icon || '🔧', active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ success: true, message: 'Category created', id });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function updateCategory(req, res) {
  try {
    const { name, type, icon, active } = req.body;
    const updates = {};
    if (name !== undefined)   updates.name   = name;
    if (type !== undefined)   updates.type   = type;
    if (icon !== undefined)   updates.icon   = icon;
    if (active !== undefined) updates.active = active;
    updates.updatedAt = FieldValue.serverTimestamp();
    await db().collection('categories').doc(req.params.id).update(updates);
    return res.json({ success: true, message: 'Category updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// ─── Site Settings ────────────────────────────────────────
async function getSettings(req, res) {
  try {
    const doc = await db().collection('siteSettings').doc('main').get();
    return res.json({ success: true, settings: doc.exists ? doc.data() : {} });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

async function updateSettings(req, res) {
  try {
    await db().collection('siteSettings').doc('main').set({
      ...req.body,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    }, { merge: true });
    return res.json({ success: true, message: 'Settings updated' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

// ─── Analytics ────────────────────────────────────────────
async function getAnalytics(req, res) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentUsers, recentContracts, recentPayments] = await Promise.all([
      db().collection('users').where('createdAt', '>=', thirtyDaysAgo).get(),
      db().collection('contracts').where('createdAt', '>=', thirtyDaysAgo).get(),
      db().collection('payments').where('status', '==', 'success').where('createdAt', '>=', thirtyDaysAgo).get(),
    ]);

    const completedContracts = recentContracts.docs.filter(d => d.data().contractStatus === 'completed');
    const revenue30d = completedContracts.reduce((sum, d) => sum + (d.data().platformCommissionAmount || 0), 0);

    return res.json({
      success: true,
      analytics: {
        newUsers30d:       recentUsers.size,
        newContracts30d:   recentContracts.size,
        completedJobs30d:  completedContracts.length,
        revenue30d,
        successfulPayments30d: recentPayments.size,
      }
    });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
}

module.exports = {
  getDashboardStats, listUsers, getUser, updateUserStatus, updateUserRole,
  listJobs, updateJobStatus, listPayments,
  listWallets, getWallet, manualCredit,
  listWithdrawals, approveWithdrawal, rejectWithdrawal,
  listDisputes, resolveDispute,
  listCategories, createCategory, updateCategory,
  getSettings, updateSettings, getAnalytics,
};
