const axios = require('axios');
const querystring = require('querystring');
const PlanApiSyncLog = require('../models/PlanApiSyncLog');
const PlanApiSettings = require('../models/PlanApiSettings');
const AuditLog = require('../models/AuditLog');

const logger = {
  info: (...args) => console.log('[PlanApiService]', ...args),
  warn: (...args) => console.warn('[PlanApiService]', ...args),
  error: (...args) => console.error('[PlanApiService]', ...args),
};

// Optional alert services (imported dynamically / safely handled if present)
let fast2smsWhatsAppService;
try {
  fast2smsWhatsAppService = require('./fast2smsWhatsApp.service');
} catch (e) {
  fast2smsWhatsAppService = null;
}

let notificationService;
try {
  notificationService = require('./notification.service');
} catch (e) {
  notificationService = null;
}

class PlanApiService {

  /**
   * Helper to ensure PlanApiSettings document exists
   */
  static async getSettings() {
    let settings = await PlanApiSettings.findOne({ key: 'GLOBAL_PLANAPI_SETTINGS' });
    if (!settings) {
      settings = await PlanApiSettings.create({
        key: 'GLOBAL_PLANAPI_SETTINGS',
        lowBalanceWarning: 500,
        criticalBalance: 100,
        lowRemainingHits: 1000,
        criticalRemainingHits: 200,
        enableWhatsAppAlerts: true,
        enablePushAlerts: true,
        enableInternalNotifications: true,
        autoRefreshInterval: 15,
        alertRecipients: ['8275366399', '9100329521'],
        alertState: {
          balanceAlertSent: false,
          hitAlertSent: false,
        }
      });
    }
    return settings;
  }

