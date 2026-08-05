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
   * Makes raw API call to PlanAPI UserData endpoint with 1 retry on timeout/network failure
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

    const startTime = Date.now();

    try {
      const response = await axios.post(`${baseUrl}/Api/Mobile/UserData`, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10s timeout
      });

      const responseTime = Date.now() - startTime;
      return { data: response.data, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Retry once on timeout or network errors
      if (attempt < 2 && (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || !error.response)) {
        logger.warn(`PlanAPI request timed out/failed (attempt ${attempt}). Retrying once...`);
        return this.callApiWithRetry(attempt + 1);
      }

      return { error, responseTime };
    }
  }

  /**
   * Main Sync Method: Calls API, parses response, handles errors, saves sync log, evaluates alerts
   */
  static async syncData(triggeredBy = 'AUTOMATIC', adminId = null) {
    const settings = await this.getSettings();
    const { data, error, responseTime } = await this.callApiWithRetry(1);

    let syncLogData = {
      balance: 0,
      remainingHits: 0,
      responseTime: responseTime || 0,
      status: 'SUCCESS',
      errorMessage: null,
      syncedAt: new Date(),
      triggeredBy,
      ipWhitelisted: true,
      credentialsValid: true,
      rawResponse: null,
    };

    if (error) {
      syncLogData.status = 'OFFLINE';
      syncLogData.errorMessage = 'Unable to fetch PlanAPI information.';
      
      if (error.response && error.response.data) {
        const resStr = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
        if (resStr.toLowerCase().includes('ip') || resStr.toLowerCase().includes('whitelist')) {
          syncLogData.ipWhitelisted = false;
          syncLogData.errorMessage = 'Server IP is not whitelisted.';
        } else if (resStr.toLowerCase().includes('credential') || resStr.toLowerCase().includes('password') || resStr.toLowerCase().includes('user')) {
          syncLogData.credentialsValid = false;
          syncLogData.errorMessage = 'PlanAPI credentials are invalid.';
        }
      }
    } else if (data) {
      syncLogData.rawResponse = data;

      // STEP 1: Log COMPLETE raw response from PlanAPI before any parsing
      console.log('====================================================');
      console.log('[PlanAPI Raw Response]:');
      console.log(JSON.stringify(data, null, 2));
      console.log('====================================================');

      // Handle String or JSON response parsing safely
      let parsed = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = {};
        }
      }

      // Check official error messages in payload response
      const message = parsed.Message || parsed.message || parsed.ERROR || parsed.error || '';
      const statusMsg = String(message).toLowerCase();

      // STEP 2 & 3: Deep field extractor for UserBalance & RemainingHit
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

      // 1. Check top-level
      checkObject(parsed);

      // 2. Check parsed.Data or parsed.DATA or parsed.data (Array or Object)
      const dataContainer = parsed.Data || parsed.DATA || parsed.data;
      if (dataContainer) {
        if (Array.isArray(dataContainer) && dataContainer.length > 0) {
          checkObject(dataContainer[0]);
        } else if (typeof dataContainer === 'object') {
          checkObject(dataContainer);
        }
      }

      if ((statusMsg.includes('ip') && statusMsg.includes('whitelist')) || statusMsg.includes('un expcted error') || parsed.ERROR === '5') {
        syncLogData.status = 'FAILED';
        syncLogData.ipWhitelisted = false;
        syncLogData.errorMessage = `PlanAPI returned an Unexpected Server Error (Error Code 5). Please contact PlanAPI support with your API User ID (${apiUserId}).`;
      } else if (statusMsg.includes('invalid') || statusMsg.includes('credential') || statusMsg.includes('unauthorized') || statusMsg.includes('user not valid')) {
        syncLogData.status = 'FAILED';
        syncLogData.credentialsValid = false;
        syncLogData.errorMessage = 'PlanAPI credentials are invalid or user not valid.';
      } else if (balanceVal !== null && !isNaN(balanceVal)) {
        // STEP 3: Mapped exact numerical balance & hits
        syncLogData.balance = Number(balanceVal);
        syncLogData.remainingHits = hitsVal !== null && !isNaN(hitsVal) ? Number(hitsVal) : 0;
        syncLogData.status = 'SUCCESS';
        syncLogData.errorMessage = null;
      } else {
        // STEP 4: Parsing failure error
        syncLogData.status = 'FAILED';
        syncLogData.errorMessage = message || 'Unable to parse UserBalance or RemainingHit from PlanAPI response.';
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

    // Evaluate alerts if sync was successful
    if (savedLog.status === 'SUCCESS') {
      await this.evaluateAlerts(savedLog, settings, adminId);
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

    // --- 2. Remaining Hits Alert Check ---
    const isHitLow = syncLog.remainingHits < settings.lowRemainingHits;
    const isHitCritical = syncLog.remainingHits < settings.criticalRemainingHits;

    if (isHitLow && !settings.alertState.hitAlertSent) {
      const alertType = isHitCritical ? 'CRITICAL' : 'WARNING';
      const msg = `🚨 PlanAPI Low Remaining Hits Alert (${alertType}): Remaining hits are ${syncLog.remainingHits.toLocaleString()} (Threshold: ${settings.lowRemainingHits})`;
      
      await this.dispatchAlert(msg, settings, 'LOW_HITS');
      
      settings.alertState.hitAlertSent = true;
      settings.alertState.lastHitAlertAt = new Date();
      stateUpdated = true;

      if (adminId) {
        await AuditLog.create({
          adminId,
          action: 'PLANAPI_ALERT_SENT',
          resource: 'PLANAPI',
          description: `Sent PlanAPI Low Remaining Hits alert: ${syncLog.remainingHits}`,
        }).catch(() => {});
      }
    } else if (!isHitLow && settings.alertState.hitAlertSent) {
      // Hits recovered above warning threshold -> reset alert trigger
      settings.alertState.hitAlertSent = false;
      stateUpdated = true;
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
}

module.exports = PlanApiService;
