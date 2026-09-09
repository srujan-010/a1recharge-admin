const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

const DEFAULT_PROJECT_ID = 'shopulse-a954e';
let cachedApp = null;

/**
 * Normalizes private key string from various environment variable formats
 * (e.g. Render with escaped \n, surrounding quotes, or raw newlines).
 */
const formatPrivateKey = (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string') return null;
  let key = rawKey.trim();

  // Strip wrapping double or single quotes (including escaped quotes) if present
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('\\"') && key.endsWith('\\"'))
  ) {
    if (key.startsWith('\\"') && key.endsWith('\\"')) {
      key = key.slice(2, -2).trim();
    } else {
      key = key.slice(1, -1).trim();
    }
  }

  // Convert all escaped newline variations to standard newlines
  key = key.replace(/\\\\r\\\\n/g, '\n')
           .replace(/\\\\n/g, '\n')
           .replace(/\\r\\n/g, '\n')
           .replace(/\\n/g, '\n')
           .replace(/\r\n/g, '\n');

  if (!key.includes('-----BEGIN') || !key.includes('PRIVATE KEY-----') || !key.includes('-----END')) {
    return null;
  }

  return key;
};

const initFirebaseAdmin = () => {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  try {
    let serviceAccount = null;
    let authSource = null;

    // 1. Check local service-account.json (for local development)
    const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      try {
        serviceAccount = require(serviceAccountPath);
        authSource = 'service-account.json';
      } catch (err) {
        console.warn('[FIREBASE] Warning: Failed to read service-account.json:', err.message);
      }
    }

    // 2. Check full FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_JSON env var if not loaded from file
    if (!serviceAccount && (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
      const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON).trim();
      try {
        serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
        authSource = 'FIREBASE_SERVICE_ACCOUNT env var';
      } catch (parseErr) {
        console.warn('[FIREBASE] Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
      }
    }

    // 3. Check individual Render environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
    if (!serviceAccount) {
      const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const privateKey = formatPrivateKey(rawKey);
      const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim() || DEFAULT_PROJECT_ID;

      if (clientEmail && privateKey) {
        serviceAccount = {
          projectId,
          project_id: projectId,
          clientEmail,
          client_email: clientEmail,
          privateKey,
          private_key: privateKey
        };
        authSource = 'Render individual env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)';
      }
    }

    if (serviceAccount) {
      const resolvedProjectId = serviceAccount.project_id || serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
      const hasClientEmail = Boolean(serviceAccount.client_email || serviceAccount.clientEmail);
      const hasPrivateKey = Boolean(serviceAccount.private_key || serviceAccount.privateKey);

      // Safe Logging - never log private keys, tokens, or raw credentials
      console.log('[FIREBASE] Configuration detected');
      console.log(`[FIREBASE] Project ID: ${resolvedProjectId}`);
      console.log(`[FIREBASE] Client email configured: ${hasClientEmail ? 'YES' : 'NO'}`);
      console.log(`[FIREBASE] Private key configured: ${hasPrivateKey ? 'YES' : 'NO'}`);

      cachedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: resolvedProjectId
      });

      console.log('[FIREBASE] Admin SDK initialized successfully');
    } else {
      console.warn(`[FIREBASE] Warning: No valid Firebase Admin credentials found (checked service-account.json, FIREBASE_SERVICE_ACCOUNT, and FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY). Push notifications will be disabled.`);
      cachedApp = null;
    }
  } catch (error) {
    console.error(`[FIREBASE] Initialization Error for project "${DEFAULT_PROJECT_ID}":`, error.message);
    cachedApp = null;
  }

  return cachedApp;
};

const getFirebaseApp = () => {
  if (cachedApp) return cachedApp;
  return initFirebaseAdmin();
};

module.exports = { getApp: getFirebaseApp, initFirebaseAdmin };
