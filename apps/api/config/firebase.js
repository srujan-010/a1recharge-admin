const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

const DEFAULT_PROJECT_ID = 'shopulse-a954e';
let cachedApp = null;

const initFirebaseAdmin = () => {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  try {
    let serviceAccount = null;
    let authSource = null;

    // 1. Check local service-account.json
    const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
      authSource = 'service-account.json';
    } 
    // 2. Check FIREBASE_SERVICE_ACCOUNT environment variable (JSON string or object)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      try {
        serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
        authSource = 'FIREBASE_SERVICE_ACCOUNT env var';
      } catch (parseErr) {
        console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
      }
    } 
    // 3. Check individual env vars
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      authSource = 'FIREBASE_PROJECT_ID individual env vars';
    }

    const projectId = (serviceAccount && (serviceAccount.project_id || serviceAccount.projectId)) 
      || process.env.FIREBASE_PROJECT_ID 
      || DEFAULT_PROJECT_ID;

    if (serviceAccount) {
      cachedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId
      });
      console.log(`[Firebase] Initialized successfully using ${authSource}. Explicit Project ID: "${projectId}"`);
    } else {
      console.warn(`[Firebase] Warning: No service account credentials found. Push notifications disabled until credentials provided for Project ID: "${DEFAULT_PROJECT_ID}".`);
      cachedApp = null;
    }
  } catch (error) {
    console.error(`[Firebase] Initialization Error for project "${DEFAULT_PROJECT_ID}":`, error.message);
    cachedApp = null;
  }

  return cachedApp;
};

const getFirebaseApp = () => {
  if (cachedApp) return cachedApp;
  return initFirebaseAdmin();
};

module.exports = { getApp: getFirebaseApp, initFirebaseAdmin };
