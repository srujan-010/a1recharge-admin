const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DEFAULT_PROJECT_ID = 'shopulse-a954e';
let cachedApp = null;
let lastInitError = null;
let lastAuthSource = null;

/**
 * Strips outer single or double quotes
 */
const stripQuotes = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('\\"') && s.endsWith('\\"'))
  ) {
    if (s.startsWith('\\"') && s.endsWith('\\"')) {
      s = s.slice(2, -2).trim();
    } else {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
};

/**
 * Normalizes private key string from all cloud environment formats:
 * - Escaped newlines (\\n, \\r\\n, \r\n)
 * - Wrapping quotes ("...", '...', \"...\")
 * - Single-line pasted keys where newlines became spaces
 * - Reconstructs valid 64-column PEM format and verifies with Node crypto.
 */
const formatPrivateKey = (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string') return null;
  let key = stripQuotes(rawKey);

  // Convert all escaped newline variations to standard newlines
  key = key.replace(/\\\\r\\\\n/g, '\n')
           .replace(/\\\\n/g, '\n')
           .replace(/\\r\\n/g, '\n')
           .replace(/\\n/g, '\n')
           .replace(/\r\n/g, '\n');

  const headerMatch = key.match(/-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/);
  const footerMatch = key.match(/-----END[ A-Z0-9_-]*PRIVATE KEY-----/);

  if (!headerMatch || !footerMatch) {
    return null;
  }

  const header = headerMatch[0];
  const footer = footerMatch[0];
  const startIndex = key.indexOf(header) + header.length;
  const endIndex = key.indexOf(footer);
  const rawBody = key.substring(startIndex, endIndex);

  // Clean the body: strip all whitespace/newlines
  const cleanBody = rawBody.replace(/[\s\r\n]+/g, '');
  if (!cleanBody || cleanBody.length < 50) {
    return null;
  }

  // Re-chunk into standard PEM 64-char lines
  const formattedBody = cleanBody.match(/.{1,64}/g)?.join('\n') || cleanBody;
  const pemKey = `${header}\n${formattedBody}\n${footer}\n`;

  // Verify using native Node crypto to ensure cert() will accept it
  try {
    crypto.createPrivateKey(pemKey);
    return pemKey;
  } catch {
    try {
      crypto.createPrivateKey(key);
      return key;
    } catch {
      return null;
    }
  }
};

const initFirebaseAdmin = () => {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  try {
    lastInitError = null;
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
      const raw = stripQuotes(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      try {
        serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (serviceAccount && (serviceAccount.private_key || serviceAccount.privateKey)) {
          const formatted = formatPrivateKey(serviceAccount.private_key || serviceAccount.privateKey);
          if (formatted) {
            serviceAccount.private_key = formatted;
            serviceAccount.privateKey = formatted;
          }
        }
        authSource = 'FIREBASE_SERVICE_ACCOUNT env var';
      } catch (parseErr) {
        console.warn('[FIREBASE] Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
      }
    }

    // 3. Check individual Render environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
    if (!serviceAccount) {
      const clientEmail = stripQuotes(process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL_ADDRESS || process.env.CLIENT_EMAIL);
      const rawKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATEKEY || process.env.PRIVATE_KEY;
      const privateKey = formatPrivateKey(rawKey);
      const projectId = stripQuotes(process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECTID || process.env.PROJECT_ID) || DEFAULT_PROJECT_ID;

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
      lastAuthSource = authSource;
      const resolvedProjectId = serviceAccount.project_id || serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
      const hasClientEmail = Boolean(serviceAccount.client_email || serviceAccount.clientEmail);
      const hasPrivateKey = Boolean(serviceAccount.private_key || serviceAccount.privateKey);

      // Safe Logging - never log private keys, tokens, or raw credentials
      console.log('[FIREBASE] Configuration detected');
      console.log(`[FIREBASE] Project ID: ${resolvedProjectId}`);
      console.log(`[FIREBASE] Client email configured: ${hasClientEmail ? 'YES' : 'NO'}`);
      console.log(`[FIREBASE] Private key configured: ${hasPrivateKey ? 'YES' : 'NO'}`);
      console.log('[FIREBASE] Service account configured: YES');

      cachedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: resolvedProjectId
      });

      console.log('[FIREBASE] Admin SDK initialized successfully');
    } else {
      console.log('[FIREBASE] Service account configured: NO');
      console.warn(`[FIREBASE] Warning: No valid Firebase Admin credentials found (checked service-account.json, FIREBASE_SERVICE_ACCOUNT, and FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY). Push notifications will be disabled.`);
      cachedApp = null;
    }
  } catch (error) {
    lastInitError = error;
    console.error(`[FIREBASE] Initialization Error for project "${DEFAULT_PROJECT_ID}":`, error.message);
    console.log('[FIREBASE] Service account configured: NO');
    cachedApp = null;
  }

  return cachedApp;
};

const getFirebaseApp = () => {
  if (cachedApp) return cachedApp;
  return initFirebaseAdmin();
};

const isConfigured = () => Boolean(cachedApp || getFirebaseApp());

const getDiagnosticStatus = () => {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATEKEY || process.env.PRIVATE_KEY;
  const rawClientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL_ADDRESS || process.env.CLIENT_EMAIL;
  const rawProjectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECTID || process.env.PROJECT_ID;

  return {
    isConfigured: Boolean(cachedApp || getFirebaseApp()),
    authSource: lastAuthSource,
    hasLocalJson: fs.existsSync(path.join(__dirname, '..', 'service-account.json')),
    hasServiceAccountEnv: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    hasProjectIdEnv: Boolean(rawProjectId),
    hasClientEmailEnv: Boolean(rawClientEmail),
    hasPrivateKeyEnv: Boolean(rawKey),
    privateKeyLength: rawKey ? rawKey.length : 0,
    privateKeyFormatValid: Boolean(formatPrivateKey(rawKey)),
    lastInitError: lastInitError ? lastInitError.message : null
  };
};

module.exports = { getApp: getFirebaseApp, initFirebaseAdmin, isConfigured, getDiagnosticStatus };
