// ============================================================
// NaijaWorks — Auth Controller
// ============================================================

const { auth, db, FieldValue } = require('../firebase/admin');
const { initializeWallet } = require('../services/walletService');
const { getCommissionRate } = require('../utils/commission');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/v1/auth/register
 * Creates Firestore user profile after Firebase client-side sign-up.
 * Body: { idToken, firstName, lastName, phone, role: 'client'|'worker' }
 */
async function register(req, res) {
  try {
    const { idToken, firstName, lastName, phone, role } = req.body;

    if (!idToken || !firstName || !lastName || !phone || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!['client', 'worker'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be client or worker' });
    }

    // Verify the Firebase token
    const decoded = await auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Check if profile already exists
    const existingDoc = await db().collection('users').doc(uid).get();
    if (existingDoc.exists) {
      return res.status(409).json({ success: false, message: 'Account already registered' });
    }

    const now = FieldValue.serverTimestamp();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const userProfile = {
      uid,
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName,
      email: decoded.email || '',
      phone: phone.trim(),
      whatsappNumber: '',
      telegramUsername: '',
      profilePhoto: '',
      bio: '',
      state: '',
      city: '',
      lga: '',
      area: '',
      latitude: null,
      longitude: null,
      detectedLocationLabel: '',
      manualLocationLabel: '',
      remoteAvailable: role === 'worker' ? false : null,
      canTravel: role === 'worker' ? false : null,
      accountStatus: 'active',
      isVIP: false,
      vipPlanType: null,
      vipStartDate: null,
      vipEndDate: null,
      commissionRate: 0.20,
      savedLocationUpdatedAt: null,
      createdAt: now,
      lastLoginAt: now,
    };

    // Role-specific fields
    if (role === 'worker') {
      userProfile.serviceCategories = [];
      userProfile.skills = [];
      userProfile.portfolioLinks = [];
      userProfile.portfolioImages = [];
      userProfile.pricingModel = 'fixed';
      userProfile.basePrice = 0;
      userProfile.minimumAcceptablePrice = 0;
      userProfile.hourlyRate = 0;
      userProfile.dailyRate = 0;
      userProfile.weeklyRate = 0;
      userProfile.monthlyRate = 0;
      userProfile.fixedProjectPrice = 0;
      userProfile.yearsOfExperience = 0;
      userProfile.isVerified = false;
      userProfile.ratingAverage = 0;
      userProfile.ratingCount = 0;
      userProfile.completedJobsCount = 0;
      userProfile.availabilitySchedule = {};
      userProfile.profilePublished = false;
    }

    if (role === 'client') {
      userProfile.savedWorkers = [];
      userProfile.postedJobsCount = 0;
      userProfile.hiresCount = 0;
      userProfile.preferredCategories = [];
      userProfile.companyName = '';
    }

    // Save to Firestore
    await db().collection('users').doc(uid).set(userProfile);

    // Initialize wallet for both roles
    await initializeWallet(uid);

    // Send welcome notification
    await db().collection('notifications').add({
      uid,
      type: 'welcome',
      title: 'Welcome to NaijaWorks! 🎉',
      message: `Hi ${firstName}, your ${role} account is ready. ${role === 'worker' ? 'Complete your profile to start getting hired.' : 'Start browsing workers and post your first job.'}`,
      read: false,
      createdAt: now,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        uid,
        role,
        fullName,
        email: decoded.email,
      },
    });

  } catch (error) {
    console.error('[Auth/Register]', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, message: 'Token expired. Please try again.' });
    }
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
}

/**
 * POST /api/v1/auth/login
 * Updates lastLoginAt on successful token verification.
 */
async function login(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'ID token required' });

    const decoded = await auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await db().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'Account not found. Please register.' });
    }

    const userData = userDoc.data();

    if (userData.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
    }
    if (userData.accountStatus === 'banned') {
      return res.status(403).json({ success: false, message: 'Your account has been banned.' });
    }

    // Update lastLoginAt
    await db().collection('users').doc(uid).update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        uid,
        role: userData.role,
        fullName: userData.fullName,
        email: userData.email,
        isVIP: userData.isVIP,
        profilePhoto: userData.profilePhoto,
        accountStatus: userData.accountStatus,
      },
    });

  } catch (error) {
    console.error('[Auth/Login]', error);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
}

/**
 * POST /api/v1/auth/logout
 * Revokes refresh tokens (optional but good practice).
 */
async function logout(req, res) {
  try {
    await auth().revokeRefreshTokens(req.user.uid);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Auth/Logout]', error);
    return res.status(200).json({ success: true, message: 'Logged out' }); // Still OK for client
  }
}

/**
 * GET /api/v1/auth/me
 * Returns full current user profile.
 */
async function getMe(req, res) {
  try {
    const userDoc = await db().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const userData = userDoc.data();

    // Strip sensitive server-only fields
    delete userData.privateKey;

    return res.status(200).json({ success: true, user: userData });

  } catch (error) {
    console.error('[Auth/GetMe]', error);
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
}

/**
 * POST /api/v1/auth/verify-token
 * Lightweight check — just verifies the token is valid.
 */
async function verifyToken(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'Token required' });

    const decoded = await auth().verifyIdToken(idToken);
    return res.status(200).json({ success: true, uid: decoded.uid, email: decoded.email });

  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = { register, login, logout, getMe, verifyToken };
