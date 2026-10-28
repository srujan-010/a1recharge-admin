const providerAutomationService = require('../../services/providerAutomation.service');
const ProviderAutomationSettings = require('../../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../../models/ProviderAutomationLog');
const ProviderFactory = require('../../services/providers/provider.factory');
const fast2smsWhatsAppService = require('../../services/fast2smsWhatsApp.service');

// @desc    Get Provider Automation Settings, Multi-Threshold Status & Fast2SMS Templates
// @route   GET /api/admin/provider-automations/settings
// @access  Private (Admin)
const getSettings = async (req, res, next) => {
  try {
    const settings = await providerAutomationService.getSettings();
    const templates = providerAutomationService.getTemplates();

    let nextReconcileAt = settings.nextReconcileAt;
    if (!nextReconcileAt && settings.lastCheckAt) {
      const minutes = settings.reconcileIntervalMinutes || 15;
      nextReconcileAt = new Date(new Date(settings.lastCheckAt).getTime() + minutes * 60 * 1000);
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: settings.enabled,
        providerName: settings.providerName,
        threshold: settings.threshold || 2000,
        recipients: settings.recipients,
        channel: settings.channel || 'WHATSAPP',
        phoneNumberId: settings.phoneNumberId,
        minRefreshSeconds: settings.minRefreshSeconds || 60,
        reconcileIntervalMinutes: settings.reconcileIntervalMinutes || 15,
        monitoringStatus: settings.monitoringStatus || 'ACTIVE',
        currentThresholdState: settings.currentThresholdState || 'UNKNOWN',
        isRecovered: settings.isRecovered !== false,
        lastRecoveredAt: settings.lastRecoveredAt || null,
        thresholdAlerts: settings.thresholdAlerts || {},
        lastBalance: settings.lastBalance,
        lastCheckAt: settings.lastCheckAt,
        lastSuccessfulCheckAt: settings.lastSuccessfulCheckAt || settings.lastCheckAt,
        nextReconcileAt,
        lastAlertAt: settings.lastAlertAt,
        lastAlertLevel: settings.lastAlertLevel || null,
        lastAlertBalance: settings.lastAlertBalance,
        lastStatus: settings.lastStatus || 'NORMAL',
        lastCheckError: settings.lastCheckError || null,
        lastMessagingError: settings.lastMessagingError || null,
        lastRecipientsStatus: settings.lastRecipientsStatus || [],
        templates,
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Provider Automation Settings
// @route   PUT /api/admin/provider-automations/settings
// @access  Private (Admin)
const updateSettings = async (req, res, next) => {
  try {
    const {
      enabled,
      recipients,
      channel,
      minRefreshSeconds,
      reconcileIntervalMinutes,
    } = req.body;

    let settings = await providerAutomationService.getSettings();

    if (typeof enabled === 'boolean') {
      settings.enabled = enabled;
      settings.monitoringStatus = enabled ? 'ACTIVE' : 'DISABLED';
    }

    if (Array.isArray(recipients)) {
      const cleanRecipients = providerAutomationService.normalizePhoneNumbers(recipients);
      if (cleanRecipients.length > 0) {
        settings.recipients = cleanRecipients;
      }
    }

    if (channel && ['WHATSAPP', 'SMS'].includes(channel.toUpperCase())) {
      settings.channel = channel.toUpperCase();
    }

    if (typeof minRefreshSeconds === 'number' && minRefreshSeconds >= 5) {
      settings.minRefreshSeconds = minRefreshSeconds;
    }

    if (typeof reconcileIntervalMinutes === 'number' && reconcileIntervalMinutes >= 1) {
      settings.reconcileIntervalMinutes = reconcileIntervalMinutes;
    }

    settings.updatedBy = req.user?._id;
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Provider wallet monitoring settings updated successfully',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual "Refresh Balance" action for administrators
//          Fetches live balance, updates stored state, and evaluates thresholds safely (no duplicate spam).
// @route   POST /api/admin/provider-automations/check-balance-now
// @access  Private (Admin)
const checkBalanceNow = async (req, res, next) => {
  try {
    console.log('[Admin ProviderAutomation] Manual "Refresh Balance" triggered by admin:', req.user?.phone || req.user?.email || 'admin');

    const result = await providerAutomationService.checkBalanceAndAlert({
      force: true,      // Bypass 60s cache to get live provider balance
      forceAlert: req.body.forceAlert === true, // Only resend if specifically requested
      triggerType: 'MANUAL_CHECK',
    });

    res.status(200).json({
      success: true,
      message: 'Provider balance refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    External Reconciliation / Cron Endpoint (Protected by secret token)
// @route   POST or GET /api/admin/provider-automations/cron/check-balance
// @access  Protected by A1TOPUP_MONITOR_SECRET / CRON_SECRET
const handleCronCheck = async (req, res, next) => {
  try {
    const configuredSecret = process.env.A1TOPUP_MONITOR_SECRET || process.env.CRON_SECRET;
    
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const headerSecret = req.headers['x-cron-secret'];
    const querySecret = req.query.secret;

    const providedSecret = headerSecret || bearerToken || querySecret;

    if (!configuredSecret || providedSecret !== configuredSecret) {
      console.warn('[Cron Auth Warning] Unauthorized attempt to invoke balance check cron');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or missing cron secret authorization.',
      });
    }

    console.log('[Cron Scheduler] Authenticated external reconciliation triggered.');

    const result = await providerAutomationService.runReconciliation();

    res.status(200).json({
      success: true,
      message: 'Reconciliation check executed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Automation Execution Logs
// @route   GET /api/admin/provider-automations/logs
// @access  Private (Admin)
const getLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const total = await ProviderAutomationLog.countDocuments();
    const logs = await ProviderAutomationLog.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Test Alert Preview to specified test mobile number using approved templates
// @route   POST /api/admin/provider-automations/test
// @access  Private (Admin)
const sendTestAlert = async (req, res, next) => {
  try {
    const { testNumber, level = 'LOW_2000', channel: requestedChannel } = req.body;
    if (!testNumber) {
      return res.status(400).json({ success: false, message: 'Test mobile number is required' });
    }

    const cleanNumbers = providerAutomationService.normalizePhoneNumbers(testNumber);
    if (cleanNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit test mobile number' });
    }
    const cleanNumber = cleanNumbers[0];

    const templates = providerAutomationService.getTemplates();
    const targetConfig = templates[level] || templates.LOW_2000;

    const settings = await providerAutomationService.getSettings();
    const balanceData = await providerAutomationService.getProviderBalance({ force: false }).catch(() => null);
    const currentBalance = balanceData?.balance !== undefined ? balanceData.balance : (targetConfig.threshold - 50);

    const detectedAtIST = providerAutomationService.formatISTDate(new Date());
    const formattedBalance = currentBalance.toFixed(2);
    const channel = requestedChannel ? requestedChannel.toUpperCase() : (settings.channel || 'WHATSAPP');

    console.log(`[Admin Test Alert] Dispatching preview ${channel} alert (${targetConfig.name}) to ${providerAutomationService.maskPhone(cleanNumber)}...`);

    let dispatchResponse;
    if (channel === 'SMS') {
      const fast2smsService = require('../../services/fast2sms.service');
      const smsMessage = `A1 Recharge Alert: Your A1Topup wallet balance is ₹${formattedBalance}, at or below ₹${targetConfig.threshold}. Detected at ${detectedAtIST} IST. Please replenish provider wallet immediately.`;
      dispatchResponse = await fast2smsService.sendSMS({
        phone: cleanNumber,
        message: smsMessage,
      });

      if (!dispatchResponse.success) {
        throw new Error(dispatchResponse.error || 'Fast2SMS SMS dispatch failed');
      }
    } else {
      const variablesValues = `${formattedBalance}|${detectedAtIST}`;
      dispatchResponse = await fast2smsWhatsAppService.sendWhatsAppMessage({
        messageId: targetConfig.messageId,
        phoneNumberId: settings.phoneNumberId || '1294250930429862',
        numbers: cleanNumber,
        variablesValues,
        source: `ADMIN_TEST_${targetConfig.level}`,
        skipDbLog: false,
      });
    }

    res.status(200).json({
      success: true,
      message: `Test ${channel} alert (${targetConfig.name}) dispatched successfully to ${cleanNumber}`,
      data: {
        recipient: cleanNumber,
        channel,
        level: targetConfig.level,
        templateName: targetConfig.name,
        templateId: targetConfig.templateId,
        messageId: targetConfig.messageId,
        balance: formattedBalance,
        threshold: targetConfig.threshold,
        response: dispatchResponse,
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  checkBalanceNow,
  handleCronCheck,
  getLogs,
  sendTestAlert,
};
