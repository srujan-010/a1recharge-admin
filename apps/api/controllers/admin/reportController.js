const Transaction = require('../../models/Transaction');
const WalletLedger = require('../../models/WalletLedger');
const mongoose = require('mongoose');

// @desc    Generate Transaction Report (Aggregated by Date)
// @route   GET /api/admin/reports/transactions
// @access  Private (Admin / Finance)
const generateTransactionReport = async (req, res, next) => {
  try {
    const { startDate, endDate, showTest } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    if (showTest !== 'true') {
      matchStage.isTest = { $ne: true };
      matchStage.referenceId = { $not: /^TEST/i };
    }

    const report = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
            service: "$service"
          },
          totalCount: { $sum: 1 },
          totalAmountPaise: { $sum: "$amountPaise" },
          totalCommissionPaise: { $sum: "$commissionEarnedPaise" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          status: "$_id.status",
          service: "$_id.service",
          totalCount: 1,
          totalAmountPaise: 1,
          totalCommissionPaise: 1
        }
      },
      { $sort: { date: -1, status: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate Ledger Report (Aggregated Credits vs Debits)
// @route   GET /api/admin/reports/ledger
// @access  Private (Admin / Finance)
const generateLedgerReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const report = await WalletLedger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
            transactionType: "$transactionType"
          },
          totalCount: { $sum: 1 },
          totalAmountPaise: { $sum: "$amountPaise" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          type: "$_id.type",
          transactionType: "$_id.transactionType",
          totalCount: 1,
          totalAmountPaise: 1
        }
      },
      { $sort: { date: -1, type: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateTransactionReport,
  generateLedgerReport
};
