const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('./providers/provider.factory');
const fast2smsWhatsAppService = require('./fast2smsWhatsApp.service');
const fast2smsService = require('./fast2sms.service');

/**
 * Three New Approved Fast2SMS WhatsApp Templates for A1 Topup Provider Wallet Monitoring
 * Category: Utility, Language: en
 */
const WALLET_TEMPLATES = {
  LOW_2000: {
    level: 'LOW_2000',
    threshold: 2000,
    name: 'provider_wallet_low_balance_2000',
    messageId: parseInt(process.env.PROVIDER_WALLET_TEMPLATE_2000_MESSAGE_ID || '40230', 10),
    templateId: process.env.PROVIDER_WALLET_TEMPLATE_2000_TEMPLATE_ID || '165519901612689',
    category: 'UTILITY',
    language: 'en',
    description: 'Warn when A1 Topup provider wallet falls below ₹2,000',
  },
  LOW_1000: {
    level: 'LOW_1000',
    threshold: 1000,
    name: 'provider_wallet_low_balance_1000',
    messageId: parseInt(process.env.PROVIDER_WALLET_TEMPLATE_1000_MESSAGE_ID || '40235', 10),
    templateId: process.env.PROVIDER_WALLET_TEMPLATE_1000_TEMPLATE_ID || '112150956740956',
    category: 'UTILITY',
    language: 'en',
    description: 'Urgent warning when A1 Topup provider wallet falls to ₹1,000 or below',
  },
  CRITICAL_500: {
    level: 'CRITICAL_500',
    threshold: 500,
    name: 'provider_wallet_critical_balance_500',
    messageId: parseInt(process.env.PROVIDER_WALLET_TEMPLATE_500_MESSAGE_ID || '40237', 10),
    templateId: process.env.PROVIDER_WALLET_TEMPLATE_500_TEMPLATE_ID || '193212102821660',
    category: 'UTILITY',
    language: 'en',
    description: 'Critical alert when A1 Topup provider wallet falls to ₹500 or below',
  },
};

class ProviderAutomationService {
  constructor() {
    this.inFlightBalancePromise = null;
    this.lastSuccessfulBalance = null;
    this.lastSuccessfulCheckAt = null;
    this.lastCheckError = null;
  }

