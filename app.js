// ============================================================
// NaijaWorks — Express App Setup
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');

// Initialize Firebase before anything else
require('./firebase/admin');

const app = express();

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.paystack.co', 'https://www.gstatic.com', 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.paystack.co', 'https://*.firebaseio.com', 'https://*.googleapis.com'],
      frameSrc: ["'self'", 'https://js.paystack.co'],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────
// Webhook route needs raw body for signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: config.server.uploadLimit }));
app.use(express.urlencoded({ extended: true, limit: config.server.uploadLimit }));

// ─── Logging ──────────────────────────────────────────────────
if (config.server.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// ─── Global Rate Limiter ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', globalLimiter);

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/v1/auth',          require('./routes/auth'));
app.use('/api/v1/users',         require('./routes/users'));
app.use('/api/v1/workers',       require('./routes/workers'));
app.use('/api/v1/jobs',          require('./routes/jobs'));
app.use('/api/v1/offers',        require('./routes/offers'));
app.use('/api/v1/contracts',     require('./routes/contracts'));
app.use('/api/v1/payments',      require('./routes/payments'));
app.use('/api/v1/wallet',        require('./routes/wallet'));
app.use('/api/v1/withdrawals',   require('./routes/withdrawals'));
app.use('/api/v1/vip',           require('./routes/vip'));
app.use('/api/v1/reviews',       require('./routes/reviews'));
app.use('/api/v1/disputes',      require('./routes/disputes'));
app.use('/api/v1/categories',    require('./routes/categories'));
app.use('/api/v1/admin',         require('./routes/admin'));
app.use('/api/v1/location',      require('./routes/location'));
app.use('/api/v1/uploads',       require('./routes/uploads'));
app.use('/api/v1/notifications', require('./routes/notifications'));

// ─── Catch-All: Serve Frontend SPA ────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);

  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `File upload error: ${err.message}` });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS policy violation' });
  }

  const status = err.status || 500;
  const message = config.server.nodeEnv === 'production'
    ? 'An internal server error occurred'
    : err.message;

  res.status(status).json({ success: false, message });
});

module.exports = app;
