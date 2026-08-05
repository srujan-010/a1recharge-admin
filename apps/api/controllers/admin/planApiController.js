const PlanApiSyncLog = require('../../models/PlanApiSyncLog');
const PlanApiSettings = require('../../models/PlanApiSettings');
const PlanApiService = require('../../services/planapi.service');
const AuditLog = require('../../models/AuditLog');

// @desc    Get PlanAPI Dashboard Stats, Latest Status, and Charts
// @route   GET /api/admin/planapi/dashboard
// @access  Private (Admin / Finance / Support)
const getDashboardData = async (req, res, next) => {
  try {
    const period = req.query.period || 'today'; // 'today', '7d', '30d'

    // Get settings
    const settings = await PlanApiService.getSettings();

    // Get latest sync log
    const latestLog = await PlanApiSyncLog.findOne().sort({ syncedAt: -1 });

    // Period date calculation
    const now = new Date();
    let startDate = new Date();
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
    }

    // Today stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySyncs = await PlanApiSyncLog.find({ syncedAt: { $gte: todayStart } });
    const todaySyncsCount = todaySyncs.length;
    const successfulSyncsCount = todaySyncs.filter(s => s.status === 'SUCCESS').length;
    const failedSyncsCount = todaySyncs.filter(s => s.status !== 'SUCCESS').length;
    const totalRespTime = todaySyncs.reduce((acc, s) => acc + (s.responseTime || 0), 0);
    const avgResponseTime = todaySyncsCount > 0 ? Math.round(totalRespTime / todaySyncsCount) : (latestLog?.responseTime || 0);

    // History logs for charts
    const historyLogs = await PlanApiSyncLog.find({ syncedAt: { $gte: startDate } })
      .sort({ syncedAt: 1 })
      .select('balance remainingHits responseTime status syncedAt triggeredBy')
      .limit(500);

    // Last success / failure timestamps
    const lastSuccessLog = await PlanApiSyncLog.findOne({ status: 'SUCCESS' }).sort({ syncedAt: -1 });
    const lastFailureLog = await PlanApiSyncLog.findOne({ status: { $ne: 'SUCCESS' } }).sort({ syncedAt: -1 });

    const activeBalance = (latestLog && latestLog.status === 'SUCCESS') 
      ? latestLog.balance 
      : (lastSuccessLog ? lastSuccessLog.balance : (latestLog?.balance || 0));

    const activeRemainingHits = (latestLog && latestLog.status === 'SUCCESS') 
      ? latestLog.remainingHits 
      : (lastSuccessLog ? lastSuccessLog.remainingHits : (latestLog?.remainingHits || 0));

    const latestObj = latestLog ? {
      ...latestLog.toObject(),
      balance: activeBalance,
      remainingHits: activeRemainingHits,
    } : {
      balance: lastSuccessLog ? lastSuccessLog.balance : 0,
      remainingHits: lastSuccessLog ? lastSuccessLog.remainingHits : 0,
      responseTime: 0,
      status: 'OFFLINE',
      syncedAt: null,
      ipWhitelisted: true,
      credentialsValid: true,
    };

    res.status(200).json({
      success: true,
      data: {
        latest: latestObj,
        settings: {
          lowBalanceWarning: settings.lowBalanceWarning,
          criticalBalance: settings.criticalBalance,
          lowRemainingHits: settings.lowRemainingHits,
          criticalRemainingHits: settings.criticalRemainingHits,
          autoRefreshInterval: settings.autoRefreshInterval,
        },
        stats: {
          todaySyncsCount,
          successfulSyncsCount,
          failedSyncsCount,
          avgResponseTime,
          lastSuccessAt: lastSuccessLog ? lastSuccessLog.syncedAt : null,
          lastFailureAt: lastFailureLog ? lastFailureLog.syncedAt : null,
          lastFailureMessage: lastFailureLog ? lastFailureLog.errorMessage : null,
        },
        history: historyLogs,
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually Trigger PlanAPI Refresh
// @route   POST /api/admin/planapi/refresh
// @access  Private (Admin / Finance / Support)
const triggerRefresh = async (req, res, next) => {
  try {
    const adminId = req.user ? req.user._id : null;
    const resultLog = await PlanApiService.syncData('MANUAL', adminId);

    res.status(200).json({
      success: true,
      message: resultLog.status === 'SUCCESS' ? 'PlanAPI refreshed successfully' : `PlanAPI refresh failed: ${resultLog.errorMessage}`,
      data: resultLog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Paginated & Searchable Sync Logs
// @route   GET /api/admin/planapi/logs
// @access  Private (Admin / Finance / Support)
const getSyncLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const triggeredBy = req.query.triggeredBy;
    const search = req.query.search; // Can search by status, balance, etc.

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (triggeredBy && triggeredBy !== 'ALL') {
      query.triggeredBy = triggeredBy;
    }

    if (search) {
      const numSearch = Number(search);
      if (!isNaN(numSearch)) {
        query.$or = [
          { balance: numSearch },
          { remainingHits: numSearch },
        ];
      } else {
        query.errorMessage = { $regex: search, $options: 'i' };
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await PlanApiSyncLog.countDocuments(query);

    const logs = await PlanApiSyncLog.find(query)
      .sort({ syncedAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Sync Logs to CSV
// @route   GET /api/admin/planapi/export
// @access  Private (Admin / Finance)
const exportSyncLogs = async (req, res, next) => {
  try {
    const logs = await PlanApiSyncLog.find()
      .sort({ syncedAt: -1 })
      .limit(5000);

    const exportData = logs.map(log => ({
      syncedAt: log.syncedAt,
      balance: log.balance,
      remainingHits: log.remainingHits,
      responseTimeMs: log.responseTime,
      status: log.status,
      triggeredBy: log.triggeredBy,
      errorMessage: log.errorMessage || '',
    }));

    res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get PlanAPI Settings
// @route   GET /api/admin/planapi/settings
// @access  Private (Super Admin / Admin)
const getSettings = async (req, res, next) => {
  try {
    const settings = await PlanApiService.getSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update PlanAPI Settings
// @route   PUT /api/admin/planapi/settings
// @access  Private (Super Admin / Admin)
const updateSettings = async (req, res, next) => {
  try {
    const {
      lowBalanceWarning,
      criticalBalance,
      lowRemainingHits,
      criticalRemainingHits,
      enableWhatsAppAlerts,
      enablePushAlerts,
      enableInternalNotifications,
      autoRefreshInterval,
      alertRecipients,
    } = req.body;

    const settings = await PlanApiService.getSettings();
    const oldValue = settings.toObject();

    if (lowBalanceWarning !== undefined) settings.lowBalanceWarning = Number(lowBalanceWarning);
    if (criticalBalance !== undefined) settings.criticalBalance = Number(criticalBalance);
    if (lowRemainingHits !== undefined) settings.lowRemainingHits = Number(lowRemainingHits);
    if (criticalRemainingHits !== undefined) settings.criticalRemainingHits = Number(criticalRemainingHits);
    if (enableWhatsAppAlerts !== undefined) settings.enableWhatsAppAlerts = Boolean(enableWhatsAppAlerts);
    if (enablePushAlerts !== undefined) settings.enablePushAlerts = Boolean(enablePushAlerts);
    if (enableInternalNotifications !== undefined) settings.enableInternalNotifications = Boolean(enableInternalNotifications);
    if (autoRefreshInterval !== undefined) settings.autoRefreshInterval = Number(autoRefreshInterval);
    if (Array.isArray(alertRecipients)) settings.alertRecipients = alertRecipients;

    await settings.save();

    // Audit Log
    if (req.user) {
      await AuditLog.create({
        adminId: req.user._id,
        action: 'PLANAPI_SETTINGS_UPDATED',
        resource: 'PLANAPI_SETTINGS',
        resourceId: settings._id,
        oldValue,
        newValue: settings.toObject(),
        description: 'Updated PlanAPI threshold and alert settings',
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'PlanAPI settings updated successfully',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardData,
  triggerRefresh,
  getSyncLogs,
  exportSyncLogs,
  getSettings,
  updateSettings,
};
