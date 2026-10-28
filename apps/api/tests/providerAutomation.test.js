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

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    console.log('[TEST SETUP] Connected to MongoDB.');

    // Save originals for mocking
    const a1Provider = ProviderFactory.getProvider('A1Topup');
    const originalBalance = a1Provider.balance;
    const originalSendWa = fast2smsWhatsAppService.sendWhatsAppMessage;

    // Reset settings for testing
    await ProviderAutomationSettings.deleteMany({});
    await ProviderAutomationLog.deleteMany({});

    const settings = await providerAutomationService.getSettings();
    settings.enabled = true;
    settings.recipients = ['8275366399', '9100329521'];
    settings.currentThresholdState = 'NORMAL';
    settings.isRecovered = true;
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
    // TEST 1: Recharge SUCCESS, balance = ₹2,500 -> NO ALERT
    // ----------------------------------------------------
    providerAutomationService.lastSuccessfulCheckAt = null;
    a1Provider.balance = async () => ({ success: true, balance: 2500 });
    let waSendCount = 0;
    fast2smsWhatsAppService.sendWhatsAppMessage = async () => { waSendCount++; return { success: true, request_id: 'REQ_TEST_1' }; };

    let log1 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_001',
      amount: 10,
    });
    assertTest(log1.overallStatus === 'NO_ALERT_NEEDED' && waSendCount === 0, 'TEST 1: Balance = ₹2,500 -> No Alert Sent (Safe >= ₹2,000)');

    // ----------------------------------------------------
    // TEST 2: Recharge SUCCESS, balance = ₹1,800 -> ALERT TO BOTH (LOW_2000)
    // ----------------------------------------------------
    providerAutomationService.lastSuccessfulCheckAt = null;
    a1Provider.balance = async () => ({ success: true, balance: 1800 });
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
      recipientsCalled.includes('8275366399') && 
      recipientsCalled.includes('9100329521') &&
      log2.thresholdLevel === 'LOW_2000' &&
      log2.messageId === 40230,
      'TEST 2: Balance = ₹1,800 -> Warning Alert Sent to Both Recipients (LOW_2000, 40230)'
    );

    // ----------------------------------------------------
    // TEST 3: Duplicate Recharge at ₹1,800 -> ALREADY_ALERTED (No Resend)
    // ----------------------------------------------------
    waSendCount = 0;
    let log3 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_003',
      amount: 10,
    });
    assertTest(log3.overallStatus === 'ALREADY_ALERTED' && waSendCount === 0, 'TEST 3: Duplicate Recharge at ₹1,800 -> ALREADY_ALERTED (Duplicate Suppressed)');

    // ----------------------------------------------------
    // TEST 4: Recharge SUCCESS, balance = ₹450 -> ALERT TO BOTH (CRITICAL_500)
    // ----------------------------------------------------
    providerAutomationService.lastSuccessfulCheckAt = null;
    a1Provider.balance = async () => ({ success: true, balance: 450 });
    waSendCount = 0;

    let log4 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_004',
      amount: 10,
    });
    assertTest(
      log4.overallStatus === 'ALERT_SENT' && 
      waSendCount === 2 && 
      log4.thresholdLevel === 'CRITICAL_500' &&
      log4.messageId === 40237,
      'TEST 4: Balance = ₹450 -> Critical Alert Sent to Both Recipients (CRITICAL_500, 40237)'
    );

    // ----------------------------------------------------
    // TEST 5: Invalid Balance Response -> ERROR_SKIPPED (No False Alert)
    // ----------------------------------------------------
    providerAutomationService.lastSuccessfulCheckAt = null;
    a1Provider.balance = async () => { throw new Error('Provider Timeout'); };
    waSendCount = 0;

    let log5 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_005',
      amount: 10,
    });
    assertTest(log5.overallStatus === 'ERROR_SKIPPED' && waSendCount === 0, 'TEST 5: Provider Balance Error -> ERROR_SKIPPED (No False Alert)');

    // ----------------------------------------------------
    // TEST 6: Recipient 1 Succeeds, Recipient 2 Fails -> PARTIAL_SUCCESS
    // ----------------------------------------------------
    providerAutomationService.lastSuccessfulCheckAt = null;
    const settings6 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    settings6.thresholdAlerts.LOW_1000.alertSent = false;
    settings6.thresholdAlerts.LOW_1000.deliveredRecipients = [];
    await settings6.save();

    a1Provider.balance = async () => ({ success: true, balance: 950 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      if (opts.numbers === '8275366399') throw new Error('Network Timeout');
      return { success: true, request_id: 'REQ_SUCCESS' };
    };

    let log6 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_006',
      amount: 10,
    });
    assertTest(
      log6.overallStatus === 'PARTIAL_SUCCESS' &&
      log6.recipientsStatus.find(r => r.recipient === '9100329521')?.status === 'SENT' &&
      log6.recipientsStatus.find(r => r.recipient === '8275366399')?.status === 'FAILED',
      'TEST 6: Partial Recipient Failure -> PARTIAL_SUCCESS Logged & Retryable'
    );

    // ----------------------------------------------------
    // TEST 7: Idempotency -> Duplicate execution for same orderId returns existing log
    // ----------------------------------------------------
    waSendCount = 0;
    let log7 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'TEST_RECHARGE_006', // Same transaction ID as Test 6
      amount: 10,
    });
    assertTest(log7._id.toString() === log6._id.toString() && waSendCount === 0, 'TEST 7: Idempotency Check -> Duplicate Replay Prevented');

    // Restore original methods
    a1Provider.balance = originalBalance;
    fast2smsWhatsAppService.sendWhatsAppMessage = originalSendWa;

    console.log(`\n====================================================`);
    console.log(`  TEST RESULTS: ${testPassCount}/${totalTests} PASSED`);
    console.log(`====================================================\n`);

    process.exit(testPassCount === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  }
}

runAutomationTests();