  /**
   * Makes raw API call to PlanAPI UserData endpoint matching official cURL spec:
   * POST https://planapi.in/Api/Mobile/UserData
   * Content-Type: application/x-www-form-urlencoded
   * Body: ApiUserID=...&ApiPassword=...
   */
  static async callApiWithRetry(attempt = 1) {
    const baseUrl = process.env.PLANAPI_BASE_URL || 'https://planapi.in';
    const apiUserId = process.env.PLANAPI_USER_ID;
    const apiPassword = process.env.PLANAPI_PASSWORD;

    if (!apiUserId || !apiPassword) {
      throw new Error('PlanAPI credentials missing in environment variables');
    }

    const payload = querystring.stringify({
      ApiUserID: apiUserId,
      ApiPassword: apiPassword,
    });

    console.log('[PLANAPI USERDATA] Request started');
    console.log('[PLANAPI USERDATA] Method: POST');
    console.log(`[PLANAPI USERDATA] URL: ${baseUrl}/Api/Mobile/UserData`);
    console.log('[PLANAPI USERDATA] Content-Type: application/x-www-form-urlencoded');
    console.log(`[PLANAPI USERDATA] ApiUserID: ${apiUserId}`);
    console.log('[PLANAPI USERDATA] ApiPassword: ********');

    const startTime = Date.now();

    try {
      const response = await axios.post(`${baseUrl}/Api/Mobile/UserData`, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10s timeout
      });

      const responseTime = Date.now() - startTime;
      console.log(`[PLANAPI USERDATA] HTTP Status: ${response.status}`);
      console.log('[PLANAPI USERDATA] Response received');
      return { data: response.data, responseTime, statusCode: response.status };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[PLANAPI USERDATA] HTTP Error: ${error.message}`);
      
      // Retry once on timeout or network errors
      if (attempt < 2 && (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || !error.response)) {
        console.warn(`[PLANAPI USERDATA] Request timed out/failed (attempt ${attempt}). Retrying once...`);
        return this.callApiWithRetry(attempt + 1);
      }

      return { error, responseTime, statusCode: error.response?.status || 500 };
    }
  }

  /**
   * Main Sync Method: Calls API, parses response, handles errors, saves sync log
   */
  static async syncData(triggeredBy = 'AUTOMATIC', adminId = null) {
    const settings = await this.getSettings();
    const { data, error, responseTime } = await this.callApiWithRetry(1);

    let syncLogData = {
      balance: null,
      remainingHits: null,
      responseTime: responseTime || 0,
      status: 'FAILED',
      errorMessage: null,
      syncedAt: new Date(),
      triggeredBy,
      ipWhitelisted: true,
      credentialsValid: true,
      rawResponse: null,
    };

    if (error) {
      syncLogData.status = 'OFFLINE';
      syncLogData.errorMessage = `Unable to fetch PlanAPI information: ${error.message}`;
    } else if (data) {
      syncLogData.rawResponse = data;

      console.log('====================================================');
      console.log('[PlanAPI Raw Response]:');
      console.log(JSON.stringify(data, null, 2));
      console.log('====================================================');

      let parsed = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = {};
        }
      }

      let balanceVal = null;
      let hitsVal = null;

      const checkObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        for (const key of Object.keys(obj)) {
          const lowerKey = key.toLowerCase();
          const val = obj[key];

          if (lowerKey === 'userbalance' || lowerKey === 'balance' || lowerKey === 'user_balance') {
            if (val !== null && val !== undefined && val !== '') balanceVal = Number(val);
          }
          if (lowerKey === 'remaininghit' || lowerKey === 'remaininghits' || lowerKey === 'remaining_hit' || lowerKey === 'hits') {
            if (val !== null && val !== undefined && val !== '') hitsVal = Number(val);
          }
        }
      };

      checkObject(parsed);

      const dataContainer = parsed.Data || parsed.DATA || parsed.data;
      if (dataContainer) {
        if (Array.isArray(dataContainer) && dataContainer.length > 0) {
          checkObject(dataContainer[0]);
        } else if (typeof dataContainer === 'object') {
          checkObject(dataContainer);
        }
      }

      if (parsed && (parsed.ERROR !== undefined || parsed.STATUS !== undefined)) {
        if (String(parsed.ERROR) === '5' || parsed.STATUS === '3' || parsed.STATUS === 3) {
          console.log('[PLANAPI USERDATA] Provider Error');
          console.log(`ERROR: ${parsed.ERROR}`);
          console.log(`STATUS: ${parsed.STATUS}`);
          console.log(`MESSAGE: ${parsed.MESSAGE || parsed.message || 'Un Expcted Error'}`);

          syncLogData.status = 'FAILED';
          syncLogData.errorMessage = `Provider Error: ERROR=${parsed.ERROR}, STATUS=${parsed.STATUS}, MESSAGE=${parsed.MESSAGE || 'Un Expcted Error'}`;
        } else if (balanceVal !== null && !isNaN(balanceVal)) {
          syncLogData.balance = Number(balanceVal);
          syncLogData.remainingHits = hitsVal !== null && !isNaN(hitsVal) ? Number(hitsVal) : 0;
          syncLogData.status = 'SUCCESS';
          syncLogData.errorMessage = null;
        } else {
          syncLogData.status = 'FAILED';
          syncLogData.errorMessage = parsed.MESSAGE || parsed.message || 'Unable to parse UserBalance or RemainingHit from response';
        }
      } else if (balanceVal !== null && !isNaN(balanceVal)) {
        syncLogData.balance = Number(balanceVal);
        syncLogData.remainingHits = hitsVal !== null && !isNaN(hitsVal) ? Number(hitsVal) : 0;
        syncLogData.status = 'SUCCESS';
        syncLogData.errorMessage = null;
      } else {
        syncLogData.status = 'FAILED';
        syncLogData.errorMessage = 'Unable to parse UserBalance or RemainingHit from response';
      }
    }

    // Save sync log to DB
    const savedLog = await PlanApiSyncLog.create(syncLogData);

    // Audit Logging
    if (adminId) {
      try {
        await AuditLog.create({
          adminId,
          action: triggeredBy === 'MANUAL' ? 'PLANAPI_REFRESH' : 'PLANAPI_AUTO_SYNC',
          resource: 'PLANAPI',
          resourceId: savedLog._id,
          newValue: { balance: savedLog.balance, remainingHits: savedLog.remainingHits, status: savedLog.status },
          description: `PlanAPI sync completed with status ${savedLog.status} (Balance: ₹${savedLog.balance}, Hits: ${savedLog.remainingHits})`,
        });
      } catch (err) {
        logger.error('Failed to create audit log for PlanAPI sync:', err);
      }
    }

    return savedLog;
  }

  /**
   * Evaluates low balance & low hits alert conditions with hysteresis deduplication
   */
  static async evaluateAlerts(syncLog, settings, adminId = null) {
    let stateUpdated = false;

    // --- 1. Balance Alert Check ---
    const isBalanceLow = syncLog.balance < settings.lowBalanceWarning;
    const isBalanceCritical = syncLog.balance < settings.criticalBalance;

    if (isBalanceLow && !settings.alertState.balanceAlertSent) {
      const alertType = isBalanceCritical ? 'CRITICAL' : 'WARNING';
      const msg = `🚨 PlanAPI Low Balance Alert (${alertType}): Current balance is ₹${syncLog.balance.toFixed(2)} (Threshold: ₹${settings.lowBalanceWarning})`;
      
      await this.dispatchAlert(msg, settings, 'LOW_BALANCE');
      
      settings.alertState.balanceAlertSent = true;
      settings.alertState.lastBalanceAlertAt = new Date();
      stateUpdated = true;

      if (adminId) {
        await AuditLog.create({
          adminId,
          action: 'PLANAPI_ALERT_SENT',
          resource: 'PLANAPI',
          description: `Sent PlanAPI Low Balance alert: ₹${syncLog.balance}`,
        }).catch(() => {});
      }
    } else if (!isBalanceLow && settings.alertState.balanceAlertSent) {
      // Balance recovered above warning threshold -> reset alert trigger
      settings.alertState.balanceAlertSent = false;
      stateUpdated = true;
    }

    // --- 2. Remaining Hits / Fetch Limit Alert Check via PlanApiFetchMonitorService ---
    try {
      const planApiFetchMonitorService = require('./planApiFetchMonitor.service');
      await planApiFetchMonitorService.processRemainingFetches(syncLog.remainingHits);
    } catch (err) {
      logger.error('Failed to process PlanAPI fetch limit alert:', err.message);
    }

    if (stateUpdated) {
      await settings.save();
    }
  }

  /**
   * Dispatches alerts via configured channels (WhatsApp, Firebase Push, Internal Notifications)
   */
  static async dispatchAlert(messageText, settings, alertCategory) {
    const recipients = settings.alertRecipients && settings.alertRecipients.length > 0
      ? settings.alertRecipients
      : ['8275366399', '9100329521'];

    logger.info(`[PLANAPI_ALERT] Dispatching ${alertCategory} alert to ${recipients.join(', ')}`);

    // Channel 1: WhatsApp via Fast2SMS WhatsApp Service
    if (settings.enableWhatsAppAlerts && fast2smsWhatsAppService && typeof fast2smsWhatsAppService.sendTextMessage === 'function') {
      for (const phone of recipients) {
        try {
          await fast2smsWhatsAppService.sendTextMessage(phone, messageText);
        } catch (e) {
          logger.error(`Failed to send PlanAPI WhatsApp alert to ${phone}:`, e);
        }
      }
    }

    // Channel 2 & 3: Internal Notifications / Push Notifications
    if (settings.enableInternalNotifications && notificationService && typeof notificationService.sendSystemNotification === 'function') {
      try {
        await notificationService.sendSystemNotification({
          title: 'PlanAPI Operational Alert',
          message: messageText,
          category: alertCategory,
          recipients: recipients,
        });
      } catch (e) {
        logger.error('Failed to send PlanAPI internal notification:', e);
      }
    }
  }

  /**
   * Helper method to fetch the latest successful PlanAPI sync record.
   * Returns { balance, remainingHits, syncedAt } or null if no valid sync exists.
   */
  static async getLatestValidData() {
    try {
      const latestSuccess = await PlanApiSyncLog.findOne({ status: 'SUCCESS' }).sort({ syncedAt: -1 }).lean();
      if (latestSuccess && latestSuccess.balance !== undefined && latestSuccess.balance !== null && !isNaN(Number(latestSuccess.balance))) {
        return {
          balance: Number(latestSuccess.balance),
          remainingHits: Number(latestSuccess.remainingHits || 0),
          syncedAt: latestSuccess.syncedAt,
        };
      }
      return null;
    } catch (err) {
      logger.error('getLatestValidData error:', err.message);
      return null;
    }
  }

  /**
   * Reusable method to fetch the current PlanAPI wallet balance.
   * Shared by Dashboard API and Wallet Monitor.
   * Returns { success: boolean, balance: number, remainingHits: number, error: string|null }
   */
  static async getPlanApiWalletBalance() {
    try {
      const syncLog = await this.syncData('AUTOMATIC');
      if (syncLog && syncLog.status === 'SUCCESS' && syncLog.balance !== undefined && syncLog.balance !== null && !isNaN(Number(syncLog.balance))) {
        return {
          success: true,
          balance: Number(syncLog.balance),
          remainingHits: Number(syncLog.remainingHits || 0),
          syncedAt: syncLog.syncedAt,
          error: null,
        };
      }
      return {
        success: false,
        balance: 0,
        remainingHits: 0,
        error: syncLog?.errorMessage || 'Failed to fetch PlanAPI wallet balance',
      };
    } catch (err) {
      logger.error('getPlanApiWalletBalance error:', err.message);
      return {
        success: false,
        balance: 0,
        remainingHits: 0,
        error: err.message,
      };
    }
  }
}

module.exports = PlanApiService;
