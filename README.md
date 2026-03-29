# NaijaWorks

**Nigeria's Hybrid Labor Marketplace & Freelance Hiring Platform**

NaijaWorks connects clients with verified Nigerian workers for physical/local services and remote/digital services. Built with escrow-protected payments via Paystack, Firebase Authentication, Cloud Firestore, and a full wallet + withdrawal system.

---

## Features

### Core Platform
- Hire workers for local jobs (drivers, cleaners, cooks, electricians, etc.)
- Hire workers for remote jobs (developers, designers, writers, VAs, etc.)
- Offer negotiation system — clients and workers agree on price
- Secure escrow payments via Paystack (funds held until job complete)
- Worker wallet + withdrawal to any Nigerian bank
- Rating & review system after job completion
- Dispute resolution panel

### Monetization
- 20% platform commission (Standard workers)
- 7% platform commission (VIP workers)
- VIP subscription: ₦9,500/week
- Withdrawal fees (tiered by amount)

### Admin Panel
- Full user management
- Job, contract, offer oversight
- Payment & wallet management
- Manual withdrawal processing
- Dispute resolution
- Analytics dashboard
- Site settings

### Technical
- Firebase Authentication (email/password + Google)
- Cloud Firestore database
- Paystack payment processing + webhook handling
- Location detection (browser geolocation + reverse geocoding)
- File uploads (avatars, portfolios, job evidence)
- In-app notification system
- Mobile-first responsive design

---

## Tech Stack

| Layer        | Technology                     |
|--------------|-------------------------------|
| Frontend     | HTML, CSS, Vanilla JavaScript |
| Backend      | Node.js, Express.js           |
| Auth         | Firebase Authentication       |
| Database     | Cloud Firestore               |
| Payments     | Paystack                      |
| File uploads | Multer + local storage        |
| Deployment   | VPS + Nginx reverse proxy     |

---

## Folder Structure

```
naijaworks/
├── server.js              # Entry point
├── app.js                 # Express app setup
├── package.json
├── config/
│   └── config.js          # Server-side secrets & settings (never expose)
├── firebase/
│   └── admin.js           # Firebase Admin SDK init
├── middleware/
│   └── auth.js            # JWT/token verification middleware
├── routes/                # Express route files (one per module)
│   ├── auth.js
│   ├── users.js
│   ├── workers.js
│   ├── jobs.js
│   ├── offers.js
│   ├── contracts.js
│   ├── payments.js
│   ├── wallet.js
│   ├── withdrawals.js
│   ├── vip.js
│   ├── reviews.js
│   ├── disputes.js
│   ├── categories.js
│   ├── admin.js
│   ├── location.js
│   ├── uploads.js
│   └── notifications.js
├── controllers/           # Business logic
│   ├── authController.js
│   └── paymentsController.js
├── services/
│   ├── walletService.js   # All wallet operations (Firestore transactions)
│   └── paystackService.js # Paystack API integration
├── utils/
│   └── commission.js      # Commission & fee calculations
├── uploads/               # Uploaded files (gitignored)
└── public/                # Static frontend
    ├── css/
    │   └── main.css       # Global design system
    ├── js/
    │   ├── config.js      # Frontend public config (Firebase, Paystack public key)
    │   └── main.js        # Global JS utilities (auth, API, toasts, formatters)
    ├── images/
    ├── index.html          # Homepage
    ├── login.html
    ├── signup.html
    ├── forgot-password.html
    ├── browse-workers.html
    ├── fees.html
    ├── worker-dashboard.html  (Phase 3)
    ├── client-dashboard.html  (Phase 3)
    └── ... (all other pages)
```

---

## Installation

### Prerequisites
- Node.js 18+
- npm
- Firebase project (Firestore + Authentication enabled)
- Paystack account (live or test keys)

### Steps

```bash
# 1. Clone or copy the project
cd naijaworks

# 2. Install dependencies
npm install

# 3. Configure (see below)

# 4. Run in development
npm run dev

# 5. Run in production
npm start
```

---

## Configuration

### DO NOT use .env files. Use config.js files.

**Server config** — `config/config.js`

Replace all placeholder values:

