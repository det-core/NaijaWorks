// ============================================================
// NaijaWorks — Firebase Admin SDK Initialization
// ============================================================

const admin = require('firebase-admin');
const config = require('../config/config');

let db, auth, storage;

function initializeFirebase() {
  if (admin.apps.length > 0) {
    // Already initialized
    return { db, auth };
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
        clientEmail: config.firebase.clientEmail,
      }),
      databaseURL: config.firebase.databaseURL,
    });

    db = admin.firestore();
    auth = admin.auth();

    // Firestore settings
    db.settings({ ignoreUndefinedProperties: true });

    console.log('[Firebase] Admin SDK initialized successfully');
    return { db, auth };

  } catch (error) {
    console.error('[Firebase] Initialization failed:', error.message);
    process.exit(1);
  }
}

// Initialize on module load
initializeFirebase();

// Export for use across the app
module.exports = {
  admin,
  db: () => admin.firestore(),
  auth: () => admin.auth(),
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
};
