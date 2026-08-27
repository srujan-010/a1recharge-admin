const mongoose = require('mongoose');
require('dotenv').config();

const planApiFetchMonitorService = require('../services/planApiFetchMonitor.service');
const msg91WhatsAppService = require('../services/msg91WhatsApp.service');
const PlanApiSettings = require('../models/PlanApiSettings');

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n========================================================');
    console.log('  PLANSAPI FETCH LIMIT MONITOR - TEST SCENARIOS (1 to 8) ');
    console.log('========================================================\n');

    // Reset alertState in MongoDB for clean test setup
    await PlanApiSettings.updateOne(
      { key: 'GLOBAL_PLANAPI_SETTINGS' },
      {
        $set: {
          'alertState.hitAlertSent': false,
          'alertState.lastHitAlertAt': null,
          'alertState.lastAlertRemainingHits': null,
        },
      },
      { upsert: true }
    );

    // Mock msg91WhatsAppService.sendTemplateMessage to intercept and verify params without sending live SMS during test
    let sentMessages = [];
    const originalSend = msg91WhatsAppService.sendTemplateMessage.bind(msg91WhatsAppService);

    msg91WhatsAppService.sendTemplateMessage = async (params) => {
      sentMessages.push(params);
      console.log(`  [MOCK MSG91 INTERCEPT] Template: ${params.templateName} (ID: ${params.templateId}) | Phone: ${params.phone} | Var {{1}}: "${params.variables['1']}"`);
      return { success: true, data: { status: 'mock_success' } };
    };

    // --- TEST 1: remainingFetches = 1000 ---
    console.log('--- TEST 1: remainingFetches = 1000 ---');
    sentMessages = [];
    let res = await planApiFetchMonitorService.processRemainingFetches(1000);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentMessages.length === 0 ? '✓ PASS: No WhatsApp sent.' : '✗ FAIL: WhatsApp sent unexpectedly.');

    // --- TEST 2: remainingFetches = 501 ---
    console.log('\n--- TEST 2: remainingFetches = 501 ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(501);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentMessages.length === 0 ? '✓ PASS: No WhatsApp sent.' : '✗ FAIL: WhatsApp sent unexpectedly.');

    // --- TEST 3: remainingFetches = 500 (At threshold) ---
    console.log('\n--- TEST 3: remainingFetches = 500 (Entering Low State) ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(500);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentMessages.length === 1 && sentMessages[0].variables['1'] === '500' && sentMessages[0].templateId === '30045'
      ? '✓ PASS: Sent ONE WhatsApp with variable {{1}} = "500" and Template ID 30045.'
      : '✗ FAIL: Alert not sent correctly.');

    // --- TEST 4: remainingFetches = 499 (Low state already active) ---
    console.log('\n--- TEST 4: remainingFetches = 499 (Consecutive low request) ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(499);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)} | Reason = ${res.reason}`);
    console.log(sentMessages.length === 0 && res.reason === 'ALREADY_ALERTED'
      ? '✓ PASS: Duplicate WhatsApp prevented.'
      : '✗ FAIL: Duplicate WhatsApp sent.');

    // --- TEST 5: remainingFetches = 100 ---
    console.log('\n--- TEST 5: remainingFetches = 100 ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(100);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)} | Reason = ${res.reason}`);
    console.log(sentMessages.length === 0 && res.reason === 'ALREADY_ALERTED'
      ? '✓ PASS: Duplicate WhatsApp prevented.'
      : '✗ FAIL: Duplicate WhatsApp sent.');

    // --- TEST 6: remainingFetches = 700 (Recovery) ---
    console.log('\n--- TEST 6: remainingFetches = 700 (Recovery above threshold) ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(700);
    console.log(`Result: Status = ${res.status}`);
    const checkSettings = await planApiFetchMonitorService.getSettings();
    console.log(!checkSettings.alertState.hitAlertSent
      ? '✓ PASS: Alert state reset in MongoDB.'
      : '✗ FAIL: Alert state not reset.');

    // --- TEST 7: remainingFetches = 500 again (Re-armed state) ---
    console.log('\n--- TEST 7: remainingFetches = 500 again (Re-crossed threshold) ---');
    sentMessages = [];
    res = await planApiFetchMonitorService.processRemainingFetches(500);
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentMessages.length === 1 && sentMessages[0].variables['1'] === '500'
      ? '✓ PASS: Sent NEW WhatsApp alert after recovery reset.'
      : '✗ FAIL: Re-armed alert failed.');

    // --- TEST 8: Simultaneous plan-fetch requests (Atomic Concurrency Test) ---
    console.log('\n--- TEST 8: Two simultaneous requests both receiving remainingFetches = 450 ---');
    // Reset state first to simulate new transition
    await PlanApiSettings.updateOne(
      { key: 'GLOBAL_PLANAPI_SETTINGS' },
      { $set: { 'alertState.hitAlertSent': false } }
    );

    sentMessages = [];
    // Run 2 simultaneous calls concurrently via Promise.all
    const [concurrentRes1, concurrentRes2] = await Promise.all([
      planApiFetchMonitorService.processRemainingFetches(450),
      planApiFetchMonitorService.processRemainingFetches(450),
    ]);

    const sentCount = sentMessages.length;
    console.log(`Concurrent execution result: Request 1 (AlertSent=${concurrentRes1.alertSent}) | Request 2 (AlertSent=${concurrentRes2.alertSent})`);
    console.log(sentCount === 1
      ? '✓ PASS: Exactly ONE WhatsApp notification sent across concurrent requests.'
      : `✗ FAIL: ${sentCount} WhatsApp notifications sent during race condition.`);

    console.log('\n========================================================');
    console.log('          ALL 8 TEST SCENARIOS COMPLETED               ');
    console.log('========================================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
