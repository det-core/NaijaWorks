// ============================================================
// NaijaWorks — Authentication Middleware
// ============================================================

const { auth, db } = require('../firebase/admin');

/**
 * Verifies the Firebase ID token from Authorization header.
 * Attaches req.user with uid, role, isVIP, commissionRate, accountStatus.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth().verifyIdToken(idToken);

    // Fetch user profile from Firestore
    const userDoc = await db().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User profile not found' });
    }

    const userData = userDoc.data();

    if (userData.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
    }

    if (userData.accountStatus === 'banned') {
      return res.status(403).json({ success: false, message: 'Your account has been banned.' });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
      isVIP: userData.isVIP || false,
      commissionRate: userData.commissionRate || 0.20,
      accountStatus: userData.accountStatus,
      fullName: userData.fullName,
    };

    next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }
    console.error('[Auth Middleware]', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

/**
 * Requires admin role.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied: Admin only' });
  }
  next();
}

/**
 * Requires worker role.
 */
function requireWorker(req, res, next) {
  if (!req.user || req.user.role !== 'worker') {
    return res.status(403).json({ success: false, message: 'Access denied: Workers only' });
  }
  next();
}

/**
 * Requires client role.
 */
function requireClient(req, res, next) {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ success: false, message: 'Access denied: Clients only' });
  }
  next();
}

/**
 * Allows both clients and workers but not admin.
 */
function requireUser(req, res, next) {
  if (!req.user || req.user.role === 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireWorker, requireClient, requireUser };
