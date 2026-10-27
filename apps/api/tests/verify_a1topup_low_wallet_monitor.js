const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const providerAutomationService = require('../services/providerAutomation.service');
const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('../services/providers/provider.factory');
const fast2smsWhatsAppService = require('../services/fast2smsWhatsApp.service');
const fast2smsService = require('../services/fast2sms.service');
const a1topupWorker = require('../workers/a1topupWalletMonitorWorker');

async function runComprehensiveTests() {
  console.log('\n================================================================');
  console.log('   A1TOPUP LOW-WALLET ALERT SYSTEM - COMPREHENSIVE TEST SUITE   ');
  console.log('================================================================\n');

  let mongoConnected = false;
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log('[TEST SETUP] Connected to MongoDB.');

    // Save originals for mocking
    const a1Provider = ProviderFactory.getProvider('A1Topup');
    const originalBalance = a1Provider.balance;
    const originalSendWa = fast2smsWhatsAppService.sendWhatsAppMessage;
    const originalSendSms = fast2smsService.sendSMS;

    // Reset settings in DB for testing
    await ProviderAutomationSettings.deleteMany({});
    await ProviderAutomationLog.deleteMany({});

    const settings = await providerAutomationService.getSettings();
    settings.enabled = true;
    settings.threshold = 2000;
    settings.recipients = ['8275366399', '9100329521'];
    settings.channel = 'WHATSAPP';
    settings.alertSent = false;
    settings.deliveredRecipients = [];
    await settings.save();

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

    // -------------------------------------------------------------------------
    // SCENARIO 1: Balance ₹2,500 -> No low-balance alert
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Balance ₹2,500 (Above ₹2,000 Threshold) ---');
    let messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 2500, currency: 'INR' });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: 'REQ_WA_2500' };
    };

    const res1 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    assertCondition(
      res1.checked === true &&
      res1.status === 'NORMAL' &&
      res1.alertSent === false &&
      messagesDispatched.length === 0,
      'Scenario 1: Balance ₹2,500 -> Status NORMAL, 0 alerts sent',
      `Result: status=${res1.status}, messagesCount=${messagesDispatched.length}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Balance ₹1,999 -> Alert both recipients (8275366399 & 9100329521)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Balance ₹1,999 (Below ₹2,000 Threshold) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1999, currency: 'INR' });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: `REQ_WA_${opts.numbers}` };
    };

    const res2 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const calledNumbers2 = messagesDispatched.map(m => m.numbers);
    assertCondition(
      res2.checked === true &&
      res2.status === 'LOW_BALANCE' &&
      res2.alertSent === true &&
      messagesDispatched.length === 2 &&
      calledNumbers2.includes('8275366399') &&
      calledNumbers2.includes('9100329521'),
      'Scenario 2: Balance ₹1,999 -> Alert dispatched to BOTH recipients',
      `Messages Sent: ${calledNumbers2.join(', ')}`
    );

    // Verify DB state
    const settingsAfter2 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      settingsAfter2.alertSent === true &&
      settingsAfter2.deliveredRecipients.includes('8275366399') &&
      settingsAfter2.deliveredRecipients.includes('9100329521'),
      'Scenario 2 DB: alertSent marked TRUE and deliveredRecipients tracked',
      `alertSent=${settingsAfter2.alertSent}, delivered=${settingsAfter2.deliveredRecipients.join(', ')}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Balance remains ₹1,999 -> Do NOT repeatedly send duplicate alerts
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Balance remains ₹1,999 (Duplicate Suppression) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1999, currency: 'INR' });

    const res3 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    assertCondition(
      res3.checked === true &&
      res3.status === 'LOW_BALANCE' &&
      res3.alertSent === false &&
      res3.reason === 'ALREADY_ALERTED' &&
      messagesDispatched.length === 0,
      'Scenario 3: Balance remains ₹1,999 -> Duplicate alert suppressed (0 messages sent)',
      `reason=${res3.reason}, messagesDispatched=${messagesDispatched.length}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Balance recovers to ₹2,500 -> Reset the alert state
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Balance recovers to ₹2,500 (Alert State Recovery) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 2500, currency: 'INR' });

    const res4 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const settingsAfter4 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      res4.checked === true &&
      res4.status === 'NORMAL' &&
      res4.wasRecovered === true &&
      settingsAfter4.alertSent === false &&
      settingsAfter4.deliveredRecipients.length === 0,
      'Scenario 4: Balance recovers to ₹2,500 -> Alert state reset in DB (alertSent: false, delivered: [])',
      `wasRecovered=${res4.wasRecovered}, alertSent=${settingsAfter4.alertSent}, deliveredCount=${settingsAfter4.deliveredRecipients.length}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Balance falls to ₹1,900 again -> Send a new alert
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Balance falls to ₹1,900 again (New Low-Balance Event) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1900, currency: 'INR' });
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: `REQ_WA_${opts.numbers}_NEW` };
    };

    const res5 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const calledNumbers5 = messagesDispatched.map(m => m.numbers);
    assertCondition(
      res5.checked === true &&
      res5.status === 'LOW_BALANCE' &&
      res5.alertSent === true &&
      messagesDispatched.length === 2 &&
      calledNumbers5.includes('8275366399') &&
      calledNumbers5.includes('9100329521'),
      'Scenario 5: Balance drops to ₹1,900 -> New alert cycle triggered for both recipients',
      `Messages sent: ${calledNumbers5.join(', ')}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Provider API fails -> Log error without false low-balance alert
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Provider API Fails (Fail-Safe Verification) ---');
    messagesDispatched = [];
    a1Provider.balance = async () => {
      throw new Error('ETIMEDOUT: Provider server unreachable at business.a1topup.com');
    };

    const res6 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const settingsAfter6 = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    assertCondition(
      res6.checked === false &&
      res6.reason === 'API_FAILED' &&
      res6.error.includes('ETIMEDOUT') &&
      messagesDispatched.length === 0 &&
      settingsAfter6.lastCheckError !== null &&
      settingsAfter6.lastBalance === 1900, // Never reset to 0!
      'Scenario 6: Provider API Failure -> Logged as API_FAILED without generating false alerts',
      `Error logged: "${settingsAfter6.lastCheckError}", Preserved Balance: ₹${settingsAfter6.lastBalance}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 7: One recipient message fails -> Retry without duplicating accepted
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Partial Delivery Failure & Safe Retry Handling ---');
    // First reset alert state to simulate fresh drop
    await ProviderAutomationSettings.updateOne(
      { automationKey: 'a1topup_low_balance' },
      { $set: { alertSent: false, deliveredRecipients: [], lastStatus: 'NORMAL' } }
    );

    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1850, currency: 'INR' });
    
    // Simulate: Phone 1 (8275366399) succeeds, Phone 2 (9100329521) fails
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      if (opts.numbers === '9100329521') {
        throw new Error('Fast2SMS 502: Bad Gateway temporary network failure');
      }
      return { success: true, request_id: 'REQ_WA_8275366399' };
    };

    const res7a = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const settingsAfter7a = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });

    assertCondition(
      res7a.overallStatus === 'PARTIAL_SUCCESS' &&
      settingsAfter7a.deliveredRecipients.includes('8275366399') &&
      !settingsAfter7a.deliveredRecipients.includes('9100329521') &&
      settingsAfter7a.alertSent === false, // Not fully satisfied because Phone 2 failed
      'Scenario 7a: Phone 1 succeeds, Phone 2 fails -> PARTIAL_SUCCESS recorded; delivered: [8275366399]',
      `Delivered: [${settingsAfter7a.deliveredRecipients.join(', ')}], alertSent=${settingsAfter7a.alertSent}`
    );

    // Second check (Retry): Phone 2 now succeeds. Phone 1 MUST NOT receive a duplicate message!
    messagesDispatched = [];
    fast2smsWhatsAppService.sendWhatsAppMessage = async (opts) => {
      messagesDispatched.push(opts);
      return { success: true, request_id: 'REQ_WA_9100329521_RETRY' };
    };

    const res7b = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    const settingsAfter7b = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });

    assertCondition(
      messagesDispatched.length === 1 &&
      messagesDispatched[0].numbers === '9100329521' &&
      settingsAfter7b.deliveredRecipients.includes('8275366399') &&
      settingsAfter7b.deliveredRecipients.includes('9100329521') &&
      settingsAfter7b.alertSent === true,
      'Scenario 7b: Retry check -> Dispatched ONLY to Phone 2 without duplicating to Phone 1',
      `Targeted retry number: ${messagesDispatched[0]?.numbers}, alertSent=${settingsAfter7b.alertSent}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Backend Restarts -> Persisted alert state preserved in MongoDB
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Backend Restart & Persisted State Resumption ---');
    // Simulate server reboot by re-instantiating / fetching fresh settings from MongoDB
    const reloadedSettings = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    messagesDispatched = [];
    a1Provider.balance = async () => ({ success: true, balance: 1850, currency: 'INR' });

    // Balance is still 1850, alertSent is true in DB
    const res8 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    assertCondition(
      reloadedSettings.alertSent === true &&
      res8.reason === 'ALREADY_ALERTED' &&
      messagesDispatched.length === 0,
      'Scenario 8: Post-Restart Check -> Alert state loaded from MongoDB; duplicate alert suppressed',
      `Persisted alertSent=${reloadedSettings.alertSent}, reason=${res8.reason}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 9: Fast2SMS Quick SMS Channel Support
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Fast2SMS SMS Channel Dispatch ---');
    await ProviderAutomationSettings.updateOne(
      { automationKey: 'a1topup_low_balance' },
      { $set: { channel: 'SMS', alertSent: false, deliveredRecipients: [], lastStatus: 'NORMAL' } }
    );

    let smsDispatched = [];
    fast2smsService.sendSMS = async (opts) => {
      smsDispatched.push(opts);
      return { success: true, requestId: `REQ_SMS_${opts.phone}`, message: 'SMS accepted' };
    };

    const res9 = await providerAutomationService.checkBalanceAndAlert({ triggerType: 'SCHEDULED_CHECK' });
    assertCondition(
      res9.alertSent === true &&
      smsDispatched.length === 2 &&
      smsDispatched[0].message.includes('₹2000') || smsDispatched[0].message.includes('2000.00'),
      'Scenario 9: SMS Channel -> Dispatched Fast2SMS Quick SMS containing ₹2,000 threshold',
      `Recipients: ${smsDispatched.map(s => s.phone).join(', ')}`
    );

    // Restore original channel to WHATSAPP
    await ProviderAutomationSettings.updateOne(
      { automationKey: 'a1topup_low_balance' },
      { $set: { channel: 'WHATSAPP' } }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 10: Production Verification (Real A1Topup Live API & Fast2SMS Account)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Production Real API Verification ---');
    // Restore original provider balance method to test actual live API
    a1Provider.balance = originalBalance;
    fast2smsWhatsAppService.sendWhatsAppMessage = originalSendWa;
    fast2smsService.sendSMS = originalSendSms;

    const liveBalanceRes = await a1Provider.balance();
    console.log('Real Provider Balance Response:', liveBalanceRes);

    const liveFast2sms = await fast2smsService.getWalletBalance();
    console.log('Real Fast2SMS Wallet Response:', liveFast2sms);

    const liveWaba = await fast2smsWhatsAppService.getWabaDetails().catch(e => ({ error: e.message }));
    console.log('Real WABA Account Response:', liveWaba);

    assertCondition(
      liveBalanceRes.success === true && typeof liveBalanceRes.balance === 'number' && liveBalanceRes.balance > 0,
      `Scenario 10a: Real A1Topup Provider API live balance verified: ₹${liveBalanceRes.balance?.toFixed(2)}`,
      `HTTP 200, parsed valid numeric balance`
    );

    assertCondition(
      liveFast2sms.status === 'Connected' && liveFast2sms.walletBalance > 0,
      `Scenario 10b: Real Fast2SMS Wallet verified: Balance ₹${liveFast2sms.walletBalance}, Credits: ${liveFast2sms.smsCount}`,
      `Fast2SMS API Key verified active`
    );

    assertCondition(
      liveWaba && liveWaba.connection_status === 'CONNECTED',
      `Scenario 10c: Real Fast2SMS WABA verified: Phone ${liveWaba.number}, Status: ${liveWaba.connection_status}`,
      `Template ID: 27147 (provider_wallet_low_balance) connected`
    );

    console.log('\n================================================================');
    console.log(`   TEST RESULTS SUMMARY: ${passedTests}/${totalTests} TESTS PASSED   `);
    console.log('================================================================\n');

    if (mongoConnected) await mongoose.disconnect();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('\n[FATAL TEST RUNNER ERROR]', err);
    if (mongoConnected) await mongoose.disconnect();
    process.exit(1);
  }
}

runComprehensiveTests();
