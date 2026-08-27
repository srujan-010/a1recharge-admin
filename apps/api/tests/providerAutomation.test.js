const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const providerAutomationService = require('../services/providerAutomation.service');
const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('../services/providers/provider.factory');
const fast2smsWhatsAppService = require('../services/fast2smsWhatsApp.service');

async function runAutomationTests() {
  console.log('\n====================================================');
  console.log('  RUNNING PROVIDER WALLET LOW BALANCE AUTOMATION TESTS');
  console.log('====================================================\n');

  let mongoConnected = false;
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('[TEST SETUP] Connected to MongoDB.');

    // Save originals for mocking
    const originalBalance = ProviderFactory.getProvider('A1Topup').balance;
    const originalSendWa = fast2smsWhatsAppService.sendWhatsAppMessage;

    // Reset settings for testing
    await ProviderAutomationSettings.deleteMany({});
    await ProviderAutomationLog.deleteMany({});

    const settings = await providerAutomationService.getSettings();
    settings.enabled = true;
    settings.threshold = 500;
    settings.recipients = ['9100329521', '8275366399'];
    await settings.save();

    let testPassCount = 0;
    let totalTests = 0;

    const assertTest = (condition, testName) => {
      totalTests++;
      if (condition) {
        testPassCount++;
        console.log(`✅ [PASS] ${testName}`);
      } else {
        console.error(`❌ [FAIL] ${testName}`);
      }
    };

    // ----------------------------------------------------
    // TEST 1: Recharge SUCCESS, balance = ₹600 -> NO ALERT
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => ({ success: true, balance: 600 });
    let waSendCount = 0;
    fast2smsWhatsAppService.sendWhatsAppMessage = async () => { waSendCount++; return { success: true, request_id: 'REQ_TEST_1' }; };

    let log1 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_001',
      amount: 10,
    });
    assertTest(log1.overallStatus === 'NO_ALERT_NEEDED' && waSendCount === 0, 'TEST 1: Balance = ₹600 -> No Alert Sent');

    // ----------------------------------------------------
    // TEST 2: Recharge SUCCESS, balance = ₹499 -> ALERT TO BOTH
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => ({ success: true, balance: 499 });
    waSendCount = 0;
    let recipientsCalled = [];
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      waSendCount++;
      recipientsCalled.push(opts.numbers);
      return { success: true, request_id: `REQ_TEST_${opts.numbers}` };
    };

    let log2 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_002',
      amount: 10,
    });
    assertTest(
      log2.overallStatus === 'ALERT_SENT' && 
      waSendCount === 2 && 
      recipientsCalled.includes('9100329521') && 
      recipientsCalled.includes('8275366399'),
      'TEST 2: Balance = ₹499 -> Alert Sent to Both Recipients'
    );

    // ----------------------------------------------------
    // TEST 3: Recharge SUCCESS, balance = ₹500 -> NO ALERT (Strict < 500)
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => ({ success: true, balance: 500 });
    waSendCount = 0;

    let log3 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_003',
      amount: 10,
    });
    assertTest(log3.overallStatus === 'NO_ALERT_NEEDED' && waSendCount === 0, 'TEST 3: Balance = ₹500 -> No Alert Sent (Strict < 500)');

    // ----------------------------------------------------
    // TEST 4: Recharge SUCCESS, balance = ₹100 -> ALERT TO BOTH
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => ({ success: true, balance: 100 });
    waSendCount = 0;

    let log4 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_004',
      amount: 10,
    });
    assertTest(log4.overallStatus === 'ALERT_SENT' && waSendCount === 2, 'TEST 4: Balance = ₹100 -> Alert Sent to Both Recipients');

    // ----------------------------------------------------
    // TEST 7: Invalid Balance Response -> ERROR_SKIPPED (No False Alert)
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => { throw new Error('Provider Timeout'); };
    waSendCount = 0;

    let log7 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_007',
      amount: 10,
    });
    assertTest(log7.overallStatus === 'ERROR_SKIPPED' && waSendCount === 0, 'TEST 7: Provider Balance Error -> ERROR_SKIPPED (No False Alert)');

    // ----------------------------------------------------
    // TEST 8: Recipient 1 Succeeds, Recipient 2 Fails -> PARTIAL_SUCCESS
    // ----------------------------------------------------
    ProviderFactory.getProvider('A1Topup').balance = async () => ({ success: true, balance: 450 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      if (opts.numbers === '8275366399') throw new Error('Network Timeout');
      return { success: true, request_id: 'REQ_SUCCESS' };
    };

    let log8 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_008',
      amount: 10,
    });
    assertTest(
      log8.overallStatus === 'PARTIAL_SUCCESS' &&
      log8.recipientsStatus.find(r => r.recipient === '9100329521')?.status === 'SENT' &&
      log8.recipientsStatus.find(r => r.recipient === '8275366399')?.status === 'FAILED',
      'TEST 8: Partial Recipient Failure -> PARTIAL_SUCCESS Logged'
    );

    // ----------------------------------------------------
    // TEST 9: Idempotency -> Duplicate execution returns existing log
    // ----------------------------------------------------
    waSendCount = 0;
    let log9 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_008', // Same transaction ID as Test 8
      amount: 10,
    });
    assertTest(log9._id.toString() === log8._id.toString() && waSendCount === 0, 'TEST 9: Idempotency Check -> Duplicate Replay Prevented');

    // Restore original methods
    ProviderFactory.getProvider('A1Topup').balance = originalBalance;
    fast2smsWhatsAppService.sendWhatsAppMessage = originalSendWa;

    console.log(`\n====================================================`);
    console.log(`  TEST RESULTS: ${testPassCount}/${totalTests} PASSED`);
    console.log(`====================================================\n`);

    if (mongoConnected) await mongoose.disconnect();
    process.exit(testPassCount === totalTests ? 0 : 1);
  } catch (err) {
    console.error('[TEST SUITE ERROR]', err);
    if (mongoConnected) await mongoose.disconnect();
    process.exit(1);
  }
}

runAutomationTests();
