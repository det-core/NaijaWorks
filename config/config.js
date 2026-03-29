// ============================================================
// NaijaWorks — Server-Side Configuration
// All secret keys live here. Never expose this to the frontend.
// ============================================================

const config = {

  // ─── Server ───────────────────────────────────────────────
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: 'https://naijaworks.com', // update for production
    uploadLimit: '10mb',
  },

  // ─── Firebase Admin (Service Account) ─────────────────────
  // Replace these values with your Firebase service account credentials
  firebase: {
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
    privateKey: 'YOUR_FIREBASE_PRIVATE_KEY',         // secret
    clientEmail: 'YOUR_FIREBASE_CLIENT_EMAIL',       // secret
    databaseURL: 'YOUR_FIREBASE_DATABASE_URL',
  },

  // ─── Paystack ─────────────────────────────────────────────
  paystack: {
    secretKey: 'sk_live_YOUR_PAYSTACK_SECRET_KEY',   // secret — never expose
    publicKey: 'pk_live_YOUR_PAYSTACK_PUBLIC_KEY',   // used in frontend config
    baseUrl: 'https://api.paystack.co',
    webhookSecret: 'YOUR_PAYSTACK_WEBHOOK_SECRET',   // secret
    callbackUrl: 'https://naijaworks.com/payment/callback',
  },

  // ─── Platform Monetization ────────────────────────────────
  platform: {
    name: 'NaijaWorks',
    currency: 'NGN',
    currencySymbol: '₦',

    // Commission rates (as decimals)
    standardCommissionRate: 0.20,   // 20% for free workers
    vipCommissionRate: 0.07,        // 7% for VIP workers

    // VIP Subscription
    vip: {
      weeklyPriceKobo: 950000,      // ₦9,500 in kobo (Paystack uses kobo)
      weeklyPriceNaira: 9500,
      durationDays: 7,
      planName: 'NaijaWorks VIP',
      planCode: 'NW_VIP_WEEKLY',
    },

    // Withdrawal rules
    withdrawal: {
      minimumNaira: 10000,
      processingTimeHours: { min: 24, max: 48 },
      maxProcessingBusinessDays: 3,
      feeTiers: [
        { minNaira: 10000, maxNaira: 15000, feeNaira: 500 },
        { minNaira: 15001, maxNaira: 20000, feeNaira: 700 },
        { minNaira: 20001, maxNaira: 25000, feeNaira: 1000 },
        { minNaira: 25001, maxNaira: 30000, feeNaira: 1650 },
        // Add more tiers here as business scales
      ],
    },
  },

  // ─── Upload Settings ──────────────────────────────────────
  uploads: {
    directory: './uploads',
    maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedDocTypes: ['application/pdf'],
    avatarMaxWidth: 400,
    portfolioMaxWidth: 1200,
  },

  // ─── Admin ────────────────────────────────────────────────
  admin: {
    // Admin UIDs must be set in Firestore users collection with role: 'admin'
    // Or add UIDs here as a secondary check
    superAdminEmail: 'admin@naijaworks.com',
  },

  // ─── Rate Limiting ────────────────────────────────────────
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    authMaxRequests: 20, // stricter for auth routes
  },

  // ─── CORS ─────────────────────────────────────────────────
  cors: {
    allowedOrigins: [
      'https://naijaworks.com',
      'https://www.naijaworks.com',
      'http://localhost:3000', // dev only
    ],
  },

};

module.exports = config;
