const providerAutomationService = require('../../services/providerAutomation.service');
const ProviderAutomationSettings = require('../../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../../models/ProviderAutomationLog');
const ProviderFactory = require('../../services/providers/provider.factory');
const fast2smsWhatsAppService = require('../../services/fast2smsWhatsApp.service');

// @desc    Get Provider Automation Settings & Status
// @route   GET /api/admin/provider-automations/settings
// @access  Private (Admin)
const getSettings = async (req, res, next) => {
  try {
    const settings = await providerAutomationService.getSettings();

    // Calculate nextCheckAt if not present
    let nextCheckAt = settings.nextCheckAt;
    if (!nextCheckAt && settings.lastCheckAt) {
      nextCheckAt = new Date(new Date(settings.lastCheckAt).getTime() + (settings.checkIntervalMinutes || 5) * 60 * 1000);
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: settings.enabled,
        providerName: settings.providerName,
        threshold: settings.threshold,
        recipients: settings.recipients,
        channel: settings.channel || 'WHATSAPP',
        templateName: settings.templateName,
        messageId: settings.messageId,
        phoneNumberId: settings.phoneNumberId,
        checkIntervalMinutes: settings.checkIntervalMinutes || 5,
        monitoringStatus: settings.monitoringStatus || 'ACTIVE',
        alertSent: settings.alertSent || false,
        lastCheckAt: settings.lastCheckAt,
        lastSuccessfulCheckAt: settings.lastSuccessfulCheckAt || settings.lastCheckAt,
        nextCheckAt,
        lastAlertAt: settings.lastAlertAt,
        lastAlertBalance: settings.lastAlertBalance,
        lastBalance: settings.lastBalance,
        lastStatus: settings.lastStatus || 'UNKNOWN',
        lastCheckError: settings.lastCheckError || null,
        lastMessagingError: settings.lastMessagingError || null,
        lastRecipientsStatus: settings.lastRecipientsStatus || [],
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
    const { enabled, threshold, recipients, templateName, messageId, channel, checkIntervalMinutes } = req.body;
    let settings = await providerAutomationService.getSettings();

    if (typeof enabled === 'boolean') {
      settings.enabled = enabled;
      settings.monitoringStatus = enabled ? 'ACTIVE' : 'DISABLED';
    }
    if (typeof threshold === 'number' && threshold > 0) settings.threshold = threshold;
    if (Array.isArray(recipients)) {
      const cleanRecipients = recipients.map(r => String(r).replace(/\D/g, '')).filter(r => r.length >= 10);
      if (cleanRecipients.length > 0) settings.recipients = cleanRecipients;
    }
    if (templateName) settings.templateName = templateName;
    if (messageId) settings.messageId = Number(messageId);
    if (channel && ['WHATSAPP', 'SMS'].includes(channel.toUpperCase())) {
      settings.channel = channel.toUpperCase();
    }
    if (typeof checkIntervalMinutes === 'number' && checkIntervalMinutes > 0) {
      settings.checkIntervalMinutes = checkIntervalMinutes;
    }

    settings.updatedBy = req.user?._id;
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Provider wallet automation settings updated successfully',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual "Check Balance Now" action for administrators
// @route   POST /api/admin/provider-automations/check-balance-now
// @access  Private (Admin)
const checkBalanceNow = async (req, res, next) => {
  try {
    console.log('[Admin ProviderAutomation] Manual "Check Balance Now" triggered by admin:', req.user?.phone || req.user?.email || 'admin');

    const result = await providerAutomationService.checkBalanceAndAlert({
      triggerType: 'MANUAL_CHECK',
      force: req.body.force === true,
    });

    res.status(200).json({
      success: true,
      message: 'Provider balance check completed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    External Scheduler / Cron Endpoint (Protected by secret token)
// @route   POST or GET /api/admin/provider-automations/cron/check-balance
// @access  Protected by A1TOPUP_MONITOR_SECRET / CRON_SECRET
const handleCronCheck = async (req, res, next) => {
  try {
    const configuredSecret = process.env.A1TOPUP_MONITOR_SECRET || process.env.CRON_SECRET;
    
    // Authorization validation: Check Header 'X-Cron-Secret', Bearer token, or query param
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

    console.log('[Cron Scheduler] Authenticated external balance check triggered.');

    const result = await providerAutomationService.checkBalanceAndAlert({
      triggerType: 'EXTERNAL_CRON',
    });

    res.status(200).json({
      success: true,
      message: 'Scheduled balance check executed',
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
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Test Alert to specified test mobile number (WhatsApp or SMS)
// @route   POST /api/admin/provider-automations/test
// @access  Private (Admin)
const sendTestAlert = async (req, res, next) => {
  try {
    const { testNumber, channel: requestedChannel } = req.body;
    if (!testNumber) {
      return res.status(400).json({ success: false, message: 'Test mobile number is required' });
    }

    const cleanNumber = String(testNumber).replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      return res.status(400).json({ success: false, message: 'Invalid test mobile number' });
    }

    const settings = await providerAutomationService.getSettings();
    const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
    let currentBalance = 1850.00; // Simulated test balance below ₹2000
    try {
      const balanceRes = await provider.balance();
      if (balanceRes && balanceRes.success && typeof balanceRes.balance === 'number') {
        currentBalance = balanceRes.balance;
      }
    } catch (e) {
      console.warn('[Admin Test Alert] Could not fetch real balance, using preview fallback');
    }

    const detectedAtIST = providerAutomationService.formatISTDate(new Date());
    const formattedBalance = currentBalance.toFixed(2);
    const threshold = (settings.threshold || 2000).toFixed(2);
    const channel = requestedChannel ? requestedChannel.toUpperCase() : (settings.channel || 'WHATSAPP');

    console.log(`[Admin Test Alert] Dispatching test ${channel} alert to ${cleanNumber}...`);

    let dispatchResponse;
    if (channel === 'SMS') {
      const fast2smsService = require('../../services/fast2sms.service');
      const smsMessage = `A1 Recharge Alert: Your A1Topup wallet balance is ₹${formattedBalance}, below the ₹${threshold} threshold. Detected at ${detectedAtIST}. Please replenish the provider wallet to avoid recharge failures.`;
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
        messageId: settings.messageId || 27147,
        phoneNumberId: settings.phoneNumberId || '1294250930429862',
        numbers: cleanNumber,
        variablesValues,
        source: 'ADMIN_TEST_AUTOMATION',
        skipDbLog: false,
      });
    }

    res.status(200).json({
      success: true,
      message: `Test ${channel} alert dispatched successfully to ${cleanNumber}`,
      data: {
        recipient: cleanNumber,
        channel,
        balance: formattedBalance,
        threshold,
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
