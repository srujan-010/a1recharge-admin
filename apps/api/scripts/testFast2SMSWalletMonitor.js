const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fast2smsService = require('../services/fast2sms.service');
const fast2SMSWalletMonitorService = require('../services/fast2SMSWalletMonitor.service');
const PlanApiSettings = require('../models/PlanApiSettings');

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n==========================================================');
    console.log('  FAST2SMS WALLET MONITOR - TEST SCENARIOS (1 to 10)       ');
    console.log('==========================================================\n');

    // Reset initial MongoDB alertState
    await PlanApiSettings.updateOne(
      { key: 'GLOBAL_PLANAPI_SETTINGS' },
      {
        $set: {
          'alertState.fast2smsAlertSent': false,
          'alertState.lastFast2smsAlertAt': null,
          'alertState.lastFast2smsAlertBalance': null,
        },
      },
      { upsert: true }
    );

    // Mock fast2smsService.sendSMS to intercept and verify parameters
    let sentSMSList = [];
    fast2smsService.sendSMS = async (params) => {
      sentSMSList.push(params);
      console.log(`  [MOCK FAST2SMS SMS INTERCEPT] Phone: ${params.phone} | Msg Preview: "${params.message.split('\n')[0]}"`);
      return { success: true, requestId: 'req_mock_12345', data: { return: true, request_id: 'req_mock_12345' } };
    };

    // Helper to mock fast2smsService.getWalletBalance
    const mockFast2SMSBalance = (walletBalance, status = 'Connected') => {
      fast2smsService.getWalletBalance = async () => ({
        provider: 'Fast2SMS',
        walletBalance,
        smsCount: 96,
        status,
      });
    };

    // --- TEST 1: balance = ₹100 ---
    console.log('--- TEST 1: balance = ₹100.00 ---');
    mockFast2SMSBalance(100.00);
    sentSMSList = [];
    let res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentSMSList.length === 0 ? '✓ PASS: No SMS sent.' : '✗ FAIL: SMS sent unexpectedly.');

    // --- TEST 2: balance = ₹26 ---
    console.log('\n--- TEST 2: balance = ₹26.00 ---');
    mockFast2SMSBalance(26.00);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentSMSList.length === 0 ? '✓ PASS: No SMS sent.' : '✗ FAIL: SMS sent unexpectedly.');

    // --- TEST 3: balance = ₹25.00 (Entering Low State) ---
    console.log('\n--- TEST 3: balance = ₹25.00 (Entering Low State) ---');
    mockFast2SMSBalance(25.00);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentSMSList.length === 1 && sentSMSList[0].message.includes('Current Balance: ₹25.00')
      ? '✓ PASS: Sent ONE Fast2SMS SMS alert containing "Current Balance: ₹25.00".'
      : '✗ FAIL: Alert not sent correctly.');

    // --- TEST 4: balance = ₹24.50 (Low state already active) ---
    console.log('\n--- TEST 4: balance = ₹24.50 (Consecutive check) ---');
    mockFast2SMSBalance(24.50);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)} | Reason = ${res.reason}`);
    console.log(sentSMSList.length === 0 && res.reason === 'ALREADY_ALERTED'
      ? '✓ PASS: Duplicate SMS prevented by persistent DB state.'
      : '✗ FAIL: Duplicate SMS sent.');

    // --- TEST 5: balance = ₹10.00 ---
    console.log('\n--- TEST 5: balance = ₹10.00 ---');
    mockFast2SMSBalance(10.00);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)} | Reason = ${res.reason}`);
    console.log(sentSMSList.length === 0 && res.reason === 'ALREADY_ALERTED'
      ? '✓ PASS: Duplicate SMS prevented.'
      : '✗ FAIL: Duplicate SMS sent.');

    // --- TEST 6: balance = ₹0.00 ---
    console.log('\n--- TEST 6: balance = ₹0.00 ---');
    mockFast2SMSBalance(0.00);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)} | Reason = ${res.reason}`);
    console.log(sentSMSList.length === 0 && res.reason === 'ALREADY_ALERTED'
      ? '✓ PASS: Duplicate SMS prevented.'
      : '✗ FAIL: Duplicate SMS sent.');

    // --- TEST 7: balance recovers to ₹30.00 ---
    console.log('\n--- TEST 7: balance = ₹30.00 (Recovery above threshold) ---');
    mockFast2SMSBalance(30.00);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status}`);
    const checkSettings = await fast2SMSWalletMonitorService.getSettings();
    console.log(!checkSettings.alertState.fast2smsAlertSent
      ? '✓ PASS: Low-balance alert state reset in MongoDB.'
      : '✗ FAIL: Alert state not reset.');

    // --- TEST 8: balance drops to ₹24.05 again ---
    console.log('\n--- TEST 8: balance = ₹24.05 again (Re-crossed threshold) ---');
    mockFast2SMSBalance(24.05);
    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Status = ${res.status} | Alert Sent = ${Boolean(res.alertSent)}`);
    console.log(sentSMSList.length === 1 && sentSMSList[0].message.includes('Current Balance: ₹24.05')
      ? '✓ PASS: Sent NEW Fast2SMS SMS alert with Current Balance ₹24.05 after recovery reset.'
      : '✗ FAIL: Re-armed alert failed.');

    // --- TEST 9: Simultaneous monitoring processes (Atomic Concurrency Test) ---
    console.log('\n--- TEST 9: Two simultaneous checks both receiving balance = ₹24.00 ---');
    // Reset state first to simulate new transition
    await PlanApiSettings.updateOne(
      { key: 'GLOBAL_PLANAPI_SETTINGS' },
      { $set: { 'alertState.fast2smsAlertSent': false } }
    );

    mockFast2SMSBalance(24.00);
    sentSMSList = [];
    const [concurrentRes1, concurrentRes2] = await Promise.all([
      fast2SMSWalletMonitorService.checkBalanceAndAlert(),
      fast2SMSWalletMonitorService.checkBalanceAndAlert(),
    ]);

    const sentCount = sentSMSList.length;
    console.log(`Concurrent execution result: Check 1 (AlertSent=${concurrentRes1.alertSent}) | Check 2 (AlertSent=${concurrentRes2.alertSent})`);
    console.log(sentCount === 1
      ? '✓ PASS: Exactly ONE Fast2SMS SMS notification sent across concurrent checks.'
      : `✗ FAIL: ${sentCount} SMS notifications sent during race condition.`);

    // --- TEST 10: Fast2SMS API Failure handling & Fail-safe ---
    console.log('\n--- TEST 10: Fast2SMS API Failure handling ---');
    // Reset state first
    await PlanApiSettings.updateOne(
      { key: 'GLOBAL_PLANAPI_SETTINGS' },
      { $set: { 'alertState.fast2smsAlertSent': false } }
    );

    mockFast2SMSBalance(15.00);
    fast2smsService.sendSMS = async () => ({
      success: false,
      error: 'Fast2SMS Gateway Timeout 504',
    });

    sentSMSList = [];
    res = await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    console.log(`Result: Checked = ${res.checked} | Alert Sent = ${res.alertSent} | Reason = ${res.reason}`);

    const finalSettings = await fast2SMSWalletMonitorService.getSettings();
    console.log(!finalSettings.alertState.fast2smsAlertSent
      ? '✓ PASS: Failed alert execution rolled back state in MongoDB (eligible for retry on next check).'
      : '✗ FAIL: Failed alert incorrectly marked as sent.');

    console.log('\n==========================================================');
    console.log('          ALL 10 TEST SCENARIOS COMPLETED                 ');
    console.log('==========================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
