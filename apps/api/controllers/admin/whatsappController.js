const WhatsAppTemplate = require('../../models/WhatsAppTemplate');
const WhatsAppCampaignHistory = require('../../models/WhatsAppCampaignHistory');
const Fast2SMSWalletLedger = require('../../models/Fast2SMSWalletLedger');
const User = require('../../models/User');
const fast2smsWhatsAppService = require('../../services/fast2smsWhatsApp.service');
const fast2smsWalletService = require('../../services/fast2sms.service');
const { logAudit } = require('../../utils/auditHelper');
const { processRecipientNumbers, normalizeIndianPhone } = require('../../utils/phoneNormalizer');

// @desc    Get WABA Account Connection & Quality Status
// @route   GET /api/admin/whatsapp/status
// @access  Private (Admin)
const getWabaStatus = async (req, res, next) => {
  try {
    const [wabaDetails, walletData] = await Promise.all([
      fast2smsWhatsAppService.getWabaDetails().catch(err => ({
        error: err.message,
        connection_status: 'DISCONNECTED',
      })),
      fast2smsWalletService.getWalletBalance().catch(err => ({
        walletBalance: 0,
        smsCount: 0,
      })),
    ]);

    res.status(200).json({
      success: true,
      data: {
        waba: wabaDetails,
        wallet: walletData,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Cached WhatsApp Templates (With auto-sync fallback)
// @route   GET /api/admin/whatsapp/templates
// @access  Private (Admin)
const getTemplates = async (req, res, next) => {
  try {
    const count = await WhatsAppTemplate.countDocuments({ isDeleted: false });
    if (count === 0) {
      await fast2smsWhatsAppService.syncTemplatesLocal().catch(err => {
        console.warn('[WhatsApp] Initial template sync warning:', err.message);
      });
    }

    const { search, category, language, status } = req.query;
    const query = { isDeleted: false };

    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }
    if (language && language !== 'ALL') {
      query.language = language;
    }
    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { templateName: { $regex: search, $options: 'i' } },
        { bodyText: { $regex: search, $options: 'i' } },
        { headerText: { $regex: search, $options: 'i' } },
      ];
    }

    const templates = await WhatsAppTemplate.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync WhatsApp Templates from Fast2SMS WABA Platform
// @route   POST /api/admin/whatsapp/templates/sync
// @access  Private (Admin)
const syncTemplates = async (req, res, next) => {
  try {
    const syncedTemplates = await fast2smsWhatsAppService.syncTemplatesLocal();

    await logAudit(req.admin, 'SYNC_WHATSAPP_TEMPLATES', 'WHATSAPP', null, { count: syncedTemplates.length }, req);

    res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedTemplates.length} WhatsApp templates from Fast2SMS.`,
      count: syncedTemplates.length,
      data: syncedTemplates,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build User query based on recipient mode
 */
function buildRecipientUserQuery(recipients, filters = {}) {
  const query = { isDeleted: { $ne: true } };

  switch (recipients) {
    case 'ALL':
      // Include EVERY registered retailer in A1 Recharge without status filtering
      break;

    case 'ACTIVE':
      query.status = { $in: ['active', 'ACTIVE'] };
      query.isBlocked = { $ne: true };
      break;

    case 'INACTIVE':
      query.status = { $in: ['inactive', 'INACTIVE', 'suspended', 'SUSPENDED'] };
      break;

    case 'PENDING_KYC':
      query.$or = [
        { kycStatus: { $in: ['pending', 'PENDING'] } },
        { isKycApproved: false },
      ];
      break;

    case 'BLOCKED':
      query.$or = [
        { status: { $in: ['blocked', 'BLOCKED'] } },
        { isBlocked: true },
      ];
      break;

    case 'MULTIPLE':
      if (filters.state) query.state = filters.state;
      if (filters.district) query.city = filters.district;
      if (filters.kycStatus) query.kycStatus = filters.kycStatus;
      break;

    default:
      break;
  }

  return query;
}

// @desc    Get Recipient Stats & Live Preview List
// @route   GET /api/admin/whatsapp/recipients-stats
// @access  Private (Admin)
const getRecipientStats = async (req, res, next) => {
  try {
    const { recipients = 'ALL', targetMobile, state, district, kycStatus } = req.query;

    if (recipients === 'SINGLE') {
      if (!targetMobile) {
        return res.status(200).json({
          success: true,
          data: { totalCount: 0, eligibleCount: 0, skippedNoPhone: 0, skippedInvalid: 0, eligibleNumbers: [], previewList: [] },
        });
      }

      const normalized = normalizeIndianPhone(targetMobile);
      return res.status(200).json({
        success: true,
        data: {
          totalCount: 1,
          eligibleCount: normalized ? 1 : 0,
          skippedNoPhone: 0,
          skippedInvalid: normalized ? 0 : 1,
          eligibleNumbers: normalized ? [normalized] : [],
          previewList: [{
            retailerId: 'CUSTOM',
            name: 'Single Retailer',
            phone: targetMobile,
            normalizedPhone: normalized,
            isEligible: !!normalized,
            reason: normalized ? 'Eligible' : 'Invalid format',
          }],
        },
      });
    }

    const userQuery = buildRecipientUserQuery(recipients, { state, district, kycStatus });
    const users = await User.find(userQuery).select('retailerId name phone mobile contactNumber status').lean();

    const stats = processRecipientNumbers(users);

    console.log(`[WhatsAppRecipientsStats] Mode: ${recipients} -> Fetched ${stats.totalCount} retailers, ${stats.eligibleCount} eligible WhatsApp numbers`);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send WhatsApp Campaign
// @route   POST /api/admin/whatsapp/send
// @access  Private (Admin)
const sendCampaign = async (req, res, next) => {
  try {
    const {
      recipients = 'ALL',
      targetMobile,
      messageId,
      templateId,
      variablesValues,
      mediaUrl,
      documentFilename,
      filters,
    } = req.body;

    if (!messageId && !templateId) {
      res.status(400);
      throw new Error('messageId or templateId is required.');
    }

    const template = await WhatsAppTemplate.findOne({
      $or: [
        { messageId: Number(messageId) || 0 },
        { templateId: String(templateId || '') },
      ],
      isDeleted: false,
    });

    if (!template) {
      res.status(400);
      throw new Error('Selected WhatsApp template does not exist or has been deleted.');
    }

    let targetNumbers = [];
    let statsSummary = { totalCount: 0, eligibleCount: 0, skippedNoPhone: 0, skippedInvalid: 0 };

    if (recipients === 'SINGLE') {
      if (!targetMobile) {
        res.status(400);
        throw new Error('Target mobile number is required for single recipient.');
      }
      const normalized = normalizeIndianPhone(targetMobile);
      if (!normalized) {
        res.status(400);
        throw new Error(`Invalid mobile number format: ${targetMobile}. Must be a valid 10-digit Indian mobile number.`);
      }
      targetNumbers = [normalized];
      statsSummary = { totalCount: 1, eligibleCount: 1, skippedNoPhone: 0, skippedInvalid: 0 };
    } else {
      const userQuery = buildRecipientUserQuery(recipients, filters || {});
      const users = await User.find(userQuery).select('retailerId name phone mobile contactNumber').lean();
      
      const stats = processRecipientNumbers(users);
      targetNumbers = stats.eligibleNumbers;
      statsSummary = stats;

      console.log(`\n================ WHATSAPP RECIPIENT AUDIT LOG ================`);
      console.log(`[Recipient Mode] ${recipients}`);
      console.log(`[Total Retailers Fetched] ${stats.totalCount}`);
      console.log(`[Eligible WhatsApp Numbers] ${stats.eligibleCount}`);
      console.log(`[Skipped Records] ${stats.skippedNoPhone} (missing phone), ${stats.skippedInvalid} (invalid format)`);
      console.log(`[First 5 Numbers] ${targetNumbers.slice(0, 5).join(', ')}`);
      console.log(`=============================================================\n`);
    }

    if (targetNumbers.length === 0) {
      res.status(400);
      throw new Error(
        `No eligible WhatsApp recipients found. (${statsSummary.totalCount} active retailers found: ${statsSummary.skippedNoPhone} missing phone, ${statsSummary.skippedInvalid} invalid format).`
      );
    }

    // Format variablesValues as pipe separated string if passed as array
    const formattedVars = Array.isArray(variablesValues)
      ? variablesValues.join('|')
      : String(variablesValues || '');

    const phoneNumberId = template.phoneNumberId || '1294250930429862';

    let fast2smsRes;
    let status = 'DELIVERED';
    let errorDetails = null;

    try {
      fast2smsRes = await fast2smsWhatsAppService.sendWhatsAppMessage({
        messageId: template.messageId,
        phoneNumberId,
        numbers: targetNumbers,
        variablesValues: formattedVars,
        mediaUrl: mediaUrl || null,
        documentFilename: documentFilename || null,
        source: 'PORTAL',
        sentBy: req.admin?._id || null,
        skipDbLog: true,
      });
    } catch (err) {
      status = 'FAILED';
      errorDetails = err.message;
    }

    // Create Campaign History Log
    const history = await WhatsAppCampaignHistory.create({
      messageId: template.messageId,
      templateId: template.templateId,
      templateName: template.templateName,
      phoneNumberId,
      recipients: targetNumbers,
      recipientCount: targetNumbers.length,
      variablesValues: formattedVars,
      mediaUrl: mediaUrl || null,
      documentFilename: documentFilename || null,
      status,
      requestId: fast2smsRes?.request_id || fast2smsRes?.data?.request_id || null,
      fast2smsResponse: fast2smsRes || null,
      sentBy: req.admin?._id || null,
      source: 'PORTAL',
      sentCount: status === 'DELIVERED' ? targetNumbers.length : 0,
      failedCount: status === 'FAILED' ? targetNumbers.length : 0,
      errorDetails,
    });

    // Automatic Fast2SMS Wallet Ledger Recording
    try {
      const walletRes = await fast2smsWalletService.getWalletBalance().catch(() => ({ walletBalance: 500 }));
      const balanceBefore = typeof walletRes.walletBalance === 'number' ? walletRes.walletBalance : 500;
      
      const category = (template.category || 'MARKETING').toUpperCase();
      const ratePerMessage = category === 'MARKETING' ? 0.95 : 0.25;
      const totalDebit = parseFloat((targetNumbers.length * ratePerMessage).toFixed(2));
      const balanceAfter = status === 'FAILED' ? balanceBefore : parseFloat((balanceBefore - totalDebit).toFixed(2));

      await Fast2SMSWalletLedger.create({
        type: category === 'MARKETING' ? 'MARKETING_MSG' : category === 'UTILITY' ? 'UTILITY_MSG' : 'AUTH_MSG',
        category,
        templateName: template.templateName || 'WhatsApp Template',
        recipientCount: targetNumbers.length,
        ratePerMessage,
        totalDebit: status === 'FAILED' ? 0 : totalDebit,
        balanceBefore,
        balanceAfter,
        requestId: fast2smsRes?.request_id || fast2smsRes?.data?.request_id || `REQ_${Date.now()}`,
        recipientList: targetNumbers,
        status: status === 'DELIVERED' ? 'SUCCESS' : (status === 'FAILED' ? 'FAILED' : 'PENDING'),
        createdBy: req.admin?._id || null,
        createdByName: req.admin?.name || 'System Admin',
      });
    } catch (ledgerErr) {
      console.warn('[Fast2SMSWalletLedger] Failed to record wallet ledger entry:', ledgerErr.message);
    }

    await logAudit(
      req.admin,
      'SEND_WHATSAPP_CAMPAIGN',
      'WHATSAPP',
      null,
      { templateName: template.templateName, recipientCount: targetNumbers.length, status },
      req
    );

    if (status === 'FAILED') {
      res.status(400);
      throw new Error(`Failed to send WhatsApp message: ${errorDetails}`);
    }

    res.status(200).json({
      success: true,
      message: `WhatsApp campaign processed for ${targetNumbers.length} recipients.`,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get WhatsApp Campaign History (Unified across Portal, API, Campaign, Automation)
// @route   GET /api/admin/whatsapp/history
// @access  Private (Admin)
const getCampaignHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;

    const { search, status, source, period, from, to } = req.query;

    const query = {};

    // 1. Status Filter
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    // 2. Source Filter (handles aliases PORTAL/MANUAL & AUTOMATION/AUTOMATIC)
    if (source && source !== 'ALL') {
      const srcUpper = source.toUpperCase();
      if (srcUpper === 'PORTAL') {
        query.source = { $in: ['PORTAL', 'MANUAL'] };
      } else if (srcUpper === 'AUTOMATION') {
        query.source = { $in: ['AUTOMATION', 'AUTOMATIC'] };
      } else {
        query.source = srcUpper;
      }
    }

    // 3. Date Range Filter
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    } else if (period && period !== 'ALL') {
      const now = new Date();
      if (period === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: today };
      } else if (period === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endYesterday = new Date(yesterday);
        endYesterday.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: yesterday, $lte: endYesterday };
      } else if (period === '7d') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 7);
        d7.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: d7 };
      } else if (period === '30d') {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 30);
        d30.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: d30 };
      }
    }

    // 4. Search Filter (Template name, Request ID, Variables, Recipient Phone)
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { templateName: regex },
        { requestId: regex },
        { variablesValues: regex },
        { recipients: regex },
      ];
    }

    const total = await WhatsAppCampaignHistory.countDocuments(query);

    const history = await WhatsAppCampaignHistory.find(query)
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    const pages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      count: history.length,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasMore: page < pages,
      },
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get WhatsApp Analytics
// @route   GET /api/admin/whatsapp/analytics
// @access  Private (Admin)
const getAnalytics = async (req, res, next) => {
  try {
    const [totalCampaigns, totalDelivered, totalFailed, topTemplates] = await Promise.all([
      WhatsAppCampaignHistory.countDocuments({}),
      WhatsAppCampaignHistory.aggregate([{ $match: { status: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$sentCount' } } }]),
      WhatsAppCampaignHistory.aggregate([{ $match: { status: 'FAILED' } }, { $group: { _id: null, total: { $sum: '$failedCount' } } }]),
      WhatsAppCampaignHistory.aggregate([
        { $group: { _id: '$templateName', count: { $sum: 1 }, totalSent: { $sum: '$sentCount' } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
    ]);

    const deliveredCount = totalDelivered[0]?.total || 0;
    const failedCount = totalFailed[0]?.total || 0;
    const totalSent = deliveredCount + failedCount;
    const successRate = totalSent > 0 ? ((deliveredCount / totalSent) * 100).toFixed(1) : '100.0';

    res.status(200).json({
      success: true,
      data: {
        totalCampaigns,
        totalSent,
        deliveredCount,
        failedCount,
        successRate: parseFloat(successRate),
        topTemplates,
      },
    });
  } catch (error) {
    next(error);
  }
};

const fast2smsTemplateService = require('../../services/fast2smsTemplate.service');

// @desc    Create WhatsApp Template
// @route   POST /api/admin/whatsapp/templates
// @access  Private (Super Admin / Admin)
const createTemplate = async (req, res, next) => {
  try {
    const template = await fast2smsTemplateService.createTemplate(req.body);
    await logAudit(req.admin, 'CREATE_WHATSAPP_TEMPLATE', 'WHATSAPP', template._id, { templateName: template.templateName }, req);
    res.status(201).json({
      success: true,
      message: `WhatsApp template "${template.templateName}" created successfully.`,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update WhatsApp Template
// @route   PUT /api/admin/whatsapp/templates/:id
// @access  Private (Super Admin / Admin)
const updateTemplate = async (req, res, next) => {
  try {
    const template = await fast2smsTemplateService.updateTemplate(req.params.id, req.body);
    await logAudit(req.admin, 'UPDATE_WHATSAPP_TEMPLATE', 'WHATSAPP', template._id, { templateName: template.templateName }, req);
    res.status(200).json({
      success: true,
      message: `WhatsApp template "${template.templateName}" updated successfully.`,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete WhatsApp Template
// @route   DELETE /api/admin/whatsapp/templates/:id
// @access  Private (Super Admin)
const deleteTemplate = async (req, res, next) => {
  try {
    const result = await fast2smsTemplateService.deleteTemplate(req.params.id);
    await logAudit(req.admin, 'DELETE_WHATSAPP_TEMPLATE', 'WHATSAPP', req.params.id, {}, req);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate WhatsApp Template
// @route   POST /api/admin/whatsapp/templates/:id/duplicate
// @access  Private (Super Admin / Admin)
const duplicateTemplate = async (req, res, next) => {
  try {
    const duplicate = await fast2smsTemplateService.duplicateTemplate(req.params.id);
    await logAudit(req.admin, 'DUPLICATE_WHATSAPP_TEMPLATE', 'WHATSAPP', duplicate._id, { templateName: duplicate.templateName }, req);
    res.status(201).json({
      success: true,
      message: `Template duplicated successfully as "${duplicate.templateName}".`,
      data: duplicate,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get WhatsApp Delivery Report for a specific Request ID
// @route   GET /api/admin/whatsapp/delivery-report/:requestId
// @access  Private (Admin)
const getDeliveryReport = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      res.status(400);
      throw new Error('Request ID is required');
    }

    const [report, localLog] = await Promise.all([
      fast2smsWhatsAppService.getDeliveryReport(requestId).catch(err => ({ error: err.message })),
      WhatsAppCampaignHistory.findOne({ requestId }).populate('sentBy', 'name').lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        requestId,
        report,
        localLog,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get WhatsApp Logs with Date Filtering (enriched with category & cost info)
// @route   GET /api/admin/whatsapp/logs
// @access  Private (Admin)
const getLogs = async (req, res, next) => {
  try {
    const { from, to, search, status, category, limit = 100 } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { templateName: searchRegex },
        { requestId: searchRegex },
        { variablesValues: searchRegex },
      ];
    }

    const logs = await WhatsAppCampaignHistory.find(filter)
      .populate('sentBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    // Build a lookup map from templateName → category using WhatsAppTemplate
    const templateNames = [...new Set(logs.map(l => l.templateName).filter(Boolean))];
    const templates = await WhatsAppTemplate.find({ templateName: { $in: templateNames } })
      .select('templateName category')
      .lean();
    const templateCategoryMap = {};
    templates.forEach(t => {
      templateCategoryMap[t.templateName] = (t.category || 'MARKETING').toUpperCase();
    });

    // Rate per message by category (INR)
    const rateByCategory = {
      MARKETING: 0.95,
      UTILITY: 0.25,
      AUTHENTICATION: 0.25,
    };

    // Enrich each log with category, rate, totalCost
    const enrichedLogs = logs.map(log => {
      const cat = templateCategoryMap[log.templateName] || 'MARKETING';
      const rate = rateByCategory[cat] || 0.95;
      const count = log.recipientCount || (log.recipients && log.recipients.length) || 0;
      const totalCost = parseFloat((count * rate).toFixed(2));
      return {
        ...log,
        category: cat,
        ratePerMessage: rate,
        totalCost,
        // Strip raw recipients from list response to keep payload lean — accessible via detail drawer
        recipients: log.recipients || [],
      };
    });

    // If category filter is active, filter after enrichment
    const finalLogs = category && category !== 'ALL'
      ? enrichedLogs.filter(l => l.category === category.toUpperCase())
      : enrichedLogs;

    res.status(200).json({
      success: true,
      count: finalLogs.length,
      data: finalLogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Fast2SMS Logs Page Summary (Today's messages, spend, category breakdown)
// @route   GET /api/admin/whatsapp/logs-summary
// @access  Private (Admin)
const getLogsSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysLogs = await WhatsAppCampaignHistory.find({
      createdAt: { $gte: today },
      status: { $ne: 'FAILED' },
    }).select('recipientCount templateName').lean();

    const templateNames = [...new Set(todaysLogs.map(l => l.templateName).filter(Boolean))];
    const templates = await WhatsAppTemplate.find({ templateName: { $in: templateNames } })
      .select('templateName category')
      .lean();
    const catMap = {};
    templates.forEach(t => { catMap[t.templateName] = (t.category || 'MARKETING').toUpperCase(); });

    const rateByCategory = { MARKETING: 0.95, UTILITY: 0.25, AUTHENTICATION: 0.25 };

    let todaysMessages = 0;
    let todaysSpend = 0;
    let marketingSpend = 0;
    let utilitySpend = 0;
    let authSpend = 0;

    todaysLogs.forEach(log => {
      const cat = catMap[log.templateName] || 'MARKETING';
      const rate = rateByCategory[cat] || 0.95;
      const count = log.recipientCount || 0;
      const cost = count * rate;
      todaysMessages += count;
      todaysSpend += cost;
      if (cat === 'MARKETING') marketingSpend += cost;
      else if (cat === 'UTILITY') utilitySpend += cost;
      else if (cat === 'AUTHENTICATION') authSpend += cost;
    });

    res.status(200).json({
      success: true,
      data: {
        todaysMessages,
        todaysSpend: parseFloat(todaysSpend.toFixed(2)),
        marketingSpend: parseFloat(marketingSpend.toFixed(2)),
        utilitySpend: parseFloat(utilitySpend.toFixed(2)),
        authSpend: parseFloat(authSpend.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get WhatsApp Delivery Analytics Summary
// @route   GET /api/admin/whatsapp/summary
// @access  Private (Admin)
const getSummary = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

    const [statusStats, topTemplates] = await Promise.all([
      WhatsAppCampaignHistory.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            totalSent: { $sum: '$recipientCount fontCount' },
            count: { $sum: 1 },
          },
        },
      ]),
      WhatsAppCampaignHistory.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$templateName', count: { $sum: 1 }, totalSent: { $sum: '$recipientCount' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    let sent = 0, delivered = 0, read = 0, failed = 0, pending = 0, accepted = 0;

    statusStats.forEach(item => {
      const cnt = item.count;
      if (item._id === 'DELIVERED') delivered += cnt;
      else if (item._id === 'READ') read += cnt;
      else if (item._id === 'FAILED') failed += cnt;
      else if (item._id === 'ACCEPTED') accepted += cnt;
      else pending += cnt;

      sent += cnt;
    });

    const deliveryRate = sent > 0 ? (((delivered + read) / sent) * 100).toFixed(1) : '100.0';
    const readRate = sent > 0 ? ((read / sent) * 100).toFixed(1) : '0.0';
    const failureRate = sent > 0 ? ((failed / sent) * 100).toFixed(1) : '0.0';

    res.status(200).json({
      success: true,
      data: {
        sent,
        accepted,
        delivered,
        read,
        failed,
        pending,
        deliveryRate: parseFloat(deliveryRate),
        readRate: parseFloat(readRate),
        failureRate: parseFloat(failureRate),
        topTemplates,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Fast2SMS Wallet Transactions Ledger & Stats
// @route   GET /api/admin/whatsapp/wallet-transactions
// @access  Private (Admin)
const getFast2SMSWalletTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const startIndex = (page - 1) * limit;

    const { period, category, status, search } = req.query;

    const query = {};

    if (category && category !== 'ALL') {
      if (['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(category.toUpperCase())) {
        query.category = category.toUpperCase();
      } else {
        query.type = category.toUpperCase();
      }
    }

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (period && period !== 'ALL') {
      const now = new Date();
      if (period === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: today };
      } else if (period === '7d') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 7);
        query.createdAt = { $gte: d7 };
      } else if (period === '30d') {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 30);
        query.createdAt = { $gte: d30 };
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { templateName: regex },
        { requestId: regex },
        { campaignName: regex },
        { createdByName: regex }
      ];
    }

    const total = await Fast2SMSWalletLedger.countDocuments(query);
    const transactions = await Fast2SMSWalletLedger.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (typeof next === 'function') next(error);
    else res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Fast2SMS Wallet Ledger Summary Stats
// @route   GET /api/admin/whatsapp/wallet-transactions/stats
// @access  Private (Admin)
const getFast2SMSWalletStats = async (req, res, next) => {
  try {
    const walletBalanceRes = await fast2smsWalletService.getWalletBalance().catch(() => ({ walletBalance: 500 }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todaySpend, monthSpend, categorySpends, credits] = await Promise.all([
      Fast2SMSWalletLedger.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$totalDebit' } } }
      ]),
      Fast2SMSWalletLedger.aggregate([
        { $match: { createdAt: { $gte: firstDayOfMonth }, status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$totalDebit' } } }
      ]),
      Fast2SMSWalletLedger.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: '$category', total: { $sum: '$totalDebit' } } }
      ]),
      Fast2SMSWalletLedger.aggregate([
        { $match: { type: 'CREDIT', status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$totalDebit' } } }
      ])
    ]);

    let marketingSpend = 0;
    let utilitySpend = 0;
    let authSpend = 0;

    categorySpends.forEach(item => {
      if (item._id === 'MARKETING') marketingSpend = item.total;
      else if (item._id === 'UTILITY') utilitySpend = item.total;
      else if (item._id === 'AUTHENTICATION') authSpend = item.total;
    });

    res.status(200).json({
      success: true,
      data: {
        currentWalletBalance: walletBalanceRes.walletBalance !== undefined ? walletBalanceRes.walletBalance : 500,
        todaysSpend: todaySpend[0]?.total || 0,
        thisMonthsSpend: monthSpend[0]?.total || 0,
        marketingSpend,
        utilitySpend,
        authSpend,
        walletCredits: credits[0]?.total || 0,
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWabaStatus,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  syncTemplates,
  sendCampaign,
  getCampaignHistory,
  getAnalytics,
  getDeliveryReport,
  getLogs,
  getSummary,
  getRecipientStats,
  getFast2SMSWalletTransactions,
  getFast2SMSWalletStats,
  getLogsSummary,
};
