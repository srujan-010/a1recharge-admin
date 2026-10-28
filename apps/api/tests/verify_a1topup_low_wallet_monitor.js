const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const providerAutomationService = require('../services/providerAutomation.service');
const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('../services/providers/provider.factory');
const fast2smsWhatsAppService = require('../services/fast2smsWhatsApp.service');

async function runComprehensiveTestSuite() {
  console.log('\n========================================================================');
  console.log('   A1TOPUP THREE-TEMPLATE WALLET MONITOR - COMPREHENSIVE TEST SUITE     ');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assertCondition = (condition, testName, extraDetails = '') => {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
      if (extraDetails) console.log(`   └─ ${extraDetails}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (extraDetails) console.error(`   └─ ${extraDetails}`);
    }
  };

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    console.log('[TEST SETUP] Connected to MongoDB.');

    // Save original provider & whatsapp service methods for mocking
    const a1Provider = ProviderFactory.getProvider('A1Topup');
    const originalBalance = a1Provider.balance;
    const originalSendWa = fast2smsWhatsAppService.sendWhatsAppMessage;

    // Clean test state in MongoDB
    await ProviderAutomationSettings.deleteMany({});
    await ProviderAutomationLog.deleteMany({});

    // Initialize fresh settings
    const settings = await providerAutomationService.getSettings();
    settings.enabled = true;
    settings.recipients = ['8275366399', '9100329521'];
    settings.channel = 'WHATSAPP';
    settings.currentThresholdState = 'NORMAL';
    settings.isRecovered = true;
    await settings.save();

    let messagesDispatched = [];

    // =========================================================================
    // SCENARIO 1: Balance ₹2,500 -> No alert
    // =========================================================================
    console.log('\n--- SCENARIO 1: Balance ₹2,500 (Above ₹2,000 Threshold) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 2500 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: 'REQ_WA_2500' };
    };

    const res1 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'MANUAL_CHECK' });
    assertCondition(
      res1.checked === true &&
      res1.status === 'NORMAL' &&
      res1.alertSent === false &&
      messagesDispatched.length === 0,
      'Scenario 1: Balance ₹2,500 -> Status NORMAL, 0 alerts dispatched',
      `Status: ${res1.status}, messagesDispatched: ${messagesDispatched.length}`
    );

    // =========================================================================
    // SCENARIO 2: Balance ₹1,800 -> One ₹2,000 warning to each recipient
    // =========================================================================
    console.log('\n--- SCENARIO 2: Balance ₹1,800 (₹2,000 Warning Range) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1800 });

    const res2 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECHARGE_EVENT' });
    const calledNumbers2 = messagesDispatched.map(m => m.numbers);
    const usedMsgId2 = messagesDispatched[0]?.messageId;
    assertCondition(
      res2.checked === true &&
      res2.status === 'LOW_2000' &&
      res2.alertSent === true &&
      messagesDispatched.length === 2 &&
      calledNumbers2.includes('8275366399') &&
      calledNumbers2.includes('9100329521') &&
      usedMsgId2 === 40230,
      'Scenario 2: Balance ₹1,800 -> One ₹2,000 warning (Template 40230) to each recipient',
      `Status: ${res2.status}, Recipients: [${calledNumbers2.join(', ')}], MessageId: ${usedMsgId2}`
    );

    // =========================================================================
    // SCENARIO 3: Balance remains ₹1,800 after another recharge -> No duplicate warning
    // =========================================================================
    console.log('\n--- SCENARIO 3: Balance Remains ₹1,800 After Another Recharge ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1800 });

    const res3 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
      orderId: 'RECHARGE_TXN_003',
      amount: 199,
    });
    assertCondition(
      res3.overallStatus === 'ALREADY_ALERTED' &&
      messagesDispatched.length === 0,
      'Scenario 3: Balance remains ₹1,800 -> Duplicate suppressed (0 messages sent)',
      `Log Status: ${res3.overallStatus}, Dispatched Count: ${messagesDispatched.length}`
    );

    // =========================================================================
    // SCENARIO 4: Balance drops to ₹950 -> One ₹1,000 alert to each recipient
    // =========================================================================
    console.log('\n--- SCENARIO 4: Balance Drops to ₹950 (₹1,000 High-Priority Range) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 950 });

    const res4 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECHARGE_EVENT' });
    const calledNumbers4 = messagesDispatched.map(m => m.numbers);
    const usedMsgId4 = messagesDispatched[0]?.messageId;
    assertCondition(
      res4.checked === true &&
      res4.status === 'LOW_1000' &&
      res4.alertSent === true &&
      messagesDispatched.length === 2 &&
      calledNumbers4.includes('8275366399') &&
      calledNumbers4.includes('9100329521') &&
      usedMsgId4 === 40235,
      'Scenario 4: Balance ₹950 -> One ₹1,000 alert (Template 40235) to each recipient',
      `Status: ${res4.status}, Recipients: [${calledNumbers4.join(', ')}], MessageId: ${usedMsgId4}`
    );

    // =========================================================================
    // SCENARIO 5: Balance drops to ₹450 -> One critical alert to each recipient
    // =========================================================================
    console.log('\n--- SCENARIO 5: Balance Drops to ₹450 (₹500 Critical Range) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 450 });

    const res5 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECHARGE_EVENT' });
    const calledNumbers5 = messagesDispatched.map(m => m.numbers);
    const usedMsgId5 = messagesDispatched[0]?.messageId;
    assertCondition(
      res5.checked === true &&
      res5.status === 'CRITICAL_500' &&
      res5.alertSent === true &&
      messagesDispatched.length === 2 &&
      calledNumbers5.includes('8275366399') &&
      calledNumbers5.includes('9100329521') &&
      usedMsgId5 === 40237,
      'Scenario 5: Balance ₹450 -> One critical alert (Template 40237) to each recipient',
      `Status: ${res5.status}, Recipients: [${calledNumbers5.join(', ')}], MessageId: ${usedMsgId5}`
    );

    // =========================================================================
    // SCENARIO 6: Balance recovers to ₹2,500 -> Alert state marked recovered
    // =========================================================================
    console.log('\n--- SCENARIO 6: Balance Recovers to ₹2,500 (Above ₹2,000) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 2500 });

    const res6 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECONCILIATION' });
    const settingsAfter6 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      res6.checked === true &&
      res6.status === 'NORMAL' &&
      res6.wasRecovered === true &&
      settingsAfter6.isRecovered === true &&
      settingsAfter6.currentThresholdState === 'NORMAL' &&
      settingsAfter6.thresholdAlerts.LOW_2000.alertSent === false &&
      settingsAfter6.thresholdAlerts.LOW_1000.alertSent === false &&
      settingsAfter6.thresholdAlerts.CRITICAL_500.alertSent === false &&
      messagesDispatched.length === 0,
      'Scenario 6: Balance recovers to ₹2,500 -> Marked recovered & all thresholds reset',
      `wasRecovered: ${res6.wasRecovered}, isRecovered: ${settingsAfter6.isRecovered}`
    );

    // =========================================================================
    // SCENARIO 7: Balance later falls to ₹1,800 -> A new warning cycle begins
    // =========================================================================
    console.log('\n--- SCENARIO 7: Balance Later Falls to ₹1,800 -> New Cycle Begins ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1800 });

    const res7 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECHARGE_EVENT' });
    assertCondition(
      res7.checked === true &&
      res7.status === 'LOW_2000' &&
      res7.alertSent === true &&
      messagesDispatched.length === 2,
      'Scenario 7: Balance later falls to ₹1,800 -> Fresh warning cycle triggers (2 messages sent)',
      `Dispatched Count: ${messagesDispatched.length}, Status: ${res7.status}`
    );

    // =========================================================================
    // SCENARIO 8: One recipient fails -> The other recipient is still attempted
    // =========================================================================
    console.log('\n--- SCENARIO 8: Independent Recipient Attempt (One Fails, One Succeeds) ---');
    messagesDispatched = [];
    // Reset alertSent on LOW_1000 for this test
    const settings8 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    settings8.thresholdAlerts.LOW_1000.alertSent = false;
    settings8.thresholdAlerts.LOW_1000.deliveredRecipients = [];
    await settings8.save();

    a1Provider.balance = async () => ({ success: true, balance: 950 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      if (opts.numbers === '8275366399') {
        throw new Error('Network Timeout on 8275366399');
      }
      return { success: true, request_id: 'REQ_SUCCESS_9100' };
    };

    const res8 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'RECHARGE_EVENT' });
    const attemptedRecipients8 = messagesDispatched.map(m => m.numbers);
    const settingsAfter8 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      attemptedRecipients8.includes('8275366399') &&
      attemptedRecipients8.includes('9100329521') &&
      res8.overallStatus === 'PARTIAL_SUCCESS' &&
      settingsAfter8.thresholdAlerts.LOW_1000.deliveredRecipients.includes('9100329521') &&
      !settingsAfter8.thresholdAlerts.LOW_1000.deliveredRecipients.includes('8275366399'),
      'Scenario 8: Independent recipient attempts -> One fails, other still attempted & delivered',
      `Attempted: [${attemptedRecipients8.join(', ')}], Delivered: [${settingsAfter8.thresholdAlerts.LOW_1000.deliveredRecipients.join(', ')}]`
    );

    // =========================================================================
    // SCENARIO 9: Balance API fails -> Do not send a false zero-balance alert
    // =========================================================================
    console.log('\n--- SCENARIO 9: Balance API Fails -> Never Send False Zero-Balance Alert ---');
    messagesDispatched = [];
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: 'REQ_TEST' };
    };
    a1Provider.balance = async () => {
      throw new Error('A1 Topup Gateway 504 Gateway Timeout');
    };

    const res9 = await providerAutomationService.checkBalanceAndAlert({ force: true, triggerType: 'SCHEDULED_CHECK' });
    const settingsAfter9 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      res9.checked === false &&
      res9.status === 'ERROR' &&
      messagesDispatched.length === 0 &&
      settingsAfter9.lastBalance === 950, // Retained last known balance, not zero!
      'Scenario 9: Balance API failure -> Retains last known balance, 0 false alerts sent',
      `Status: ${res9.status}, Retained Balance: ₹${settingsAfter9.lastBalance}, Dispatched: ${messagesDispatched.length}`
    );

    // =========================================================================
    // SCENARIO 10: Several concurrent recharges -> Shared in-flight fetch
    // =========================================================================
    console.log('\n--- SCENARIO 10: Several Recharges Arrive Simultaneously -> Shared In-Flight Fetch ---');
    let providerFetchCallCount = 0;
    a1Provider.balance = async () => {
      providerFetchCallCount++;
      await new Promise(r => setTimeout(r, 60)); // Simulate 60ms network latency
      return { success: true, balance: 2200 };
    };

    // Fire 5 concurrent balance fetch requests at the same exact instant
    const concurrentPromises = [
      providerAutomationService.getProviderBalance({ force: true }),
      providerAutomationService.getProviderBalance({ force: true }),
      providerAutomationService.getProviderBalance({ force: true }),
      providerAutomationService.getProviderBalance({ force: true }),
      providerAutomationService.getProviderBalance({ force: true }),
    ];
    const results10 = await Promise.all(concurrentPromises);
    assertCondition(
      providerFetchCallCount === 1 &&
      results10.every(r => r.success === true && r.balance === 2200),
      'Scenario 10: 5 concurrent recharges -> Exactly 1 provider API call made via in-flight promise sharing',
      `Provider API Calls: ${providerFetchCallCount}, All Succeeded: true`
    );

    // =========================================================================
    // SCENARIO 11: Backend restarts -> Alert state persists
    // =========================================================================
    console.log('\n--- SCENARIO 11: Backend Restarts -> Persistent MongoDB State ---');
    // Drop in-memory cache to simulate full process termination/restart
    providerAutomationService.lastSuccessfulBalance = null;
    providerAutomationService.lastSuccessfulCheckAt = null;

    const reloadedSettings = await providerAutomationService.getSettings();
    assertCondition(
      reloadedSettings.automationKey === 'a1topup_low_balance' &&
      reloadedSettings.thresholdAlerts.LOW_2000 !== undefined &&
      reloadedSettings.thresholdAlerts.LOW_1000 !== undefined &&
      reloadedSettings.thresholdAlerts.CRITICAL_500 !== undefined,
      'Scenario 11: Process restart -> Settings and threshold alert states successfully persisted in MongoDB',
      `Loaded from DB: Key=${reloadedSettings.automationKey}, Has Alerts Obj: true`
    );

    // =========================================================================
    // SCENARIO 12: Fast2SMS timeout occurs -> Bounded retry handling
    // =========================================================================
    console.log('\n--- SCENARIO 12: Fast2SMS Timeout & Bounded Retry ---');
    let retryAttemptCount = 0;
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      retryAttemptCount++;
      if (retryAttemptCount <= 2) {
        throw new Error(`Network Timeout (Attempt ${retryAttemptCount})`);
      }
      return { success: true, request_id: 'REQ_RETRY_SUCCESS' };
    };

    const retryRes = await providerAutomationService.sendWhatsAppWithRetry({
      messageId: 40230,
      phoneNumberId: '1294250930429862',
      recipient: '8275366399',
      variablesValues: '1800.00|28 Oct 2026, 11:30 AM',
      source: 'TEST_RETRY',
      maxRetries: 2,
    });
    assertCondition(
      retryRes.success === true &&
      retryRes.requestId === 'REQ_RETRY_SUCCESS' &&
      retryAttemptCount === 3,
      'Scenario 12: Fast2SMS timeout -> Bounded retry succeeds after 3 attempts without runaway spam',
      `Total Attempts: ${retryAttemptCount}, Request ID: ${retryRes.requestId}`
    );

    // =========================================================================
    // SCENARIO 13: Manual refresh action works
    // =========================================================================
    console.log('\n--- SCENARIO 13: Manual Refresh Action ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 2350 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: 'REQ_MANUAL_REFRESH' };
    };

    const manualRes = await providerAutomationService.checkBalanceAndAlert({
      force: true,
      forceAlert: false,
      triggerType: 'MANUAL_CHECK',
    });
    assertCondition(
      manualRes.checked === true &&
      manualRes.status === 'NORMAL' &&
      manualRes.balance === 2350,
      'Scenario 13: Manual Refresh Balance action executes safely and updates stored state',
      `Status: ${manualRes.status}, Balance: ₹${manualRes.balance}`
    );

    // =========================================================================
    // SCENARIO 14: Existing recharge flow succeeds even if notification fails
    // =========================================================================
    console.log('\n--- SCENARIO 14: Recharge Flow Resilience (Notification Failure Non-Blocking) ---');
    // Clear 60-second cache to simulate fresh fetch on new balance level
    providerAutomationService.lastSuccessfulCheckAt = null;
    a1Provider.balance = async () => ({ success: true, balance: 400 });
    fast2smsWhatsAppService.sendWhatsAppMessage = async () => {
      throw new Error('Fast2SMS Down');
    };

    // The recharge hook must execute cleanly and return the log without throwing unhandled rejection
    let rechargeHookThrew = false;
    let log14 = null;
    try {
      log14 = await providerAutomationService.checkAndTriggerLowBalanceAlert({
        orderId: 'RECHARGE_RESILIENCE_014',
        amount: 50,
      });
    } catch (e) {
      rechargeHookThrew = true;
    }
    assertCondition(
      rechargeHookThrew === false &&
      log14 !== null &&
      log14.overallStatus === 'FAILED',
      'Scenario 14: Recharge hook never breaks customer recharge flow if messaging provider fails',
      `Hook Threw Error: ${rechargeHookThrew}, Log Status: ${log14?.overallStatus}`
    );

    // =========================================================================
    // SCENARIO 15: No old provider-wallet template is used anywhere
    // =========================================================================
    console.log('\n--- SCENARIO 15: Strict Verification of Only Approved Template IDs ---');
    const templates = providerAutomationService.getTemplates();
    const approvedMsgIds = [templates.LOW_2000.messageId, templates.LOW_1000.messageId, templates.CRITICAL_500.messageId];
    const approvedTplNames = [templates.LOW_2000.name, templates.LOW_1000.name, templates.CRITICAL_500.name];

    const approvedTplIds = [templates.LOW_2000.templateId, templates.LOW_1000.templateId, templates.CRITICAL_500.templateId];

    assertCondition(
      approvedMsgIds.includes(40230) &&
      approvedMsgIds.includes(40235) &&
      approvedMsgIds.includes(40237) &&
      !approvedMsgIds.includes(27147) &&
      approvedTplNames.includes('provider_wallet_low_balance_2000') &&
      approvedTplNames.includes('provider_wallet_low_balance_1000') &&
      approvedTplNames.includes('provider_wallet_critical_balance_500') &&
      !approvedTplNames.includes('provider_wallet_low_balance') &&
      approvedTplIds.includes('165519901612689') &&
      approvedTplIds.includes('112150956740956') &&
      approvedTplIds.includes('193212102821660'),
      'Scenario 15: Only the 3 approved Fast2SMS templates are mapped; old 27147 completely eliminated',
      `Approved Message IDs: [${approvedMsgIds.join(', ')}], Template Names: [${approvedTplNames.join(', ')}], Meta IDs: [${approvedTplIds.join(', ')}]`
    );

    // Restore original mock methods
    a1Provider.balance = originalBalance;
    fast2smsWhatsAppService.sendWhatsAppMessage = originalSendWa;

    console.log('\n========================================================================');
    console.log(`   FINAL TEST RESULT: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log('========================================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('[FATAL ERROR IN TEST SUITE]:', err);
    process.exit(1);
  }
}

runComprehensiveTestSuite();