```js
firebase: {
  projectId:   'your-project-id',
  privateKey:  'your-private-key',    // From Firebase service account JSON
  clientEmail: 'your-client-email',
  databaseURL: 'your-database-url',
},

paystack: {
  secretKey:     'sk_live_...',   // Secret — server only
  publicKey:     'pk_live_...',   // Also update frontend config
  webhookSecret: 'your-webhook-secret',
  callbackUrl:   'https://yourdomain.com/payment/callback',
},
```

**Frontend config** — `public/js/config.js`

```js
firebase: {
  apiKey:            'your-api-key',
  authDomain:        'your-project.firebaseapp.com',
  projectId:         'your-project-id',
  storageBucket:     'your-project.appspot.com',
  messagingSenderId: 'your-sender-id',
  appId:             'your-app-id',
},

paystack: {
  publicKey: 'pk_live_...',
},
```

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication**: Email/Password + Google
4. Enable **Cloud Firestore** (Production mode)
5. Go to **Project Settings → Service Accounts**
6. Click **Generate new private key** — download the JSON
7. Copy `project_id`, `private_key`, `client_email` into `config/config.js`
8. Copy the web app config (from **Project Settings → General**) into `public/js/config.js`

---

## Firestore Setup

### Security Rules (recommended starting point)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if request.auth.uid == uid;
    }
    // Worker profiles are publicly readable
    match /workerProfiles/{uid} {
      allow read: if true;
      allow write: if request.auth.uid == uid;
    }
    // All sensitive operations go through the backend (admin SDK bypasses rules)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Required Indexes

Create these composite indexes in Firestore Console:
- `workers` collection: `accountStatus` ASC, `isVIP` DESC, `ratingAverage` DESC
- `jobs` collection: `clientId` ASC, `createdAt` DESC
- `walletTransactions` collection: `uid` ASC, `createdAt` DESC
- `withdrawals` collection: `status` ASC, `requestedAt` DESC
- `notifications` collection: `uid` ASC, `createdAt` DESC

---

## Paystack Setup

1. Create account at [paystack.com](https://paystack.com)
2. Get your **Secret Key** and **Public Key** from Settings → API Keys
3. Set up **Webhook** in Paystack Dashboard:
   - URL: `https://yourdomain.com/api/v1/payments/webhook`
   - Events: `charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`
4. Copy your webhook secret to `config/config.js → paystack.webhookSecret`

---

## Deployment (VPS + Nginx)

### Nginx config (`/etc/nginx/sites-available/naijaworks`)

```nginx
server {
    listen 80;
    server_name naijaworks.com www.naijaworks.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name naijaworks.com www.naijaworks.com;

    ssl_certificate     /etc/letsencrypt/live/naijaworks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/naijaworks.com/privkey.pem;

    client_max_body_size 15M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Use PM2 for process management

```bash
npm install -g pm2
pm2 start server.js --name naijaworks
pm2 save
pm2 startup
```

---

## Admin Setup

1. Sign up normally through the platform
2. In Firestore Console, find the user's document in the `users` collection
3. Change `role` from `"client"` or `"worker"` to `"admin"`
4. The user can now access `/admin-dashboard.html`

---

## Wallet & Withdrawal Notes

- Workers earn to their NaijaWorks wallet (not directly to bank)
- All wallet operations use Firestore transactions — atomic and safe
- Withdrawal is manual admin-processed in Phase 7, automated via Paystack Transfers API later
- Minimum withdrawal: ₦10,000
- Processing time: 24–48 hours (up to 3 business days)
- Commission is deducted at job completion, before crediting worker wallet

---

## VIP Subscription Notes

- VIP subscription is ₦9,500/week
- Payment via Paystack
- Upon successful payment, `isVIP` = true, `vipEndDate` = +7 days
- Commission rate drops from 20% to 7% for all new contracts while VIP is active
- Old contracts retain their original commission rate (stored at contract creation)
- VIP badge appears on worker profile in search results

---

## Future: Flutterwave

The payment architecture is designed to support multiple providers. To add Flutterwave:

1. Install `flutterwave-node-v3` package
2. Create `services/flutterwaveService.js` mirroring `paystackService.js`
3. Add `provider` field routing in `paymentsController.js`
4. Add `flutterwave.secretKey` to `config/config.js`
5. The UI already has a "coming soon" placeholder

---

## Support

- Email: support@naijaworks.com
- Platform: NaijaWorks v1.0.0
