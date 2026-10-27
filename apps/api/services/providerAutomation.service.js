const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('./providers/provider.factory');
const fast2smsWhatsAppService = require('./fast2smsWhatsApp.service');
const fast2smsService = require('./fast2sms.service');

class ProviderAutomationService {
  constructor() {
    this.isChecking = false;
  }

  /**
   * Get or initialize automation settings with environment variable fallbacks
   */
  async getSettings() {
    const envThreshold = parseFloat(process.env.A1TOPUP_WALLET_LOW_BALANCE_THRESHOLD || '2000');
    const envPhone1 = process.env.A1TOPUP_WALLET_ALERT_PHONE_1 || '8275366399';
    const envPhone2 = process.env.A1TOPUP_WALLET_ALERT_PHONE_2 || '9100329521';
    const envInterval = parseInt(process.env.A1TOPUP_WALLET_CHECK_INTERVAL_MINUTES || '5', 10);
    const envEnabled = process.env.A1TOPUP_WALLET_ALERT_ENABLED !== undefined 
      ? process.env.A1TOPUP_WALLET_ALERT_ENABLED === 'true' 
      : true;

    let settings = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });

    if (!settings) {
      settings = await ProviderAutomationSettings.create({
        automationKey: 'a1topup_low_balance',
        enabled: envEnabled,
        providerName: 'A1Topup',
        threshold: !isNaN(envThreshold) ? envThreshold : 2000,
        recipients: [envPhone1, envPhone2].filter(Boolean),
        channel: process.env.A1TOPUP_WALLET_ALERT_CHANNEL || 'WHATSAPP',
        templateName: 'provider_wallet_low_balance',
        messageId: 27147,
        phoneNumberId: '1294250930429862',
        checkIntervalMinutes: !isNaN(envInterval) ? envInterval : 5,
        monitoringStatus: 'ACTIVE',
        alertSent: false,
        deliveredRecipients: [],
      });
    } else {
      let needsSave = false;
      if (settings.threshold === undefined || settings.threshold === null) {
        settings.threshold = !isNaN(envThreshold) ? envThreshold : 2000;
        needsSave = true;
      }
      if (!settings.checkIntervalMinutes) {
        settings.checkIntervalMinutes = envInterval;
        needsSave = true;
      }
      if (needsSave) {
        await settings.save().catch(() => {});
      }
    }

    return settings;
  }

  /**
   * Helper to format Date into Asia/Kolkata IST string
   * Example: "27 Oct 2026, 10:15 AM"
   */
  formatISTDate(date = new Date()) {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} IST`;
  }

  /**
   * Core Monitoring Execution Method
   * Fetches real A1Topup balance -> Evaluates < threshold -> Handles state recovery and duplicate suppression -> Dispatches alerts
   *
   * @param {Object} options
   * @param {boolean} options.force - Force check and alert regardless of previous state (e.g. manual admin trigger)
   * @param {string} options.triggerType - 'SCHEDULED_CHECK' | 'MANUAL_CHECK' | 'EXTERNAL_CRON' | 'RECHARGE_EVENT'
   * @param {Object} options.transactionDoc - Optional recharge transaction document
   */
  async checkBalanceAndAlert(options = {}) {
    const {
      force = false,
      triggerType = 'SCHEDULED_CHECK',
      transactionDoc = null,
    } = options;

    const startTime = Date.now();
    const transactionId = transactionDoc
      ? (transactionDoc.orderId || transactionDoc._id?.toString() || `TXN_${Date.now()}`)
      : `CHK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (this.isChecking) {
      console.log(`[A1TOPUP MONITOR] Balance check already in progress. Skipping duplicate execution (${triggerType}).`);
      return { checked: false, reason: 'CONCURRENCY_LOCK' };
    }

    this.isChecking = true;

    try {
      console.log(`[A1TOPUP MONITOR] Starting wallet balance check (Trigger: ${triggerType})...`);

      const settings = await this.getSettings();

      if (!settings.enabled && !force) {
        console.log('[A1TOPUP MONITOR] Monitoring is currently disabled in settings.');
        settings.monitoringStatus = 'DISABLED';
        await settings.save().catch(() => {});
        return { checked: false, status: 'DISABLED', reason: 'AUTOMATION_DISABLED' };
      }

      // 1. Fetch REAL A1Topup Provider Wallet Balance via Provider Service
      const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
      let balanceResult;

      try {
        balanceResult = await provider.balance();
      } catch (err) {
        console.error('[A1TOPUP MONITOR ERROR] Provider balance API fetch failed:', err.message);

        settings.lastCheckAt = new Date();
        settings.lastCheckError = err.message || 'Provider balance API error';
        settings.monitoringStatus = 'ERROR';
        await settings.save().catch(() => {});

        // Fail-Safe: NEVER treat an API failure as zero balance!
        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: settings.lastBalance || null,
          threshold: settings.threshold || 2000,
          detectedAt: new Date(),
          overallStatus: 'ERROR_SKIPPED',
          triggerType,
          errorDetails: `Provider API failed: ${err.message}`,
          executionTimeMs: Date.now() - startTime,
        }).catch(e => console.error('[A1TOPUP MONITOR] Log creation failed:', e.message));

        return {
          checked: false,
          status: 'ERROR',
          reason: 'API_FAILED',
          error: err.message,
          lastKnownBalance: settings.lastBalance,
        };
      }

      // 2. Safe Balance Parsing & Validation
      let numericBalance = null;
      if (balanceResult && balanceResult.success && typeof balanceResult.balance === 'number' && !isNaN(balanceResult.balance)) {
        numericBalance = balanceResult.balance;
      } else if (balanceResult && typeof balanceResult.balance === 'string' && !isNaN(Number(balanceResult.balance))) {
        numericBalance = parseFloat(balanceResult.balance);
      }

      if (numericBalance === null || isNaN(numericBalance)) {
        const parseErr = `Invalid balance format returned from provider: ${JSON.stringify(balanceResult)}`;
        console.error(`[A1TOPUP MONITOR ERROR] ${parseErr}`);

        settings.lastCheckAt = new Date();
        settings.lastCheckError = parseErr;
        settings.monitoringStatus = 'ERROR';
        await settings.save().catch(() => {});

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          threshold: settings.threshold || 2000,
          detectedAt: new Date(),
          overallStatus: 'ERROR_SKIPPED',
          triggerType,
          errorDetails: parseErr,
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return { checked: false, status: 'ERROR', reason: 'INVALID_BALANCE', error: parseErr };
      }

      // Balance check was successful
      const threshold = settings.threshold || 2000;
      const checkIntervalMinutes = settings.checkIntervalMinutes || 5;
      const nextCheckAt = new Date(Date.now() + checkIntervalMinutes * 60 * 1000);

      settings.lastCheckAt = new Date();
      settings.lastSuccessfulCheckAt = new Date();
      settings.lastBalance = numericBalance;
      settings.lastCheckError = null;
      settings.nextCheckAt = nextCheckAt;
      settings.monitoringStatus = 'ACTIVE';

      // 3. Evaluate Status Against Threshold (₹2,000)
      const isLowBalance = numericBalance < threshold;

      if (!isLowBalance) {
        // --- STATUS: NORMAL (>= ₹2,000) ---
        console.log(`[A1TOPUP MONITOR] Current Balance: ₹${numericBalance.toFixed(2)} | Threshold: ₹${threshold.toFixed(2)} | Status: NORMAL (>= ₹${threshold})`);

        let wasRecovered = false;
        if (settings.alertSent || settings.lastStatus === 'LOW_BALANCE' || (settings.deliveredRecipients && settings.deliveredRecipients.length > 0)) {
          // Balance recovered: Reset alert state so future drops trigger a new alert
          console.log(`[A1TOPUP MONITOR] Balance recovered above ₹${threshold.toFixed(2)}. Resetting alert state.`);
          settings.alertSent = false;
          settings.deliveredRecipients = [];
          wasRecovered = true;
        }

        settings.lastStatus = 'NORMAL';
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold,
          detectedAt: new Date(),
          overallStatus: 'NO_ALERT_NEEDED',
          triggerType,
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return {
          checked: true,
          status: 'NORMAL',
          alertSent: false,
          balance: numericBalance,
          threshold,
          wasRecovered,
          lastSuccessfulCheckAt: settings.lastSuccessfulCheckAt,
          nextCheckAt: settings.nextCheckAt,
        };
      }

      // --- STATUS: LOW (< ₹2,000) ---
      console.log(`[A1TOPUP MONITOR] Current Balance: ₹${numericBalance.toFixed(2)} | Threshold: ₹${threshold.toFixed(2)} | Status: LOW BALANCE (< ₹${threshold})`);
      settings.lastStatus = 'LOW_BALANCE';

      // Normalize configured recipients
      const cleanRecipients = (settings.recipients || [])
        .map(r => String(r).replace(/\D/g, ''))
        .filter(r => r.length >= 10);

      if (cleanRecipients.length === 0) {
        console.error('[A1TOPUP MONITOR ERROR] No valid recipients configured.');
        settings.lastMessagingError = 'No valid recipient phone numbers configured';
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold,
          detectedAt: new Date(),
          overallStatus: 'FAILED',
          triggerType,
          errorDetails: 'No valid recipient phone numbers configured',
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return { checked: true, status: 'LOW_BALANCE', alertSent: false, reason: 'NO_RECIPIENTS', balance: numericBalance };
      }

      // Ensure deliveredRecipients array exists
      if (!Array.isArray(settings.deliveredRecipients)) {
        settings.deliveredRecipients = [];
      }

      // Check duplicate alert suppression:
      // If already alerted both recipients and not a forced manual check, skip re-sending
      const undeliveredRecipients = cleanRecipients.filter(r => !settings.deliveredRecipients.includes(r));

      if (!force && settings.alertSent && undeliveredRecipients.length === 0) {
        console.log(`[A1TOPUP MONITOR] Balance remains below ₹${threshold}. Alert already dispatched to all recipients; skipping duplicate.`);
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold,
          detectedAt: new Date(),
          overallStatus: 'ALREADY_ALERTED',
          triggerType,
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return {
          checked: true,
          status: 'LOW_BALANCE',
          alertSent: false,
          reason: 'ALREADY_ALERTED',
          balance: numericBalance,
          threshold,
          lastAlertAt: settings.lastAlertAt,
          recipients: cleanRecipients,
        };
      }

      // Determine target recipients for this dispatch:
      // If forced, reset delivered history and send to all; otherwise, send ONLY to undelivered recipients (safe retry)
      if (force) {
        settings.deliveredRecipients = [];
        settings.alertSent = false;
      }

      const targetRecipients = force ? cleanRecipients : undeliveredRecipients;

      console.log(`[A1TOPUP MONITOR] Dispatching low-balance alerts to ${targetRecipients.length} recipient(s): [${targetRecipients.join(', ')}]`);

      const detectedAtIST = this.formatISTDate(new Date());
      const formattedBalance = numericBalance.toFixed(2);
      const formattedThreshold = threshold.toFixed(2);
      const channel = settings.channel || 'WHATSAPP';

      const recipientsStatus = [];
      let successCount = 0;
      let failureErrors = [];

      for (const recipientNumber of targetRecipients) {
        try {
          if (channel === 'SMS') {
            // Fast2SMS Quick SMS Dispatch
            const smsMessage = `A1 Recharge Alert: Your A1Topup wallet balance is ₹${formattedBalance}, below the ₹${formattedThreshold} threshold. Detected at ${detectedAtIST}. Please replenish the provider wallet to avoid recharge failures.`;
            const smsRes = await fast2smsService.sendSMS({
              phone: recipientNumber,
              message: smsMessage,
            });

            if (smsRes && smsRes.success) {
              console.log(`[A1TOPUP MONITOR SMS] Recipient ${recipientNumber}: SENT (ReqId: ${smsRes.requestId || 'OK'})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'SENT',
                requestId: smsRes.requestId || 'ACCEPTED',
                channel: 'SMS',
                sentAt: new Date(),
              });
              if (!settings.deliveredRecipients.includes(recipientNumber)) {
                settings.deliveredRecipients.push(recipientNumber);
              }
              successCount++;
            } else {
              const errMsg = smsRes?.error || 'Fast2SMS SMS rejected message';
              console.error(`[A1TOPUP MONITOR SMS] Recipient ${recipientNumber}: FAILED (${errMsg})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'FAILED',
                errorDetails: errMsg,
                channel: 'SMS',
                sentAt: new Date(),
              });
              failureErrors.push(`${recipientNumber}: ${errMsg}`);
            }

          } else {
            // WhatsApp Dispatch using existing approved template (provider_wallet_low_balance, ID: 27147)
            const variablesValues = `${formattedBalance}|${detectedAtIST}`;
            const waResponse = await fast2smsWhatsAppService.sendWhatsAppMessage({
              messageId: settings.messageId || 27147,
              phoneNumberId: settings.phoneNumberId || '1294250930429862',
              numbers: recipientNumber,
              variablesValues,
              source: 'A1TOPUP_LOW_BALANCE_MONITOR',
              skipDbLog: false,
            });

            // Fast2SMS WhatsApp API response check
            const isSuccess = waResponse && (waResponse.return === true || waResponse.success !== false) && !waResponse.error;
            const reqId = waResponse?.request_id || waResponse?.data?.request_id || null;

            if (isSuccess) {
              console.log(`[A1TOPUP MONITOR WHATSAPP] Recipient ${recipientNumber}: SENT (ReqId: ${reqId || 'OK'})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'SENT',
                requestId: reqId || 'ACCEPTED',
                channel: 'WHATSAPP',
                sentAt: new Date(),
              });
              if (!settings.deliveredRecipients.includes(recipientNumber)) {
                settings.deliveredRecipients.push(recipientNumber);
              }
              successCount++;
            } else {
              const errMsg = waResponse?.message || waResponse?.error || 'WhatsApp message rejected';
              console.error(`[A1TOPUP MONITOR WHATSAPP] Recipient ${recipientNumber}: FAILED (${errMsg})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'FAILED',
                errorDetails: errMsg,
                channel: 'WHATSAPP',
                sentAt: new Date(),
              });
              failureErrors.push(`${recipientNumber}: ${errMsg}`);
            }
          }
        } catch (dispatchErr) {
          console.error(`[A1TOPUP MONITOR DISPATCH ERROR] Recipient ${recipientNumber}:`, dispatchErr.message);
          recipientsStatus.push({
            recipient: recipientNumber,
            status: 'FAILED',
            errorDetails: dispatchErr.message,
            channel,
            sentAt: new Date(),
          });
          failureErrors.push(`${recipientNumber}: ${dispatchErr.message}`);
        }
      }

      // Check if all configured recipients have received the alert
      const allDelivered = cleanRecipients.every(r => settings.deliveredRecipients.includes(r));
      if (allDelivered) {
        settings.alertSent = true;
      }

      if (successCount > 0) {
        settings.lastAlertAt = new Date();
        settings.lastAlertBalance = numericBalance;
        settings.lastMessagingError = failureErrors.length > 0 ? failureErrors.join('; ') : null;
      } else {
        settings.lastMessagingError = failureErrors.join('; ') || 'All recipients failed to receive message';
      }

      settings.lastRecipientsStatus = recipientsStatus;
      await settings.save();

      // Determine overall log status
      let overallStatus = 'FAILED';
      if (cleanRecipients.length > 0 && successCount === cleanRecipients.length) {
        overallStatus = 'ALERT_SENT';
      } else if (allDelivered && !force) {
        overallStatus = 'ALERT_SENT';
      } else if (successCount > 0) {
        overallStatus = 'PARTIAL_SUCCESS';
      }

      await ProviderAutomationLog.create({
        transactionId,
        rechargeOrderId: transactionDoc?.orderId || null,
        rechargeAmount: transactionDoc?.amount || 0,
        providerName: settings.providerName,
        providerBalance: numericBalance,
        threshold,
        detectedAt: new Date(),
        overallStatus,
        triggerType,
        recipientsStatus,
        errorDetails: failureErrors.length > 0 ? failureErrors.join('; ') : null,
        executionTimeMs: Date.now() - startTime,
      }).catch(e => console.error('[A1TOPUP MONITOR] Failed to save log:', e.message));

      return {
        checked: true,
        status: 'LOW_BALANCE',
        alertSent: successCount > 0,
        overallStatus,
        balance: numericBalance,
        threshold,
        recipientsStatus,
        lastAlertAt: settings.lastAlertAt,
        deliveredRecipients: settings.deliveredRecipients,
      };

    } catch (err) {
      console.error('[A1TOPUP MONITOR CRITICAL ERROR] Execution failed:', err);
      return { checked: false, error: err.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Compatibility wrapper for existing recharge flow hooks
   */
  async checkAndTriggerLowBalanceAlert(transactionDoc) {
    if (!transactionDoc) return;
    const transactionId = transactionDoc.orderId || transactionDoc._id?.toString() || `TXN_${Date.now()}`;

    // Prevent re-running if already processed for this specific recharge order
    const existingLog = await ProviderAutomationLog.findOne({ transactionId });
    if (existingLog) {
      console.log(`[A1TOPUP LOW BALANCE AUTOMATION] Transaction ${transactionId} already evaluated.`);
      return existingLog;
    }

    await this.checkBalanceAndAlert({
      force: true,
      triggerType: 'RECHARGE_EVENT',
      transactionDoc,
    });

    return await ProviderAutomationLog.findOne({ transactionId });
  }
}

module.exports = new ProviderAutomationService();
