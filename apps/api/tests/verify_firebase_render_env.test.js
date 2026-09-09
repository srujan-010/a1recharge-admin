const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Path to real service account to borrow valid key format for testing
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
let realCreds = null;
if (fs.existsSync(serviceAccountPath)) {
  realCreds = require(serviceAccountPath);
}

function clearFirebaseCache() {
  // Clear require cache for firebase modules to test isolated initializations
  const firebaseAdminApp = require('firebase-admin/app');
  const existingApps = firebaseAdminApp.getApps();
  for (const app of existingApps) {
    firebaseAdminApp.deleteApp(app).catch(() => {});
  }
  delete require.cache[require.resolve('../config/firebase')];
}

async function runRenderEnvTests() {
  console.log('========================================================');
  console.log('   RUNNING FIREBASE RENDER ENVIRONMENT SUITE');
  console.log('========================================================\n');

  if (!realCreds) {
    console.warn('⚠️ No local service-account.json found. Skipping real cryptographic cert parsing tests.');
    return;
  }

  const origEnv = { ...process.env };

  try {
    // -------------------------------------------------------------
    // TEST 1: Individual Render environment variables with \n escapes
    // -------------------------------------------------------------
    console.log('--- TEST 1: Render Individual Env Variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) ---');
    clearFirebaseCache();

    // Temporarily rename service-account.json so it tests purely env variables
    const tempPath = path.join(__dirname, '..', 'service-account.json.bak');
    fs.renameSync(serviceAccountPath, tempPath);

    try {
      // Format private key with literal \n escapes as Render sets them
      const escapedKey = realCreds.private_key.replace(/\n/g, '\\n');
      process.env.FIREBASE_PROJECT_ID = realCreds.project_id || 'shopulse-a954e';
      process.env.FIREBASE_CLIENT_EMAIL = realCreds.client_email;
      process.env.FIREBASE_PRIVATE_KEY = escapedKey;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      const { getApp, initFirebaseAdmin } = require('../config/firebase');
      const app = initFirebaseAdmin();

      assert(app !== null, 'Firebase App should initialize successfully with Render individual env vars');
      assert.strictEqual(app.name, '[DEFAULT]');
      console.log('✅ TEST 1 PASSED: Initialized with Render individual env vars.');

      // -------------------------------------------------------------
      // TEST 2: Private key wrapped in double quotes (common in cloud env paste)
      // -------------------------------------------------------------
      console.log('\n--- TEST 2: Private Key wrapped in double quotes ---');
      clearFirebaseCache();
      process.env.FIREBASE_PRIVATE_KEY = `"${escapedKey}"`;

      const fb2 = require('../config/firebase');
      const app2 = fb2.initFirebaseAdmin();
      assert(app2 !== null, 'Firebase App should handle quoted private key string');
      console.log('✅ TEST 2 PASSED: Initialized with quoted private key.');

      // -------------------------------------------------------------
      // TEST 3: Private key with escaped quotes and \\r\\n escapes
      // -------------------------------------------------------------
      console.log('\n--- TEST 3: Private Key with escaped quotes and carriage returns ---');
      clearFirebaseCache();
      const escapedWithCarriage = realCreds.private_key.replace(/\n/g, '\\r\\n');
      process.env.FIREBASE_PRIVATE_KEY = `\\"${escapedWithCarriage}\\"`;

      const fb3 = require('../config/firebase');
      const app3 = fb3.initFirebaseAdmin();
      assert(app3 !== null, 'Firebase App should handle escaped quotes and \\r\\n');
      console.log('✅ TEST 3 PASSED: Initialized with escaped quotes and \\r\\n.');

      // -------------------------------------------------------------
      // TEST 4: Missing credentials fail gracefully without crashing
      // -------------------------------------------------------------
      console.log('\n--- TEST 4: Missing credentials fails gracefully ---');
      clearFirebaseCache();
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      const fb4 = require('../config/firebase');
      const app4 = fb4.initFirebaseAdmin();
      assert.strictEqual(app4, null, 'Firebase App should be null when no credentials exist');
      console.log('✅ TEST 4 PASSED: Returns null gracefully when credentials are not supplied.');

      // -------------------------------------------------------------
      // TEST 5: Verify firebasePushController responds with updated message
      // -------------------------------------------------------------
      console.log('\n--- TEST 5: Verify Controller error response message ---');
      const { sendFCMNotification, testFCMNotification } = require('../controllers/admin/firebasePushController');

      let jsonPayload = null;
      let statusCode = 200;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        }
      };

      const reqTest = {
        body: {
          fcmToken: 'some_token',
          title: 'Hello',
          body: 'World'
        }
      };

      await testFCMNotification(reqTest, res, () => {});
      assert.strictEqual(statusCode, 400);
      assert(jsonPayload.message.includes('FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY'),
        `Expected message to reference env vars, got: "${jsonPayload.message}"`);
      console.log('✅ TEST 5 PASSED: Error response properly guides the operator on environment variables.');

    } finally {
      // Always restore service-account.json
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, serviceAccountPath);
      }
    }

    // -------------------------------------------------------------
    // TEST 6: Verify Localhost mode with service-account.json intact
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Localhost mode with service-account.json ---');
    clearFirebaseCache();
    process.env = { ...origEnv };

    const fbLocal = require('../config/firebase');
    const appLocal = fbLocal.initFirebaseAdmin();
    assert(appLocal !== null, 'Localhost initialization with service-account.json must succeed');
    console.log('✅ TEST 6 PASSED: Localhost mode functions cleanly.');

    console.log('\n========================================================');
    console.log('🎉 ALL RENDER & LOCALHOST TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');

  } finally {
    process.env = origEnv;
    clearFirebaseCache();
  }
}

runRenderEnvTests().catch(err => {
  console.error('❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
