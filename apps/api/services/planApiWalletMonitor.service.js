const PlanApiService = require('./planapi.service');
const fast2smsService = require('./fast2sms.service');
const PlanApiSettings = require('../models/PlanApiSettings');

class PlanApiWalletMonitorService {
  constructor() {
    this.isChecking = false;
  }

  /**
   * Helper to format currency string (e.g. 24.05 -> "₹24.05")
   */
  formatBalance(num) {
    const val = Number(num);
    if (isNaN(val)) return '₹0.00';
    return `₹${val.toFixed(2)}`;
  }

  /**
   * Helper to get current IST Date string (YYYY-MM-DD)
   */
  getISTDateString(dateObj = new Date()) {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(dateObj);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper to ensure settings document exists in MongoDB with dailyAlerts structure
   */
  async getSettings() {
    let settings = await PlanApiSettings.findOne({ key: 'GLOBAL_PLANAPI_SETTINGS' });
    if (!settings) {
      settings = await PlanApiSettings.create({
        key: 'GLOBAL_PLANAPI_SETTINGS',
        dailyAlerts: {
          date: this.getISTDateString(),
          morningAlertSent: false,
          eveningAlertSent: false,
        },
      });
    }
    return settings;
  }

  /**
   * 1. 15-MINUTE DATA FETCH TASK
   * Fetches latest PlanAPI wallet balance & API hits and stores in DB.
   * DOES NOT SEND ANY ALERTS.
   */
  async fetchAndStoreData() {
    if (this.isChecking) {
      console.log('[PLANAPI MONITOR] Previous wallet check in progress. Skipping duplicate execution.');
      return { checked: false, reason: 'CONCURRENCY_LOCK' };
    }

    this.isChecking = true;

    try {
      console.log('[PLANAPI MONITOR] Checking wallet...');
      const syncLog = await PlanApiService.syncData('AUTOMATIC');

      if (syncLog && syncLog.status === 'SUCCESS') {
        console.log(`[PLANAPI WALLET API SUCCESS]`);
        console.log(`Wallet Balance: ₹${Number(syncLog.balance).toFixed(2)}`);
        console.log(`Remaining API Credits: ${syncLog.remainingHits}`);
        console.log(`Next check: 15 minutes`);
        return {
          success: true,
          balance: Number(syncLog.balance),
          remainingHits: Number(syncLog.remainingHits),
          syncedAt: syncLog.syncedAt,
        };
      } else {
        const errorMsg = syncLog?.errorMessage || 'Unexpected Server Error';
        console.warn(`[PLANAPI WALLET MONITOR] PlansAPI wallet balance check failed.`);
        console.warn(`[PLANAPI WALLET MONITOR] Error: ${errorMsg}`);
        console.warn(`[PLANAPI WALLET MONITOR] Retaining last successful wallet data.`);
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (err) {
      console.error(`[PLANAPI MONITOR ERROR] 15-minute fetch error:`, err.message);
      return { success: false, error: err.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 2. SCHEDULED ADMIN ALERT TASK (9:00 AM & 6:00 PM IST ONLY)
   * Evaluates the latest valid PlanAPI balance against ₹25.00 threshold.
   * Dispatches alert via Fast2SMS SMS if balance < ₹25.00 and alert was not sent yet for this window.
   */
  async checkScheduledAlert(windowType = 'MORNING') {
    const isMorning = windowType.toUpperCase() === 'MORNING';
    const windowName = isMorning ? 'Morning' : 'Evening';
    const windowTimeStr = isMorning ? '09:00 AM' : '06:00 PM';

    console.log(`[PLANAPI ALERT] ${windowName} alert check started (${windowTimeStr} IST)`);

    try {
      const threshold = parseFloat(process.env.PLANAPI_WALLET_LOW_BALANCE_THRESHOLD || 25);
      const alertPhone = process.env.PLANAPI_WALLET_ALERT_PHONE || process.env.FAST2SMS_ADMIN_PHONE || '9100329521';
      const todayStr = this.getISTDateString();

      // Retrieve/ensure settings document in MongoDB
      const settings = await this.getSettings();

      // Reset dailyAlerts if date changed
      if (!settings.dailyAlerts || settings.dailyAlerts.date !== todayStr) {
        settings.dailyAlerts = {
          date: todayStr,
          morningAlertSent: false,
          eveningAlertSent: false,
        };
        await PlanApiSettings.updateOne(
          { key: 'GLOBAL_PLANAPI_SETTINGS' },
          { $set: { dailyAlerts: settings.dailyAlerts } }
        );
      }

      // Check if alert for this window was ALREADY sent today
      const alreadySent = isMorning ? settings.dailyAlerts.morningAlertSent : settings.dailyAlerts.eveningAlertSent;
      if (alreadySent) {
        console.log(`[PLANAPI ALERT] ${windowName} alert (${windowTimeStr}) for ${todayStr} already sent. Skipping duplicate alert.`);
        return { checked: true, status: 'SKIPPED', reason: 'ALREADY_SENT_TODAY' };
      }

      // Retrieve latest VALID cached PlanAPI sync record
      const latestData = await PlanApiService.getLatestValidData();

      if (!latestData || latestData.balance === undefined || latestData.balance === null || isNaN(latestData.balance)) {
        console.warn(`[PLANAPI ALERT] No valid wallet balance available for ${windowTimeStr} alert check`);
        console.warn(`[PLANAPI ALERT] Alert skipped because balance could not be verified`);
        return { checked: true, status: 'UNKNOWN', alertSent: false, reason: 'UNVERIFIED_BALANCE' };
      }

      const currentBalance = Number(latestData.balance);
      const remainingHits = Number(latestData.remainingHits || 0);

      // Evaluate threshold: balance < ₹25.00
      if (currentBalance >= threshold) {
        console.log(`[PLANAPI ALERT] ${windowName} alert check`);
        console.log(`Balance: ₹${currentBalance.toFixed(2)}`);
        console.log(`Threshold: ₹${threshold.toFixed(2)}`);
        console.log(`Status: NORMAL`);
        console.log(`Action: NO ALERT`);
        return { checked: true, status: 'NORMAL', alertSent: false, balance: currentBalance };
      }

      // STATUS: LOW (currentBalance < ₹25.00)
      console.log(`[PLANAPI ALERT] ${windowName} alert check started`);
      console.log(`Current Balance: ₹${currentBalance.toFixed(2)}`);
      console.log(`Threshold: ₹${threshold.toFixed(2)}`);
      console.log(`Condition: LOW`);
      console.log(`Action: SEND ALERT`);

      const alertMessage = `A1 Recharge Alert\n\nPlanAPI wallet balance is LOW.\n\nCurrent Balance: ₹${currentBalance.toFixed(2)}\nThreshold: ₹${threshold.toFixed(2)}\nRemaining API Credits: ${remainingHits}\n\nTime: ${windowTimeStr}\nStatus: LOW\n\nPlease recharge the PlanAPI wallet to avoid service interruption.\n\nA1 Recharge`;

      // Dispatch via Fast2SMS SMS service
      const smsResult = await fast2smsService.sendSMS({
        phone: alertPhone,
        message: alertMessage,
      });

      if (smsResult.success) {
        // Atomic state update in DB to mark window alert sent for today
        const fieldToSet = isMorning ? 'dailyAlerts.morningAlertSent' : 'dailyAlerts.eveningAlertSent';
        await PlanApiSettings.updateOne(
          { key: 'GLOBAL_PLANAPI_SETTINGS' },
          { $set: { [fieldToSet]: true, 'dailyAlerts.date': todayStr } }
        );

        console.log(`[PLANAPI ALERT] ${windowName} low-balance alert sent successfully`);
        return {
          checked: true,
          status: 'LOW',
          alertSent: true,
          window: windowType,
          balance: currentBalance,
          phone: alertPhone,
          requestId: smsResult.requestId,
        };
      } else {
        console.error(`[PLANAPI ALERT ERROR] ${windowName} low-balance alert dispatch failed: ${smsResult.error}`);
        return {
          checked: true,
          status: 'LOW',
          alertSent: false,
          reason: 'SMS_FAILED',
          error: smsResult.error,
        };
      }
    } catch (err) {
      console.error(`[PLANAPI ALERT ERROR] ${windowName} alert check error:`, err.message);
      return { checked: false, error: err.message };
    }
  }

  /**
   * Legacy method wrapper to maintain compatibility with existing controllers
   */
  async checkBalanceAndAlert() {
    return this.fetchAndStoreData();
  }

  /**
   * Test Mode Endpoint Method: Triggers a test Fast2SMS SMS alert for PlanAPI low balance
   */
  async sendTestAlert(testBalanceInput = 24.05) {
    const alertPhone = process.env.PLANAPI_WALLET_ALERT_PHONE || process.env.FAST2SMS_ADMIN_PHONE || '9100329521';
    const testBalanceNum = parseFloat(testBalanceInput);
    const formattedBalance = (isNaN(testBalanceNum) ? 24.05 : testBalanceNum).toFixed(2);
    const formattedThreshold = (25.00).toFixed(2);

    const alertMessage = `A1 Recharge Alert\n\nPlanAPI wallet balance is LOW.\n\nCurrent Balance: ₹${formattedBalance}\nThreshold: ₹${formattedThreshold}\nRemaining API Credits: 1000\n\nTime: TEST\nStatus: LOW\n\nPlease recharge the PlanAPI wallet to avoid service interruption.\n\nA1 Recharge`;

    console.log(`[PLANAPI TEST MONITOR] Triggering test Fast2SMS SMS alert to ${alertPhone} with balance ₹${formattedBalance}...`);

    const result = await fast2smsService.sendSMS({
      phone: alertPhone,
      message: alertMessage,
    });

    if (result.success) {
      console.log(`[PLANAPI TEST MONITOR SUCCESS] Test message dispatched.`);
      return {
        success: true,
        message: `Test Fast2SMS SMS low-balance alert sent to ${alertPhone}`,
        balanceFormatted: formattedBalance,
        fast2smsResponse: result.data,
      };
    } else {
      console.error(`[PLANAPI TEST MONITOR FAILED] Test message failed: ${result.error}`);
      return {
        success: false,
        error: result.error,
        message: `Test Fast2SMS SMS low-balance alert failed for ${alertPhone}`,
      };
    }
  }
}

module.exports = new PlanApiWalletMonitorService();
