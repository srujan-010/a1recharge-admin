const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PlanApiService = require('../services/planapi.service');
const planApiWalletMonitorService = require('../services/planApiWalletMonitor.service');
const fast2smsService = require('../services/fast2sms.service');
const PlanApiSettings = require('../models/PlanApiSettings');
const PlanApiSyncLog = require('../models/PlanApiSyncLog');

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n==========================================================');
    console.log('  PLANAPI WALLET MONITOR - TEST SCENARIOS (CASES 1 TO 6)   ');
    console.log('==========================================================\n');

    // Helper to reset DB alert state for a test date
    const resetAlertState = async (testDate = '2026-08-27') => {
      await PlanApiSettings.updateOne(
        { key: 'GLOBAL_PLANAPI_SETTINGS' },
        {
          $set: {
            dailyAlerts: {
              date: testDate,
              morningAlertSent: false,
              eveningAlertSent: false,
            },
          },
        },
        { upsert: true }
      );
    };

    // Helper to mock PlanApiService.getLatestValidData
    const mockPlanApiData = (balance, remainingHits = 1000) => {
      if (balance === null) {
        PlanApiService.getLatestValidData = async () => null;
      } else {
        PlanApiService.getLatestValidData = async () => ({
          balance,
          remainingHits,
          syncedAt: new Date(),
        });
      }
    };

    // Intercept fast2smsService.sendSMS
    let sentSMSList = [];
    fast2smsService.sendSMS = async (params) => {
      sentSMSList.push(params);
      console.log(`  [MOCK FAST2SMS INTERCEPT] Phone: ${params.phone} | Msg Title: "${params.message.split('\n')[0]}"`);
      return { success: true, requestId: 'req_planapi_mock_123', data: { return: true } };
    };

    // Override getISTDateString for test stability
    planApiWalletMonitorService.getISTDateString = () => '2026-08-27';

    // --- CASE 1: Balance = ₹30.00 at 09:00 AM & 18:00 PM ---
    console.log('--- CASE 1: Balance = ₹30.00 at 09:00 AM & 18:00 PM ---');
    await resetAlertState();
    mockPlanApiData(30.00);
    sentSMSList = [];

    let morningRes = await planApiWalletMonitorService.checkScheduledAlert('MORNING');
    let eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`Morning Alert Sent: ${Boolean(morningRes.alertSent)} | Evening Alert Sent: ${Boolean(eveningRes.alertSent)}`);
    console.log(sentSMSList.length === 0
      ? '✓ PASS CASE 1: No alerts sent when balance is above threshold (₹30.00).'
      : '✗ FAIL CASE 1: Alerts sent unexpectedly.');

    // --- CASE 2: Balance = ₹24.00 at 09:00 AM & 18:00 PM ---
    console.log('\n--- CASE 2: Balance = ₹24.00 at 09:00 AM & 18:00 PM ---');
    await resetAlertState();
    mockPlanApiData(24.00);
    sentSMSList = [];

    morningRes = await planApiWalletMonitorService.checkScheduledAlert('MORNING');
    eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`Morning Alert Sent: ${Boolean(morningRes.alertSent)} | Evening Alert Sent: ${Boolean(eveningRes.alertSent)}`);
    console.log(sentSMSList.length === 2 && morningRes.alertSent && eveningRes.alertSent
      ? '✓ PASS CASE 2: Exactly 2 alerts sent in one day (1 Morning at 09:00 + 1 Evening at 18:00).'
      : '✗ FAIL CASE 2: Dual daily alert logic failed.');

    // --- CASE 3: 15-Minute Monitoring vs Scheduled Alerts ---
    console.log('\n--- CASE 3: 15-Minute Monitoring vs Scheduled Alerts (Balance = ₹24.00) ---');
    await resetAlertState();
    mockPlanApiData(24.00);

    // Mock PlanApiService.syncData for 15-minute fetch
    PlanApiService.syncData = async () => ({
      status: 'SUCCESS',
      balance: 24.00,
      remainingHits: 1000,
      syncedAt: new Date(),
    });

    sentSMSList = [];

    // Simulate 15-minute fetches at 09:15, 09:30, 09:45, 10:00
    await planApiWalletMonitorService.fetchAndStoreData();
    await planApiWalletMonitorService.fetchAndStoreData();
    await planApiWalletMonitorService.fetchAndStoreData();
    await planApiWalletMonitorService.fetchAndStoreData();

    const fetchAlertCount = sentSMSList.length;

    // Simulate 09:00 AM and 18:00 PM alerts
    morningRes = await planApiWalletMonitorService.checkScheduledAlert('MORNING');
    eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`15-min Fetch Alert Count: ${fetchAlertCount} | Morning Alert: ${Boolean(morningRes.alertSent)} | Evening Alert: ${Boolean(eveningRes.alertSent)}`);
    console.log(fetchAlertCount === 0 && sentSMSList.length === 2
      ? '✓ PASS CASE 3: 15-minute fetches sent ZERO alerts. Total alerts = 2 (Morning + Evening only).'
      : '✗ FAIL CASE 3: 15-minute fetch sent unwanted alerts.');

    // --- CASE 4: Balance = ₹24.00 at 09:00 AM, ₹30.00 at 18:00 PM ---
    console.log('\n--- CASE 4: Balance = ₹24.00 at 09:00 AM, ₹30.00 at 18:00 PM ---');
    await resetAlertState();
    sentSMSList = [];

    mockPlanApiData(24.00);
    morningRes = await planApiWalletMonitorService.checkScheduledAlert('MORNING');

    mockPlanApiData(30.00);
    eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`Morning Alert: ${Boolean(morningRes.alertSent)} | Evening Alert: ${Boolean(eveningRes.alertSent)}`);
    console.log(sentSMSList.length === 1 && morningRes.alertSent && !eveningRes.alertSent
      ? '✓ PASS CASE 4: Sent Morning alert (₹24.00), suppressed Evening alert (₹30.00).'
      : '✗ FAIL CASE 4: Case 4 failed.');

    // --- CASE 5: Balance = ₹30.00 at 09:00 AM, ₹24.00 at 18:00 PM ---
    console.log('\n--- CASE 5: Balance = ₹30.00 at 09:00 AM, ₹24.00 at 18:00 PM ---');
    await resetAlertState();
    sentSMSList = [];

    mockPlanApiData(30.00);
    morningRes = await planApiWalletMonitorService.checkScheduledAlert('MORNING');

    mockPlanApiData(24.00);
    eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`Morning Alert: ${Boolean(morningRes.alertSent)} | Evening Alert: ${Boolean(eveningRes.alertSent)}`);
    console.log(sentSMSList.length === 1 && !morningRes.alertSent && eveningRes.alertSent
      ? '✓ PASS CASE 5: Suppressed Morning alert (₹30.00), sent Evening alert (₹24.00).'
      : '✗ FAIL CASE 5: Case 5 failed.');

    // --- CASE 6: PlanAPI Fails at 18:00 PM (Unverified Balance) ---
    console.log('\n--- CASE 6: PlanAPI Fails at 18:00 PM (Unverified Balance - No Fake ₹0 Alert) ---');
    await resetAlertState();
    sentSMSList = [];

    mockPlanApiData(null); // No valid sync data available
    eveningRes = await planApiWalletMonitorService.checkScheduledAlert('EVENING');

    console.log(`Evening Alert Sent: ${Boolean(eveningRes.alertSent)} | Reason: ${eveningRes.reason}`);
    console.log(sentSMSList.length === 0 && eveningRes.reason === 'UNVERIFIED_BALANCE'
      ? '✓ PASS CASE 6: Skipped alert on API error. No fake low-balance alert sent.'
      : '✗ FAIL CASE 6: Sent false alert on API error.');

    console.log('\n==========================================================');
    console.log('          ALL 6 TEST CASES COMPLETED SUCCESSFULLY          ');
    console.log('==========================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
