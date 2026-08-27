const fast2smsService = require('./fast2sms.service');
const PlanApiSettings = require('../models/PlanApiSettings');

class Fast2SMSWalletMonitorService {
  constructor() {
    this.isChecking = false;
  }

  /**
   * Helper to ensure settings document exists in MongoDB
   */
  async getSettings() {
    let settings = await PlanApiSettings.findOne({ key: 'GLOBAL_PLANAPI_SETTINGS' });
    if (!settings) {
      settings = await PlanApiSettings.create({
        key: 'GLOBAL_PLANAPI_SETTINGS',
        alertState: {
          fast2smsAlertSent: false,
          lastFast2smsAlertAt: null,
          lastFast2smsAlertBalance: null,
        },
      });
    }
    return settings;
  }

  /**
   * Main Monitoring Execution Method
   * Fetches real Fast2SMS balance -> Evaluates <= 25 threshold -> Handles atomic DB state transition -> Sends Fast2SMS SMS Alert
   */
  async checkBalanceAndAlert() {
    if (this.isChecking) {
      console.log('[FAST2SMS MONITOR] Previous balance check in progress. Skipping duplicate execution.');
      return { checked: false, reason: 'CONCURRENCY_LOCK' };
    }

    this.isChecking = true;

    try {
      console.log('[FAST2SMS MONITOR] Checking wallet balance...');

      const threshold = parseFloat(process.env.FAST2SMS_LOW_BALANCE_THRESHOLD || 25);
      const alertPhone = process.env.FAST2SMS_ALERT_PHONE || process.env.ADMIN_ALERT_PHONE || '9100329521';

      if (!alertPhone) {
        console.error('[FAST2SMS ALERT CONFIG] Missing required configuration: FAST2SMS_ALERT_PHONE / ADMIN_ALERT_PHONE');
        return { checked: false, reason: 'MISSING_ALERT_PHONE' };
      }

      // 1. Fetch real Fast2SMS wallet balance using official Fast2SMS service
      const walletRes = await fast2smsService.getWalletBalance();

      if (!walletRes || walletRes.status === 'Disconnected' || walletRes.walletBalance === undefined || walletRes.walletBalance === null) {
        console.warn(`[FAST2SMS MONITOR] Fast2SMS balance fetch failed or disconnected. Warning: ${walletRes?.warning || 'N/A'}. Will retry next check.`);
        return { checked: false, reason: 'API_FAILED', warning: walletRes?.warning };
      }

      const currentBalance = Number(walletRes.walletBalance);
      const smsCount = Number(walletRes.smsCount || 0);

      if (isNaN(currentBalance)) {
        console.warn(`[FAST2SMS MONITOR] Invalid balance returned: ${walletRes.walletBalance}`);
        return { checked: false, reason: 'INVALID_BALANCE' };
      }

      // Ensure MongoDB settings document exists
      await this.getSettings();

      // 2. Evaluate status against low-balance threshold (<= ₹25.00)
      if (currentBalance > threshold) {
        // --- STATUS: NORMAL (> ₹25) ---
        console.log(`[FAST2SMS MONITOR] Current balance: ₹${currentBalance.toFixed(2)} | Threshold: ₹${threshold.toFixed(2)} | Status: NORMAL`);

        const settings = await this.getSettings();
        if (settings.alertState?.fast2smsAlertSent) {
          // Atomic State Recovery Reset
          await PlanApiSettings.updateOne(
            { key: 'GLOBAL_PLANAPI_SETTINGS', 'alertState.fast2smsAlertSent': true },
            {
              $set: {
                'alertState.fast2smsAlertSent': false,
                'alertState.lastFast2smsAlertAt': null,
                'alertState.lastFast2smsAlertBalance': null,
              },
            }
          );
          console.log(`[FAST2SMS MONITOR] Balance recovered above ₹${threshold.toFixed(2)}. Resetting low-balance alert state.`);
        }

        return { checked: true, status: 'NORMAL', balance: currentBalance, smsCount };
      }

      // --- STATUS: LOW (<= ₹25) ---
      console.log(`[FAST2SMS MONITOR] Current balance: ₹${currentBalance.toFixed(2)} | Threshold: ₹${threshold.toFixed(2)} | Status: LOW`);

      // 3. Atomic State Transition in MongoDB (Prevents Race Conditions)
      const atomicUpdate = await PlanApiSettings.findOneAndUpdate(
        {
          key: 'GLOBAL_PLANAPI_SETTINGS',
          $or: [
            { 'alertState.fast2smsAlertSent': false },
            { 'alertState.fast2smsAlertSent': { $exists: false } },
          ],
        },
        {
          $set: {
            'alertState.fast2smsAlertSent': true,
            'alertState.lastFast2smsAlertAt': new Date(),
            'alertState.lastFast2smsAlertBalance': currentBalance,
          },
        },
        { returnDocument: 'after' }
      );

      // If atomicUpdate is null, fast2smsAlertSent was ALREADY true (Spam Prevention)
      if (!atomicUpdate) {
        console.log(`[FAST2SMS MONITOR] Balance remains below threshold. Alert already sent; skipping duplicate notification.`);
        return { checked: true, status: 'LOW', alertSent: false, reason: 'ALREADY_ALERTED', balance: currentBalance, smsCount };
      }

      // Low-balance transition detected: Send SMS Alert via Fast2SMS SMS API
      console.log(`[FAST2SMS MONITOR] Low-balance transition detected`);

      const formattedBalance = currentBalance.toFixed(2);
      const formattedThreshold = threshold.toFixed(2);

      const alertMessage = `A1 Recharge Alert:\nFast2SMS wallet balance is low.\n\nCurrent Balance: ₹${formattedBalance}\nAlert Threshold: ₹${formattedThreshold}\nSMS Credits: ${smsCount}\n\nPlease recharge the Fast2SMS wallet to avoid service interruption.\n\nA1 Recharge`;

      try {
        const smsResult = await fast2smsService.sendSMS({
          phone: alertPhone,
          message: alertMessage,
        });

        if (smsResult.success) {
          console.log(`[FAST2SMS MONITOR] Low-balance alert sent successfully`);
          return {
            checked: true,
            status: 'LOW',
            alertSent: true,
            balance: currentBalance,
            smsCount,
            phone: alertPhone,
            requestId: smsResult.requestId,
          };
        } else {
          throw new Error(smsResult.error || 'Fast2SMS returned non-success response');
        }
      } catch (err) {
        console.error(`[FAST2SMS MONITOR ERROR] Fast2SMS SMS alert sending failed: ${err.message}. Rolling back alert state for retry.`);

        // Fail-Safe: Rollback alertState.fast2smsAlertSent to false so next check retries
        await PlanApiSettings.updateOne(
          { key: 'GLOBAL_PLANAPI_SETTINGS' },
          { $set: { 'alertState.fast2smsAlertSent': false } }
        ).catch(() => {});

        return {
          checked: true,
          status: 'LOW',
          alertSent: false,
          reason: 'SMS_FAILED',
          error: err.message,
          balance: currentBalance,
          smsCount,
        };
      }
    } catch (err) {
      console.error(`[FAST2SMS MONITOR ERROR] Execution error:`, err.message);
      return { checked: false, error: err.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Test Mode Endpoint Method: Send test Fast2SMS SMS alert for wallet low balance
   */
  async sendTestAlert(testBalanceInput = 24.05) {
    const alertPhone = process.env.FAST2SMS_ALERT_PHONE || process.env.ADMIN_ALERT_PHONE || '9100329521';
    const testBalanceNum = parseFloat(testBalanceInput);
    const formattedBalance = (isNaN(testBalanceNum) ? 24.05 : testBalanceNum).toFixed(2);
    const formattedThreshold = (25.00).toFixed(2);

    const alertMessage = `A1 Recharge Alert:\nFast2SMS wallet balance is low.\n\nCurrent Balance: ₹${formattedBalance}\nAlert Threshold: ₹${formattedThreshold}\nSMS Credits: 96\n\nPlease recharge the Fast2SMS wallet to avoid service interruption.\n\nA1 Recharge`;

    console.log(`[FAST2SMS TEST MONITOR] Triggering test Fast2SMS SMS alert to ${alertPhone} with balance ₹${formattedBalance}...`);

    const result = await fast2smsService.sendSMS({
      phone: alertPhone,
      message: alertMessage,
    });

    if (result.success) {
      console.log(`[FAST2SMS TEST MONITOR SUCCESS] Test message dispatched successfully.`);
      return {
        success: true,
        message: `Test Fast2SMS SMS low-balance alert sent to ${alertPhone}`,
        balanceFormatted: formattedBalance,
        fast2smsResponse: result.data,
      };
    } else {
      console.error(`[FAST2SMS TEST MONITOR FAILED] Test message failed: ${result.error}`);
      return {
        success: false,
        error: result.error,
        message: `Test Fast2SMS SMS low-balance alert failed for ${alertPhone}`,
      };
    }
  }
}

module.exports = new Fast2SMSWalletMonitorService();
