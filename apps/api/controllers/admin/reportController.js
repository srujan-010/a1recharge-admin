const FinancialSummaryService = require('../../services/financialSummary.service');

// @desc    Get Master Financial & Business Executive Dashboard Report
// @route   GET /api/admin/reports/dashboard
// @access  Private (Admin / Finance)
const getExecutiveDashboardReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period, accountType, showTest } = req.query;

    const data = await FinancialSummaryService.getExecutiveDashboardData({
      startDate,
      endDate,
      period,
      accountType,
      showTest: showTest === 'true',
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate Daily Financial Performance Report
// @route   GET /api/admin/reports/daily
// @access  Private (Admin / Finance)
const getDailyReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period, accountType, showTest } = req.query;

    const data = await FinancialSummaryService.getDailyPerformance({
      startDate,
      endDate,
      period,
      accountType,
      showTest: showTest === 'true',
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate Operator Performance Report
// @route   GET /api/admin/reports/operators
// @access  Private (Admin / Finance)
const getOperatorReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period, accountType, showTest } = req.query;

    const data = await FinancialSummaryService.getOperatorPerformance({
      startDate,
      endDate,
      period,
      accountType,
      showTest: showTest === 'true',
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate Commission Summary Report
// @route   GET /api/admin/reports/commissions
// @access  Private (Admin / Finance)
const getCommissionReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period, accountType, showTest } = req.query;

    const summary = await FinancialSummaryService.getFinancialSummary({
      startDate,
      endDate,
      period,
      accountType,
      showTest: showTest === 'true',
    });

    const accountTypeBreakdown = await FinancialSummaryService.getAccountTypePerformance({
      startDate,
      endDate,
      period,
      showTest: showTest === 'true',
    });

    res.status(200).json({
      success: true,
      summary,
      accountTypeBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate Ledger Report (Consuming FinancialSummaryService)
// @route   GET /api/admin/reports/ledger
// @access  Private (Admin / Finance)
const generateLedgerReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;

    const report = await FinancialSummaryService.getLedgerReport({
      startDate,
      endDate,
      period,
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExecutiveDashboardReport,
  getDailyReport,
  getOperatorReport,
  getCommissionReport,
  generateLedgerReport,
};