  /**
   * Safe phone normalization:
   * Strips non-digits, handles 10-digit Indian numbers, strips redundant leading '91' or '0'.
   * Never adds country code twice.
   */
  normalizePhoneNumbers(numbersInput) {
    let list = [];
    if (Array.isArray(numbersInput)) {
      list = numbersInput;
    } else if (typeof numbersInput === 'string') {
      list = numbersInput.split(',');
    }

    const clean = [];
    for (const raw of list) {
      if (!raw) continue;
      let digits = String(raw).replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
      }
      if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      if (digits.length === 10 && !clean.includes(digits)) {
        clean.push(digits);
      }
    }
    return clean;
  }

  /**
   * Mask phone numbers in ordinary audit logs (e.g. 82****6399)
   */
  maskPhone(phone) {
    const str = String(phone || '');
    if (str.length <= 4) return '****';
    return `${str.slice(0, 2)}****${str.slice(-4)}`;
  }

  /**
   * Format Date into Asia/Kolkata IST string without trailing "IST"
   * (Approved Fast2SMS WhatsApp templates already include "IST" right after {{2}})
   * Example: "28 Oct 2026, 11:45 am"
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
    return formatted;
  }

  /**
   * Get configured recipient phone numbers with priority:
   * 1. PROVIDER_WALLET_ALERT_PHONE_NUMBERS
   * 2. Fallback to legacy A1TOPUP_WALLET_ALERT_PHONE_1, A1TOPUP_WALLET_ALERT_PHONE_2
   * 3. Default: ['8275366399', '9100329521']
   */
  getConfiguredRecipients() {
    const envVal = process.env.PROVIDER_WALLET_ALERT_PHONE_NUMBERS;
    if (envVal) {
      const parsed = this.normalizePhoneNumbers(envVal);
      if (parsed.length > 0) return parsed;
    }

    const legacy1 = process.env.A1TOPUP_WALLET_ALERT_PHONE_1;
    const legacy2 = process.env.A1TOPUP_WALLET_ALERT_PHONE_2;
    if (legacy1 || legacy2) {
      const parsed = this.normalizePhoneNumbers([legacy1, legacy2].filter(Boolean));
      if (parsed.length > 0) return parsed;
    }

    return ['8275366399', '9100329521'];
  }

  /**
   * Get or initialize automation settings from MongoDB.
   * Automatically migrates legacy settings if old template (27147) was present.
   */
  async getSettings() {
    const defaultRecipients = this.getConfiguredRecipients();
    const envEnabled = process.env.PROVIDER_WALLET_ALERT_ENABLED !== undefined
      ? process.env.PROVIDER_WALLET_ALERT_ENABLED === 'true'
      : (process.env.A1TOPUP_WALLET_ALERT_ENABLED !== undefined ? process.env.A1TOPUP_WALLET_ALERT_ENABLED === 'true' : true);

    const envMinRefreshSeconds = parseInt(process.env.PROVIDER_WALLET_BALANCE_MIN_REFRESH_SECONDS || '60', 10);
    const envReconcileMinutes = parseInt(
      process.env.PROVIDER_WALLET_BALANCE_RECONCILE_MINUTES ||
      process.env.A1TOPUP_WALLET_CHECK_INTERVAL_MINUTES ||
      '15',
      10
    );

    let settings = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });

    if (!settings) {
      settings = await ProviderAutomationSettings.create({
        automationKey: 'a1topup_low_balance',
        enabled: envEnabled,
        providerName: 'A1Topup',
        recipients: defaultRecipients,
        channel: 'WHATSAPP',
        phoneNumberId: '1294250930429862',
        minRefreshSeconds: envMinRefreshSeconds,
        reconcileIntervalMinutes: envReconcileMinutes,
        monitoringStatus: 'ACTIVE',
        currentThresholdState: 'UNKNOWN',
        isRecovered: true,
        thresholdAlerts: {
          LOW_2000: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.LOW_2000.messageId,
            templateId: WALLET_TEMPLATES.LOW_2000.templateId,
            templateName: WALLET_TEMPLATES.LOW_2000.name,
            deliveredRecipients: [],
          },
          LOW_1000: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.LOW_1000.messageId,
            templateId: WALLET_TEMPLATES.LOW_1000.templateId,
            templateName: WALLET_TEMPLATES.LOW_1000.name,
            deliveredRecipients: [],
          },
          CRITICAL_500: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.CRITICAL_500.messageId,
            templateId: WALLET_TEMPLATES.CRITICAL_500.templateId,
            templateName: WALLET_TEMPLATES.CRITICAL_500.name,
            deliveredRecipients: [],
          },
        },
      });
    } else {
      let needsSave = false;

      // Migrate from old template structures (27147, 30522, provider_wallet_low_balance, provider_wallet_low_balance_500) if found
      if (
        settings.messageId === 27147 ||
        settings.messageId === 30522 ||
        settings.templateName === 'provider_wallet_low_balance' ||
        settings.templateName === 'provider_wallet_low_balance_500'
      ) {
        settings.messageId = WALLET_TEMPLATES.LOW_2000.messageId;
        settings.templateName = WALLET_TEMPLATES.LOW_2000.name;
        needsSave = true;
      }

      if (!settings.thresholdAlerts || !settings.thresholdAlerts.LOW_2000) {
        settings.thresholdAlerts = {
          LOW_2000: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.LOW_2000.messageId,
            templateId: WALLET_TEMPLATES.LOW_2000.templateId,
            templateName: WALLET_TEMPLATES.LOW_2000.name,
            deliveredRecipients: [],
          },
          LOW_1000: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.LOW_1000.messageId,
            templateId: WALLET_TEMPLATES.LOW_1000.templateId,
            templateName: WALLET_TEMPLATES.LOW_1000.name,
            deliveredRecipients: [],
          },
          CRITICAL_500: {
            alertSent: false,
            messageId: WALLET_TEMPLATES.CRITICAL_500.messageId,
            templateId: WALLET_TEMPLATES.CRITICAL_500.templateId,
            templateName: WALLET_TEMPLATES.CRITICAL_500.name,
            deliveredRecipients: [],
          },
        };
        needsSave = true;
      }

      // Synchronize approved template IDs
      if (settings.thresholdAlerts.LOW_2000) {
        settings.thresholdAlerts.LOW_2000.messageId = WALLET_TEMPLATES.LOW_2000.messageId;
        settings.thresholdAlerts.LOW_2000.templateId = WALLET_TEMPLATES.LOW_2000.templateId;
        settings.thresholdAlerts.LOW_2000.templateName = WALLET_TEMPLATES.LOW_2000.name;
      }
      if (settings.thresholdAlerts.LOW_1000) {
        settings.thresholdAlerts.LOW_1000.messageId = WALLET_TEMPLATES.LOW_1000.messageId;
        settings.thresholdAlerts.LOW_1000.templateId = WALLET_TEMPLATES.LOW_1000.templateId;
        settings.thresholdAlerts.LOW_1000.templateName = WALLET_TEMPLATES.LOW_1000.name;
      }
      if (settings.thresholdAlerts.CRITICAL_500) {
        settings.thresholdAlerts.CRITICAL_500.messageId = WALLET_TEMPLATES.CRITICAL_500.messageId;
        settings.thresholdAlerts.CRITICAL_500.templateId = WALLET_TEMPLATES.CRITICAL_500.templateId;
        settings.thresholdAlerts.CRITICAL_500.templateName = WALLET_TEMPLATES.CRITICAL_500.name;
      }

      if (!settings.minRefreshSeconds) {
        settings.minRefreshSeconds = envMinRefreshSeconds;
        needsSave = true;
      }
      if (!settings.reconcileIntervalMinutes) {
        settings.reconcileIntervalMinutes = envReconcileMinutes;
        needsSave = true;
      }

      if (needsSave) {
        await settings.save().catch(() => {});
      }
    }

    // Initialize in-memory cache from persisted settings if empty
    if (this.lastSuccessfulBalance === null && typeof settings.lastBalance === 'number') {
      this.lastSuccessfulBalance = settings.lastBalance;
      this.lastSuccessfulCheckAt = settings.lastSuccessfulCheckAt || settings.lastCheckAt || null;
    }

    return settings;
  }

  /**
   * Acquire distributed lease lock for the 15-minute reconciliation scheduler.
   * Ensures only one instance executes reconciliation across multi-instance deployments.
   */
  async acquireReconciliationLock(instanceId = `${process.pid}_${Date.now()}`) {
    const now = new Date();
    const lockDurationMs = 2 * 60 * 1000; // 2 minutes lease
    const lockUntil = new Date(now.getTime() + lockDurationMs);

    const lockedSettings = await ProviderAutomationSettings.findOneAndUpdate(
      {
        automationKey: 'a1topup_low_balance',
        $or: [
          { reconcileLockUntil: { $exists: false } },
          { reconcileLockUntil: null },
          { reconcileLockUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          reconcileLockUntil: lockUntil,
          reconcileLockedBy: instanceId,
        },
      },
      { new: true }
    );

    return Boolean(lockedSettings);
  }

  /**
   * Release distributed lease lock after reconciliation completes
   */
  async releaseReconciliationLock() {
    await ProviderAutomationSettings.updateOne(
      { automationKey: 'a1topup_low_balance' },
      { $set: { reconcileLockUntil: null, reconcileLockedBy: null } }
    ).catch(() => {});
  }

  /**
   * Optimized Balance Fetching:
   * 1. If an API request is currently in-flight, returns shared promise (concurrency deduplication).
   * 2. Reuses cached balance if fetched within PROVIDER_WALLET_BALANCE_MIN_REFRESH_SECONDS (default 60s) unless force=true.
   * 3. Uses verified A1 Topup provider balance endpoint.
   * 4. Never estimates provider balance from recharge amounts.
   * 5. Never substitutes failed API response with zero.
   * 6. Retains last known balance on error.
   */
  async getProviderBalance({ force = false } = {}) {
    if (this.inFlightBalancePromise) {
      console.log('[A1TOPUP MONITOR] Concurrency Protection: Reusing active in-flight provider balance request.');
      return await this.inFlightBalancePromise;
    }

    const minRefreshSeconds = parseInt(process.env.PROVIDER_WALLET_BALANCE_MIN_REFRESH_SECONDS || '60', 10);
    const now = Date.now();

    if (
      !force &&
      this.lastSuccessfulBalance !== null &&
      this.lastSuccessfulCheckAt &&
      (now - this.lastSuccessfulCheckAt.getTime() < minRefreshSeconds * 1000)
    ) {
      const ageSec = Math.round((now - this.lastSuccessfulCheckAt.getTime()) / 1000);
      console.log(`[A1TOPUP MONITOR] Cached balance reuse: ₹${this.lastSuccessfulBalance.toFixed(2)} (${ageSec}s old, min refresh: ${minRefreshSeconds}s).`);
      return {
        success: true,
        cached: true,
        balance: this.lastSuccessfulBalance,
        checkedAt: this.lastSuccessfulCheckAt,
      };
    }

    this.inFlightBalancePromise = (async () => {
      try {
        const settings = await this.getSettings();
        const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
        
        const balanceResult = await provider.balance();

        let numericBalance = null;
        if (balanceResult && balanceResult.success && typeof balanceResult.balance === 'number' && !isNaN(balanceResult.balance)) {
          numericBalance = balanceResult.balance;
        } else if (balanceResult && typeof balanceResult.balance === 'string' && !isNaN(Number(balanceResult.balance))) {
          numericBalance = parseFloat(balanceResult.balance);
        }

        if (numericBalance === null || isNaN(numericBalance)) {
          throw new Error(`Invalid balance format returned from provider: ${JSON.stringify(balanceResult)}`);
        }

        this.lastSuccessfulBalance = numericBalance;
        this.lastSuccessfulCheckAt = new Date();
        this.lastCheckError = null;

        return {
          success: true,
          cached: false,
          balance: numericBalance,
          checkedAt: this.lastSuccessfulCheckAt,
        };
      } finally {
        this.inFlightBalancePromise = null;
      }
    })();

    return await this.inFlightBalancePromise;
  }

  /**
   * Evaluate balance against thresholds (lowest applicable threshold first):
   * - <= 500: CRITICAL_500 (Template 3)
   * - <= 1000: LOW_1000 (Template 2)
   * - < 2000: LOW_2000 (Template 1)
   * - >= 2000: NORMAL (No alert)
   */
  evaluateThreshold(balance) {
    const bal = Number(balance);
    if (isNaN(bal)) return null;

    if (bal <= 500) {
      return WALLET_TEMPLATES.CRITICAL_500;
    }
    if (bal <= 1000) {
      return WALLET_TEMPLATES.LOW_1000;
    }
    if (bal < 2000) {
      return WALLET_TEMPLATES.LOW_2000;
    }
    return null;
  }

  /**
   * Dispatch WhatsApp notification with bounded exponential backoff
   * Does not retry indefinitely; avoids runaway loops.
   */
  async sendWhatsAppWithRetry({
    messageId,
    phoneNumberId,
    recipient,
    variablesValues,
    source,
    maxRetries = 2,
  }) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const res = await fast2smsWhatsAppService.sendWhatsAppMessage({
          messageId,
          phoneNumberId,
          numbers: recipient,
          variablesValues,
          source,
          skipDbLog: false,
        });

        const isSuccess = res && (res.return === true || res.success !== false) && !res.error;
        if (isSuccess) {
          const reqId = res?.request_id || res?.data?.request_id || 'ACCEPTED';
          return {
            success: true,
            requestId: reqId,
            response: res,
            attempts: attempt + 1,
          };
        } else {
          const errMsg = res?.message || res?.error || 'Fast2SMS rejected message';
          throw new Error(errMsg);
        }
      } catch (err) {
        lastError = err;
        attempt++;
        console.warn(`[A1TOPUP MONITOR] Dispatch to ${this.maskPhone(recipient)} (attempt ${attempt}/${maxRetries + 1}) failed: ${err.message}`);
        if (attempt <= maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Dispatch failed after retries',
      attempts: attempt,
    };
  }

  /**
   * Core Monitoring Execution:
   * Event-driven check + Fallback reconciliation + Persistent Multi-Threshold State in MongoDB.
   *
   * @param {Object} options
   * @param {boolean} options.force - Force live balance fetch (e.g. manual admin refresh)
   * @param {boolean} options.forceAlert - Force resending alerts even if previously delivered
   * @param {string} options.triggerType - 'RECHARGE_EVENT' | 'RECONCILIATION' | 'MANUAL_CHECK' | 'EXTERNAL_CRON'
   * @param {Object} options.transactionDoc - Optional recharge transaction document
   */
  async checkBalanceAndAlert(options = {}) {
    const {
      force = false,
      forceAlert = false,
      triggerType = 'RECONCILIATION',
      transactionDoc = null,
    } = options;

    const startTime = Date.now();
    const transactionId = transactionDoc
      ? (transactionDoc.orderId || transactionDoc._id?.toString() || `TXN_${Date.now()}`)
      : `CHK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      console.log(`[A1TOPUP MONITOR] Wallet check started (Trigger: ${triggerType}, Force: ${force})...`);

      const settings = await this.getSettings();

      if (!settings.enabled && !force && !forceAlert) {
        console.log('[A1TOPUP MONITOR] Monitoring is currently disabled in settings.');
        settings.monitoringStatus = 'DISABLED';
        await settings.save().catch(() => {});
        return { checked: false, status: 'DISABLED', reason: 'AUTOMATION_DISABLED' };
      }

      // 1. Fetch Real Balance (Respecting 60s minimum refresh interval & concurrent promise sharing)
      let balanceData;
      try {
        balanceData = await this.getProviderBalance({ force });
      } catch (err) {
        console.error('[A1TOPUP MONITOR ERROR] Provider balance API fetch failed:', err.message);

        settings.lastCheckAt = new Date();
        settings.lastCheckError = err.message || 'Provider balance API error';
        settings.monitoringStatus = 'ERROR';
        await settings.save().catch(() => {});

        // Never substitute failed API with zero balance! Retain last known balance.
        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: settings.lastBalance || null,
          threshold: 2000,
          thresholdLevel: 'UNKNOWN',
          detectedAt: new Date(),
          overallStatus: 'ERROR_SKIPPED',
          triggerType,
          errorDetails: `Provider balance fetch failed: ${err.message}`,
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

      const numericBalance = balanceData.balance;
      const reconcileMinutes = settings.reconcileIntervalMinutes || 15;
      const nextReconcileAt = new Date(Date.now() + reconcileMinutes * 60 * 1000);

      settings.lastCheckAt = new Date();
      settings.lastSuccessfulCheckAt = balanceData.checkedAt || new Date();
      settings.lastBalance = numericBalance;
      settings.lastCheckError = null;
      settings.nextReconcileAt = nextReconcileAt;
      settings.monitoringStatus = 'ACTIVE';

      // 2. Evaluate Threshold Level
      const targetConfig = this.evaluateThreshold(numericBalance);

      // --- CASE A: BALANCE NORMAL (>= ₹2,000) ---
      if (!targetConfig) {
        console.log(`[A1TOPUP MONITOR] Balance: ₹${numericBalance.toFixed(2)} | Status: NORMAL (>= ₹2,000). No alert required.`);

        let wasRecovered = false;
        if (
          settings.currentThresholdState !== 'NORMAL' ||
          !settings.isRecovered ||
          settings.thresholdAlerts?.LOW_2000?.alertSent ||
          settings.thresholdAlerts?.LOW_1000?.alertSent ||
          settings.thresholdAlerts?.CRITICAL_500?.alertSent
        ) {
          console.log(`[A1TOPUP MONITOR] RECOVERY DETECTED: Balance recovered above ₹2,000. Resetting alert threshold states.`);
          wasRecovered = true;
          settings.isRecovered = true;
          settings.lastRecoveredAt = new Date();
          settings.currentThresholdState = 'NORMAL';
          settings.lastStatus = 'NORMAL';
          settings.alertSent = false;
          settings.deliveredRecipients = [];

          // Reset each threshold cycle so subsequent drops trigger alerts
          ['LOW_2000', 'LOW_1000', 'CRITICAL_500'].forEach(lvl => {
            if (settings.thresholdAlerts && settings.thresholdAlerts[lvl]) {
              settings.thresholdAlerts[lvl].alertSent = false;
              settings.thresholdAlerts[lvl].deliveredRecipients = [];
              settings.thresholdAlerts[lvl].recipientsStatus = [];
            }
          });
        }

        settings.currentThresholdState = 'NORMAL';
        settings.lastStatus = 'NORMAL';
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold: 2000,
          thresholdLevel: 'NORMAL',
          detectedAt: new Date(),
          overallStatus: wasRecovered ? 'RECOVERED' : 'NO_ALERT_NEEDED',
          triggerType,
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return {
          checked: true,
          status: 'NORMAL',
          alertSent: false,
          balance: numericBalance,
          wasRecovered,
          lastSuccessfulCheckAt: settings.lastSuccessfulCheckAt,
          nextReconcileAt: settings.nextReconcileAt,
        };
      }

      // --- CASE B: THRESHOLD BREACH (LOW_2000, LOW_1000, or CRITICAL_500) ---
      const activeLevel = targetConfig.level;
      console.log(`[A1TOPUP MONITOR] Balance: ₹${numericBalance.toFixed(2)} | Level: ${activeLevel} (Threshold: ₹${targetConfig.threshold}) | Template: ${targetConfig.name}`);

      settings.currentThresholdState = activeLevel;
      settings.lastStatus = 'LOW_BALANCE';
      settings.isRecovered = false;

      // Clean & normalize configured recipients
      const cleanRecipients = this.normalizePhoneNumbers(settings.recipients);
      if (cleanRecipients.length === 0) {
        console.error('[A1TOPUP MONITOR ERROR] No valid recipient phone numbers configured.');
        settings.lastMessagingError = 'No valid recipient phone numbers configured';
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold: targetConfig.threshold,
          thresholdLevel: activeLevel,
          templateName: targetConfig.name,
          templateId: targetConfig.templateId,
          messageId: targetConfig.messageId,
          detectedAt: new Date(),
          overallStatus: 'FAILED',
          triggerType,
          errorDetails: 'No valid recipient phone numbers configured',
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return {
          checked: true,
          status: activeLevel,
          alertSent: false,
          reason: 'NO_RECIPIENTS',
          balance: numericBalance,
        };
      }

      // Ensure threshold subdoc exists
      if (!settings.thresholdAlerts[activeLevel]) {
        settings.thresholdAlerts[activeLevel] = {
          alertSent: false,
          messageId: targetConfig.messageId,
          templateId: targetConfig.templateId,
          templateName: targetConfig.name,
          deliveredRecipients: [],
          recipientsStatus: [],
        };
      }

      const alertInfo = settings.thresholdAlerts[activeLevel];
      alertInfo.messageId = targetConfig.messageId;
      alertInfo.templateId = targetConfig.templateId;
      alertInfo.templateName = targetConfig.name;

      if (!Array.isArray(alertInfo.deliveredRecipients)) {
        alertInfo.deliveredRecipients = [];
      }

      // Check duplicate alert suppression:
      // If already alerted both recipients and not forcing, skip re-sending
      const undeliveredRecipients = cleanRecipients.filter(r => !alertInfo.deliveredRecipients.includes(r));

      if (!forceAlert && alertInfo.alertSent && undeliveredRecipients.length === 0) {
        console.log(`[A1TOPUP MONITOR] Balance remains in ${activeLevel} range (₹${numericBalance.toFixed(2)}). Alert already dispatched to all recipients; duplicate suppressed.`);
        await settings.save();

        await ProviderAutomationLog.create({
          transactionId,
          rechargeOrderId: transactionDoc?.orderId || null,
          rechargeAmount: transactionDoc?.amount || 0,
          providerName: settings.providerName,
          providerBalance: numericBalance,
          threshold: targetConfig.threshold,
          thresholdLevel: activeLevel,
          templateName: targetConfig.name,
          templateId: targetConfig.templateId,
          messageId: targetConfig.messageId,
          detectedAt: new Date(),
          overallStatus: 'ALREADY_ALERTED',
          triggerType,
          executionTimeMs: Date.now() - startTime,
        }).catch(() => {});

        return {
          checked: true,
          status: activeLevel,
          alertSent: false,
          reason: 'ALREADY_ALERTED',
          balance: numericBalance,
          threshold: targetConfig.threshold,
          lastAlertAt: alertInfo.lastAlertAt || settings.lastAlertAt,
          recipients: cleanRecipients,
        };
      }

      // Target recipients for dispatch: send ONLY to undelivered recipients (or all if forceAlert)
      if (forceAlert) {
        alertInfo.deliveredRecipients = [];
        alertInfo.alertSent = false;
      }

      const targetRecipients = forceAlert ? cleanRecipients : undeliveredRecipients;
      console.log(`[A1TOPUP MONITOR] Dispatching ${activeLevel} alert to ${targetRecipients.length} recipient(s): [${targetRecipients.map(r => this.maskPhone(r)).join(', ')}]`);

      const detectedAtIST = this.formatISTDate(new Date());
      const formattedBalance = numericBalance.toFixed(2);
      const variablesValues = `${formattedBalance}|${detectedAtIST}`;
      const channel = settings.channel || 'WHATSAPP';

      const recipientsStatus = [];
      let successCount = 0;
      const failureErrors = [];

      // Send to both recipients independently
      for (const recipientNumber of targetRecipients) {
        try {
          if (channel === 'SMS') {
            const smsMessage = `A1 Recharge Alert: Your A1Topup wallet balance is ₹${formattedBalance}, at or below ₹${targetConfig.threshold}. Detected at ${detectedAtIST} IST. Please replenish provider wallet immediately.`;
            const smsRes = await fast2smsService.sendSMS({
              phone: recipientNumber,
              message: smsMessage,
            });

            if (smsRes && smsRes.success) {
              console.log(`[A1TOPUP MONITOR SMS] Recipient ${this.maskPhone(recipientNumber)}: SENT (ReqId: ${smsRes.requestId || 'OK'})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'SENT',
                requestId: smsRes.requestId || 'ACCEPTED',
                channel: 'SMS',
                sentAt: new Date(),
              });
              if (!alertInfo.deliveredRecipients.includes(recipientNumber)) {
                alertInfo.deliveredRecipients.push(recipientNumber);
              }
              successCount++;
            } else {
              const errMsg = smsRes?.error || 'SMS rejected';
              console.error(`[A1TOPUP MONITOR SMS] Recipient ${this.maskPhone(recipientNumber)}: FAILED (${errMsg})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'FAILED',
                errorDetails: errMsg,
                channel: 'SMS',
                sentAt: new Date(),
              });
              failureErrors.push(`${this.maskPhone(recipientNumber)}: ${errMsg}`);
            }
          } else {
            // WhatsApp Dispatch using the applicable approved Fast2SMS template
            const waDispatch = await this.sendWhatsAppWithRetry({
              messageId: targetConfig.messageId,
              phoneNumberId: settings.phoneNumberId || '1294250930429862',
              recipient: recipientNumber,
              variablesValues,
              source: `A1TOPUP_MONITOR_${activeLevel}`,
              maxRetries: 2,
            });

            if (waDispatch.success) {
              console.log(`[A1TOPUP MONITOR WHATSAPP] Recipient ${this.maskPhone(recipientNumber)}: SENT (ReqId: ${waDispatch.requestId})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'SENT',
                requestId: waDispatch.requestId,
                channel: 'WHATSAPP',
                sentAt: new Date(),
              });
              if (!alertInfo.deliveredRecipients.includes(recipientNumber)) {
                alertInfo.deliveredRecipients.push(recipientNumber);
              }
              successCount++;
            } else {
              console.error(`[A1TOPUP MONITOR WHATSAPP] Recipient ${this.maskPhone(recipientNumber)}: FAILED (${waDispatch.error})`);
              recipientsStatus.push({
                recipient: recipientNumber,
                status: 'FAILED',
                errorDetails: waDispatch.error,
                channel: 'WHATSAPP',
                sentAt: new Date(),
              });
              failureErrors.push(`${this.maskPhone(recipientNumber)}: ${waDispatch.error}`);
            }
          }
        } catch (dispatchErr) {
          console.error(`[A1TOPUP MONITOR DISPATCH ERROR] Recipient ${this.maskPhone(recipientNumber)}:`, dispatchErr.message);
          recipientsStatus.push({
            recipient: recipientNumber,
            status: 'FAILED',
            errorDetails: dispatchErr.message,
            channel,
            sentAt: new Date(),
          });
          failureErrors.push(`${this.maskPhone(recipientNumber)}: ${dispatchErr.message}`);
        }
      }

      // Check if all configured recipients have received the alert for this threshold
      const allDelivered = cleanRecipients.every(r => alertInfo.deliveredRecipients.includes(r));
      if (allDelivered) {
        alertInfo.alertSent = true;
      }

      const alertTimestamp = new Date();
      alertInfo.lastAlertAt = alertTimestamp;
      alertInfo.lastAlertBalance = numericBalance;
      alertInfo.recipientsStatus = recipientsStatus;

      // Update parent settings
      settings.alertSent = allDelivered;
      settings.deliveredRecipients = alertInfo.deliveredRecipients;
      settings.lastAlertAt = alertTimestamp;
      settings.lastAlertLevel = activeLevel;
      settings.lastAlertBalance = numericBalance;
      settings.lastRecipientsStatus = recipientsStatus;
      settings.lastMessagingError = failureErrors.length > 0 ? failureErrors.join('; ') : null;

      await settings.save();

      // Overall status
      let overallStatus = 'FAILED';
      if (cleanRecipients.length > 0 && successCount === cleanRecipients.length) {
        overallStatus = 'ALERT_SENT';
      } else if (allDelivered && !forceAlert) {
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
        threshold: targetConfig.threshold,
        thresholdLevel: activeLevel,
        templateName: targetConfig.name,
        templateId: targetConfig.templateId,
        messageId: targetConfig.messageId,
        detectedAt: new Date(),
        overallStatus,
        triggerType,
        recipientsStatus,
        errorDetails: failureErrors.length > 0 ? failureErrors.join('; ') : null,
        executionTimeMs: Date.now() - startTime,
      }).catch(e => console.error('[A1TOPUP MONITOR] Failed to save log:', e.message));

      return {
        checked: true,
        status: activeLevel,
        alertSent: successCount > 0,
        overallStatus,
        balance: numericBalance,
        threshold: targetConfig.threshold,
        templateName: targetConfig.name,
        templateId: targetConfig.templateId,
        messageId: targetConfig.messageId,
        recipientsStatus,
        lastAlertAt: settings.lastAlertAt,
        deliveredRecipients: alertInfo.deliveredRecipients,
      };

    } catch (err) {
      console.error('[A1TOPUP MONITOR CRITICAL ERROR] Execution failed:', err);
      return { checked: false, error: err.message };
    }
  }

  /**
   * Primary Event-Driven Trigger (Called after successful recharge)
   * 1. Finish processing recharge and wallet transaction first.
   * 2. Trigger provider-balance refresh asynchronously.
   * 3. Do not delay or fail customer recharge.
   * 4. Shares in-flight balance request across concurrent recharges.
   * 5. Evaluates thresholds safely without duplicate spam.
   */
  async checkAndTriggerLowBalanceAlert(transactionDoc) {
    if (!transactionDoc) return;
    const transactionId = transactionDoc.orderId || transactionDoc._id?.toString() || `TXN_${Date.now()}`;

    // Prevent duplicate evaluation for the same transaction doc
    const existingLog = await ProviderAutomationLog.findOne({ transactionId });
    if (existingLog) {
      console.log(`[A1TOPUP LOW BALANCE AUTOMATION] Transaction ${transactionId} already evaluated.`);
      return existingLog;
    }

    await this.checkBalanceAndAlert({
      force: false,       // Reuses 60s cache and shares in-flight requests
      forceAlert: false,  // Evaluates state transitions safely without repeated spam
      triggerType: 'RECHARGE_EVENT',
      transactionDoc,
    });

    return await ProviderAutomationLog.findOne({ transactionId });
  }

  /**
   * Fallback Reconciliation Execution:
   * Called by the 15-minute background worker with distributed locking.
   */
  async runReconciliation() {
    const hasLock = await this.acquireReconciliationLock();
    if (!hasLock) {
      console.log('[A1TOPUP MONITOR RECONCILIATION] Another backend instance currently holds reconciliation lease. Skipping.');
      return { skipped: true, reason: 'LOCKED_BY_ANOTHER_INSTANCE' };
    }

    try {
      console.log('[A1TOPUP MONITOR RECONCILIATION] Running 15-minute scheduled reconciliation check...');
      const result = await this.checkBalanceAndAlert({
        force: true,       // Reconciliation ensures live provider balance check
        forceAlert: false,  // Evaluates state transitions safely (no duplicate alerts)
        triggerType: 'RECONCILIATION',
      });
      return result;
    } finally {
      await this.releaseReconciliationLock();
    }
  }

  /**
   * Helper to expose the approved template dictionary
   */
  getTemplates() {
    return WALLET_TEMPLATES;
  }
}

module.exports = new ProviderAutomationService();
