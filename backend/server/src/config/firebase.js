const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  // Check if service account credentials are provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'thesouthticketmanagement'
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
    console.warn('⚠️ Firebase Authentication will not work without credentials');
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization failed:', error.message);
}

module.exports = {
  firebaseApp,
  auth: firebaseApp ? firebaseApp.auth() : null
};
