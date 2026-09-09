const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

const DEFAULT_PROJECT_ID = 'shopulse-a954e';
let cachedApp = null;

/**
 * Normalizes private key string from environment variable.
 * Preserves the exact key bytes and replaces literal '\n' sequences with standard newlines.
 */
const parsePrivateKey = (key) => {
  if (!key || typeof key !== 'string') return null;
  let normalized = key.trim();

  while (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('\\"') && normalized.endsWith('\\"'))
  ) {
    if (normalized.startsWith('\\"') && normalized.endsWith('\\"')) {
      normalized = normalized.slice(2, -2).trim();
    } else {
      normalized = normalized.slice(1, -1).trim();
    }
  }

  normalized = normalized
    .replace(/\\\\r\\\\n/g, '\n')
    .replace(/\\\\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '');

  return normalized;
};

let lastInitError = null;

const initFirebaseAdmin = () => {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  console.log('[FIREBASE] Initializing Firebase Admin SDK');
  lastInitError = null;

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

    // 2. Check full FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_JSON env var
    if (!serviceAccount && (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      try {
        serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (serviceAccount && (serviceAccount.private_key || serviceAccount.privateKey)) {
          const parsed = parsePrivateKey(serviceAccount.private_key || serviceAccount.privateKey);
          serviceAccount.private_key = parsed;
          serviceAccount.privateKey = parsed;
        }
        authSource = 'FIREBASE_SERVICE_ACCOUNT env var';
      } catch (parseErr) {
        console.warn('[FIREBASE] Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
      }
    }

    // 3. Check individual Render environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
    if (!serviceAccount) {
      const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim() || DEFAULT_PROJECT_ID;
      const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL_ADDRESS || process.env.CLIENT_EMAIL || '').trim();
      const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATEKEY || process.env.PRIVATE_KEY;
      const privateKey = parsePrivateKey(rawPrivateKey);

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

    const projectIdConfigured = Boolean(process.env.FIREBASE_PROJECT_ID || (serviceAccount && (serviceAccount.project_id || serviceAccount.projectId)));
    const clientEmailConfigured = Boolean(serviceAccount && (serviceAccount.client_email || serviceAccount.clientEmail));
    const privateKeyConfigured = Boolean(serviceAccount && (serviceAccount.private_key || serviceAccount.privateKey));
    const activeKey = serviceAccount ? (serviceAccount.private_key || serviceAccount.privateKey || '') : '';
    const privateKeyFormatValid = Boolean(activeKey && activeKey.includes('BEGIN') && activeKey.includes('PRIVATE KEY'));

    console.log(`[FIREBASE] Project ID configured: ${projectIdConfigured ? 'YES' : 'NO'}`);
    console.log(`[FIREBASE] Client email configured: ${clientEmailConfigured ? 'YES' : 'NO'}`);
    console.log(`[FIREBASE] Private key configured: ${privateKeyConfigured ? 'YES' : 'NO'}`);
    console.log(`[FIREBASE] Private key format valid: ${privateKeyFormatValid ? 'YES' : 'NO'}`);

    if (serviceAccount) {
      const resolvedProjectId = serviceAccount.project_id || serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;

      cachedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: resolvedProjectId
      });

      console.log('[FIREBASE] Admin SDK initialized successfully');
    } else {
      lastInitError = 'No valid Firebase Admin credentials found (FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY missing)';
      console.error('[FIREBASE] Admin SDK initialization FAILED');
      console.error('[FIREBASE] Error:', lastInitError);
      cachedApp = null;
    }
  } catch (error) {
    lastInitError = error.message;
    console.error('[FIREBASE] Admin SDK initialization FAILED');
    console.error('[FIREBASE] Error:', error.message);
    cachedApp = null;
  }

  return cachedApp;
};

const getFirebaseApp = () => {
  if (cachedApp) return cachedApp;
  return initFirebaseAdmin();
};

const isConfigured = () => Boolean(cachedApp || getFirebaseApp());

const getInitError = () => lastInitError;

module.exports = { getApp: getFirebaseApp, initFirebaseAdmin, isConfigured, getInitError };
