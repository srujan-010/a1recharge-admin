const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const NotificationHistory = require('../models/NotificationHistory');
const { getApp, initFirebaseAdmin } = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');

async function runFcmTests() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
  console.log('Connecting to Mongo:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  try {
    console.log('\n====================================================');
    console.log('      RUNNING FIREBASE FCM ENGINE TEST SUITE        ');
    console.log('====================================================\n');

    // --- TEST 1: Firebase Singleton & Project ID Check ---
    console.log('--- TEST 1: Firebase Initialization & Project ID Verification ---');
    const app = getApp();
    if (!app) {
      throw new Error('Test 1 Failed: Firebase App is not initialized');
    }

    const projectId = app.options.projectId || app.options.credential?.projectId;
    console.log(`[TEST 1] Active Firebase App Name: "${app.name}", Project ID: "${projectId}"`);

    if (projectId !== 'shopulse-a954e') {
      throw new Error(`Test 1 Failed: Expected Project ID "shopulse-a954e", got "${projectId}"`);
    }
    console.log('✅ TEST 1 PASSED: Firebase Admin SDK initialized with explicit Project ID "shopulse-a954e".');

    // --- TEST 2: Messaging Service Instance Check ---
    console.log('\n--- TEST 2: Messaging Service Acquisition ---');
    const messaging = getMessaging(app);
    if (!messaging) {
      throw new Error('Test 2 Failed: Unable to acquire getMessaging instance');
    }
    console.log('✅ TEST 2 PASSED: Firebase Messaging instance acquired successfully.');

    // --- TEST 3: Stale Token Auto-Deactivation Test ---
    console.log('\n--- TEST 3: Stale FCM Token Auto-Deactivation & Failure Status ---');
    
    await User.deleteOne({ retailerId: 'TEST_STALE_FCM' });
    const fakeUser = await User.create({
      name: 'Stale Token Retailer',
      phone: '9999900000',
      retailerId: 'TEST_STALE_FCM',
      role: 'retailer',
      fcmToken: 'fcm_invalid_test_token_1234567890_abcdef',
      accountType: 'PERSONAL',
      status: 'active'
    });

    const dummyReq = {
      body: {
        recipients: [fakeUser._id],
        title: 'Test Notification',
        body: 'Testing stale token handling'
      },
      admin: { _id: fakeUser._id }
    };

    const dummyRes = {
      statusCode: 200,
      jsonPayload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.jsonPayload = payload;
        return this;
      }
    };

    const { sendFCMNotification } = require('../controllers/admin/firebasePushController');
    await sendFCMNotification(dummyReq, dummyRes, (err) => { throw err; });

    const result = dummyRes.jsonPayload;
    console.log('[TEST 3 API Output]:', JSON.stringify(result, null, 2));

    if (result.success !== false) {
      throw new Error(`Test 3 Failed: Expected success: false when all notifications fail, got ${result.success}`);
    }

    if (result.total !== 1 || result.sent !== 0 || result.failed !== 1) {
      throw new Error(`Test 3 Failed: Counts mismatch. Expected total=1, sent=0, failed=1, got ${result.total}/${result.sent}/${result.failed}`);
    }

    // Verify token auto-deactivation in DB
    const updatedUser = await User.findById(fakeUser._id);
    if (updatedUser.fcmToken !== null) {
      throw new Error(`Test 3 Failed: Stale FCM token was NOT deactivated in MongoDB`);
    }
    console.log('✅ TEST 3 PASSED: All-failed returns success: false, counts total=1, sent=0, failed=1, and stale token deactivated in DB.');

    // Cleanup test user
    await User.deleteOne({ _id: fakeUser._id });
    await NotificationHistory.deleteMany({ userId: fakeUser._id });

    console.log('\n====================================================');
    console.log('🎉 ALL FIREBASE FCM ENGINE TESTS PASSED CLEANLY!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ FCM ENGINE TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runFcmTests();
