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
    
    // Fetch live provider balance if available
    let liveBalance = null;
    try {
      const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
      const balanceRes = await provider.balance();
      if (balanceRes && balanceRes.success && typeof balanceRes.balance === 'number') {
        liveBalance = balanceRes.balance;
      }
    } catch (e) {
      console.warn('[Admin ProviderAutomation] Failed to fetch live balance:', e.message);
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: settings.enabled,
        providerName: settings.providerName,
        threshold: settings.threshold,
        recipients: settings.recipients,
        templateName: settings.templateName,
        messageId: settings.messageId,
        phoneNumberId: settings.phoneNumberId,
        lastCheckAt: settings.lastCheckAt,
        lastAlertAt: settings.lastAlertAt,
        lastBalance: liveBalance !== null ? liveBalance : settings.lastBalance,
        lastStatus: liveBalance !== null ? (liveBalance < settings.threshold ? 'LOW_BALANCE' : 'NORMAL') : settings.lastStatus,
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
    const { enabled, threshold, recipients, templateName, messageId } = req.body;
    let settings = await providerAutomationService.getSettings();

    if (typeof enabled === 'boolean') settings.enabled = enabled;
    if (typeof threshold === 'number' && threshold > 0) settings.threshold = threshold;
    if (Array.isArray(recipients)) {
      const cleanRecipients = recipients.map(r => String(r).replace(/\D/g, '')).filter(Boolean);
      if (cleanRecipients.length > 0) settings.recipients = cleanRecipients;
    }
    if (templateName) settings.templateName = templateName;
    if (messageId) settings.messageId = Number(messageId);

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

// @desc    Send Test WhatsApp Alert to specified test mobile number
// @route   POST /api/admin/provider-automations/test
// @access  Private (Admin)
const sendTestAlert = async (req, res, next) => {
  try {
    const { testNumber } = req.body;
    if (!testNumber) {
      return res.status(400).json({ success: false, message: 'Test mobile number is required' });
    }

    const cleanNumber = String(testNumber).replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      return res.status(400).json({ success: false, message: 'Invalid test mobile number' });
    }

    const settings = await providerAutomationService.getSettings();
    const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
    let currentBalance = 472.35;
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
    const variablesValues = `${formattedBalance}|${detectedAtIST}`;

    console.log(`[Admin Test Alert] Dispatching test WhatsApp alert to ${cleanNumber}...`);

    const waResponse = await fast2smsWhatsAppService.sendWhatsAppMessage({
      messageId: settings.messageId || 27147,
      phoneNumberId: settings.phoneNumberId || '1294250930429862',
      numbers: cleanNumber,
      variablesValues,
      source: 'ADMIN_TEST_AUTOMATION',
      skipDbLog: false,
    });

    res.status(200).json({
      success: true,
      message: `Test alert dispatched successfully to ${cleanNumber}`,
      data: {
        recipient: cleanNumber,
        variablesValues,
        response: waResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getLogs,
  sendTestAlert,
};
