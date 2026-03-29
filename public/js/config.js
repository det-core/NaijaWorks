// ============================================================
// NaijaWorks — Frontend Public Configuration
// Only safe, public values. NO secrets here.
// ============================================================

const NaijaWorksConfig = {

  // ─── App Info ─────────────────────────────────────────────
  app: {
    name: 'NaijaWorks',
    tagline: 'Hire Trusted Nigerian Workers — Locally & Remotely',
    baseUrl: 'https://naijaworks.com',
    supportEmail: 'support@naijaworks.com',
    currency: 'NGN',
    currencySymbol: '₦',
  },

  // ─── Firebase Client SDK (public — safe to expose) ────────
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },

  // ─── Paystack Public Key ──────────────────────────────────
  paystack: {
    publicKey: 'pk_live_YOUR_PAYSTACK_PUBLIC_KEY',
  },

  // ─── Platform Rules (mirrors server config) ───────────────
  platform: {
    standardCommissionPercent: 20,
    vipCommissionPercent: 7,
    vipWeeklyPriceNaira: 9500,
    withdrawalMinNaira: 10000,
    withdrawalFeeTiers: [
      { label: '₦10,000 – ₦15,000', fee: 500 },
      { label: '₦15,001 – ₦20,000', fee: 700 },
      { label: '₦20,001 – ₦25,000', fee: 1000 },
      { label: '₦25,001 – ₦30,000', fee: 1650 },
    ],
  },

  // ─── Nigerian States (for location forms) ─────────────────
  nigerianStates: [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa',
    'Benue','Borno','Cross River','Delta','Ebonyi','Edo',
    'Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa',
    'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
    'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun',
    'Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'
  ],

  // ─── Service Categories ───────────────────────────────────
  categories: {
    physical: [
      { id: 'driver', label: 'Driver / Chauffeur', icon: '🚗' },
      { id: 'cleaner', label: 'Cleaner / Housekeeper', icon: '🧹' },
      { id: 'cook', label: 'Cook / Chef', icon: '👨‍🍳' },
      { id: 'nanny', label: 'Nanny / Babysitter', icon: '👶' },
      { id: 'dispatch', label: 'Dispatch Rider', icon: '🛵' },
      { id: 'technician', label: 'Technician / Repairman', icon: '🔧' },
      { id: 'electrician', label: 'Electrician', icon: '⚡' },
      { id: 'plumber', label: 'Plumber', icon: '🔩' },
      { id: 'barber', label: 'Barber / Hair Stylist', icon: '💈' },
      { id: 'home_assistant', label: 'Home Assistant', icon: '🏠' },
      { id: 'security', label: 'Security Staff / Guard', icon: '🛡️' },
      { id: 'gardener', label: 'Gardener / Landscaper', icon: '🌿' },
      { id: 'mover', label: 'Mover / Packer', icon: '📦' },
      { id: 'painter', label: 'Painter', icon: '🖌️' },
      { id: 'ac_technician', label: 'AC / Appliance Technician', icon: '❄️' },
    ],
    remote: [
      { id: 'web_dev', label: 'Web Developer', icon: '💻' },
      { id: 'app_dev', label: 'App Developer', icon: '📱' },
      { id: 'graphic_design', label: 'Graphic Designer', icon: '🎨' },
      { id: 'video_editor', label: 'Video Editor', icon: '🎬' },
      { id: 'writer', label: 'Writer / Copywriter', icon: '✍️' },
      { id: 'social_media', label: 'Social Media Manager', icon: '📲' },
      { id: 'virtual_assistant', label: 'Virtual Assistant', icon: '🤝' },
      { id: 'marketer', label: 'Digital Marketer', icon: '📊' },
      { id: 'customer_support', label: 'Customer Support', icon: '🎧' },
      { id: 'data_entry', label: 'Data Entry / Admin', icon: '📋' },
      { id: 'accountant', label: 'Accountant / Bookkeeper', icon: '💰' },
      { id: 'tutor', label: 'Online Tutor', icon: '📚' },
      { id: 'translator', label: 'Translator / Interpreter', icon: '🌍' },
      { id: 'seo', label: 'SEO Specialist', icon: '🔍' },
      { id: 'voiceover', label: 'Voice Over Artist', icon: '🎙️' },
    ],
  },

  // ─── API Routes ───────────────────────────────────────────
  api: {
    base: '/api/v1',
    auth: '/api/v1/auth',
    users: '/api/v1/users',
    workers: '/api/v1/workers',
    jobs: '/api/v1/jobs',
    offers: '/api/v1/offers',
    contracts: '/api/v1/contracts',
    payments: '/api/v1/payments',
    wallet: '/api/v1/wallet',
    withdrawals: '/api/v1/withdrawals',
    vip: '/api/v1/vip',
    reviews: '/api/v1/reviews',
    disputes: '/api/v1/disputes',
    categories: '/api/v1/categories',
    admin: '/api/v1/admin',
    location: '/api/v1/location',
    uploads: '/api/v1/uploads',
    notifications: '/api/v1/notifications',
  },

};

// Freeze config to prevent accidental mutation
Object.freeze(NaijaWorksConfig);
