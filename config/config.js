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
    projectId: 'naijaworks-a56ac',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCs40xdV96OIggj\n5/AgcztP6+zDrNsDAUPwF+Eyh/fNpaDePaycsu9DpMwpYgbnsp/8ctzyZc9r9YlD\nmwEwThZm3B8KXmTKKh9uckxXurnq6mxsbBtC2gNJ7e5fawN94AsfnDo+AVb35d5g\n1zftZhOtcMnMFeE6T6KMJ0nrvT4qFHUSHOKzo30DHqQ1AwS7e8etbNDBAcRrQmiy\no7P6XvPlGRRo+7v84/n50u3w44hO6Y5AaCR/Lgdie5CVL6IzkHC2HebjDVmQM8Wc\nh2MsbE2ARmIpa+X49WT9kPaAHsy78a+sVpul7ZaL21STZ60/FXOVmYwvpuEEsK76\nikyiR+v5AgMBAAECggEATK3nccMGL44ChEJbq1jQZqsh8Muau6N1CWjd9bZ+ftRG\nHCvIghuOqTbPYk9a9qqv8JzVSCFFtQFK5xQ5m74Wi3p3vfaNx2iVVjwVhheIXBur\nCQ+Nq8HcEY8Y2XMyMkMLS/LTliqr8vkd/1+VK5LJiXRr3DucEGu/kV/fllHx32FG\nungU0m3UjaLI0j/sYo3qSNuCif9MBAy2znRMnVnsTnhhwxS4ajQG/zvE6ttu4zxp\ny2rNXhoF+DXabVQVZJMLg+YGQiQSDXj/VCguBbN1o7CdaQ+Bk2BSqxjcImY1jNHe\nHJWT2yN57YEDdvfQSmGwug432+wYgSSPnTE6CZW5TQKBgQDXqoEMX0F6Y0eilGt7\nQ3XGVq92OW4698B8xF1cpBVYawv5poz/oVTrMUbms41H7HPjewrofQIj7++v6Gvq\n6w6icGnnJJy7XABr2d+YLjCofutLxIz+uzsMvwjCmlR6Lnt+xluKD/a6kXRlrP2I\nFwk/+eFNw6j+BbY3m+okM1EB6wKBgQDNOLG6vaipfbM1r8ThPxK97iNNf80MTlxn\nbuUOSLp74blT+d6wY6hXcNi4awjbEa1PmZQCLlYXlZDHFFVI0SpFEthqYWf58/OL\nPzPzIzXYrRF8CExu7S2EPdTk5PfdeksfzK4mtUMlohwrOJMtAIDaPlQG6toC1QLl\nnu29J3XsqwKBgEe1cslJVv05y5TcYsyOhreXFSprOCK1RDR4Gk72Y/6NQWMWJOXO\nn+y/6sJEy2Ix1eq6e8sH3dFTM1A7KL7ov2n1lND9VHvbwGwb+oOgQB+Wa+g6h2Mf\noCfB0UjbheFGWVuy2rcSTciFGr3AAmDgv/ucu3Re7W7hOVBOMFEvGu1XAoGBAJaT\nYKSaACTMXC+qFhUHSGMfVbvJZ9P9swMZdOt0JZA74NVi4ygdFymBXSKDNm42nClp\nkBXBld2cGixYGPNitVcVKsFzUu0tN6cV6rIdRacD5W5SUHKbh+gdzhVcgxl4X6Kn\ndahlGy2DspNr4WEFm4WGcfTZYLjvPj7oy5scVwQdAoGAcoG7qL5c5JrbgPzxscQi\nfHI6TOhVky5/ECgD/uXEaYqSL8LrK+ayKqLSiiSkYRvSkLOY8I0AZt/9XfA1Vv05\nyhlsqx5rtW8T6WE7NgmQ2AOl+fY5I3w7ni7KpOB5o9XF7soQzphx3pGwYjsrPmdH\nxttIS14PAnE1TquApXJc+vA=\n-----END PRIVATE KEY-----\n',         // secret
    clientEmail: 'firebase-adminsdk-fbsvc@naijaworks-a56ac.iam.gserviceaccount.com',       // secret
    databaseURL: 'YOUR_FIREBASE_DATABASE_URL',
  },

  // ─── Paystack ─────────────────────────────────────────────
  paystack: {
    secretKey: 'sk_live_9878e0da1acf28502ee89ce4e692e99fa88d1d28',   // secret — never expose
    publicKey: 'pk_live_03fa82ae8e5a7e2bd1f81b49f8db6380a833a044',   // used in frontend config
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
    superAdminEmail: 'det@admin.com',
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
