const RechargeTransaction = require('../models/RechargeTransaction');
const CommissionHistory = require('../models/CommissionHistory');
const WalletLedger = require('../models/WalletLedger');

const OPERATOR_NAME_MAP = {
  AT: 'Airtel',
  VI: 'Vi (Vodafone Idea)',
  JIO: 'Jio',
  BS: 'BSNL Topup',
  BST: 'BSNL Topup',
  BSS: 'BSNL Special',
  D2H: 'Videocon D2H',
  TS: 'Tata Play',
  AD: 'Airtel Digital TV',
  VD: 'Dish TV',
  SUN: 'Sun Direct',
};

class FinancialSummaryService {
  /**
   * Helper to parse date boundaries with Asia/Kolkata (IST) timezone awareness
   */
  static parseDateRange(startDateInput, endDateInput, period = null) {
    const now = new Date();

    if (startDateInput && endDateInput) {
      const startStr = `${startDateInput}T00:00:00.000+05:30`;
      const endStr = `${endDateInput}T23:59:59.999+05:30`;
      return {
        startDate: new Date(startStr),
        endDate: new Date(endStr),
      };
    }

    if (period) {
      const p = period.toLowerCase();
      if (p === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: now };
      }
      if (p === 'yesterday') {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
      if (p === '7d' || p === '7days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: now };
      }
      if (p === '30d' || p === '30days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        return { startDate: start, endDate: now };
      }
      if (p === 'this_month' || p === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { startDate: start, endDate: now };
      }
      if (p === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startDate: start, endDate: end };
      }
    }

    // Default to last 30 days
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: now };
  }

  /**
   * Primary Summary Calculation Method
   * Authoritative source of truth for Dashboard & Reports
   */
  static async getFinancialSummary({ startDate, endDate, period, accountType, showTest = false }) {
    const { startDate: start, endDate: end } = this.parseDateRange(startDate, endDate, period);

    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
    };

    if (!showTest) {
      matchQuery.isTest = { $ne: true };
      matchQuery.orderId = { $not: /^TEST/i };
    }

    if (accountType && accountType.toUpperCase() !== 'ALL') {
      matchQuery.accountType = accountType.toUpperCase();
    }

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc',
        },
      },
      {
        $unwind: {
          path: '$commissionDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            status: '$status',
            accountType: { $ifNull: ['$accountType', 'PERSONAL'] },
          },
          count: { $sum: 1 },
          volumeRupees: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0],
            },
          },
          providerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.providerCommissionAmount', 0] },
                0,
              ],
            },
          },
          retailerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.retailerCommissionAmount', 0] },
                0,
              ],
            },
          },
          companyProfitRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.companyProfitAmount', 0] },
                0,
              ],
            },
          },
        },
      },
    ];

    const stats = await RechargeTransaction.aggregate(aggregationPipeline);

    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let rechargeVolumeRupees = 0;
    let providerCommRupees = 0;
    let retailerCommRupees = 0;
    let personalCommRupees = 0;
    let businessCommRupees = 0;
    let companyProfitRupees = 0;

    stats.forEach(item => {
      const status = (item._id?.status || '').toUpperCase();
      const accType = (item._id?.accountType || 'PERSONAL').toUpperCase();

      if (status === 'SUCCESS') {
        successCount += item.count;
        rechargeVolumeRupees += item.volumeRupees || 0;
        providerCommRupees += item.providerCommRupees || 0;
        retailerCommRupees += item.retailerCommRupees || 0;
        companyProfitRupees += item.companyProfitRupees || 0;

        if (accType === 'BUSINESS') {
          businessCommRupees += item.retailerCommRupees || 0;
        } else {
          personalCommRupees += item.retailerCommRupees || 0;
        }
      } else if (status === 'PENDING') {
        pendingCount += item.count;
      } else if (status === 'FAILED') {
        failedCount += item.count;
      }
    });

    const totalCount = successCount + pendingCount + failedCount;
    const successRate = totalCount > 0 ? parseFloat(((successCount / totalCount) * 100).toFixed(1)) : 0;
    const netCompanyProfit = companyProfitRupees > 0 ? companyProfitRupees : (providerCommRupees - retailerCommRupees);
    const avgProfitPerSuccessTx = successCount > 0 ? parseFloat((netCompanyProfit / successCount).toFixed(2)) : 0;
    const profitMarginPct = rechargeVolumeRupees > 0 ? parseFloat(((netCompanyProfit / rechargeVolumeRupees) * 100).toFixed(2)) : 0;

    return {
      rechargeVolumeRupees: parseFloat(rechargeVolumeRupees.toFixed(2)),
      providerCommRupees: parseFloat(providerCommRupees.toFixed(2)),
      retailerCommRupees: parseFloat(retailerCommRupees.toFixed(2)),
      personalCommRupees: parseFloat(personalCommRupees.toFixed(2)),
      businessCommRupees: parseFloat(businessCommRupees.toFixed(2)),
      companyProfitRupees: parseFloat(netCompanyProfit.toFixed(2)),
      totalCommissionRupees: parseFloat(retailerCommRupees.toFixed(2)),
      avgProfitPerSuccessTx,
      profitMarginPct,

      // Paise values (for integer financial precision compatibility)
      totalAmountPaise: Math.round(rechargeVolumeRupees * 100),
      totalPersonalCommissionPaise: Math.round(personalCommRupees * 100),
      totalBusinessCommissionPaise: Math.round(businessCommRupees * 100),
      totalCommissionPaise: Math.round(retailerCommRupees * 100),

      // String formatted values
      rechargeVolume: rechargeVolumeRupees.toFixed(2),
      providerCommission: providerCommRupees.toFixed(2),
      retailerCommission: retailerCommRupees.toFixed(2),
      netProfit: netCompanyProfit.toFixed(2),

      // Count metrics
      successCount,
      pendingCount,
      failedCount,
      totalCount,
      successRate,
      dateRange: { startDate: start, endDate: end },
    };
  }

  /**
   * Personal vs Business Performance Aggregation
   */
  static async getAccountTypePerformance({ startDate, endDate, period, showTest = false }) {
    const { startDate: start, endDate: end } = this.parseDateRange(startDate, endDate, period);

    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
    };

    if (!showTest) {
      matchQuery.isTest = { $ne: true };
      matchQuery.orderId = { $not: /^TEST/i };
    }

    const aggregationPipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc',
        },
      },
      {
        $unwind: {
          path: '$commissionDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            accountType: { $ifNull: ['$accountType', 'PERSONAL'] },
            status: '$status',
          },
          count: { $sum: 1 },
          volumeRupees: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0],
            },
          },
          providerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.providerCommissionAmount', 0] },
                0,
              ],
            },
          },
          retailerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.retailerCommissionAmount', 0] },
                0,
              ],
            },
          },
          companyProfitRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.companyProfitAmount', 0] },
                0,
              ],
            },
          },
        },
      },
    ];

    const stats = await RechargeTransaction.aggregate(aggregationPipeline);

    const result = {
      PERSONAL: {
        rechargeVolume: 0,
        providerCommission: 0,
        retailerCommission: 0,
        companyProfit: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCount: 0,
        successRate: 0,
      },
      BUSINESS: {
        rechargeVolume: 0,
        providerCommission: 0,
        retailerCommission: 0,
        companyProfit: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCount: 0,
        successRate: 0,
      },
    };

    stats.forEach(item => {
      const accType = (item._id?.accountType || 'PERSONAL').toUpperCase() === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL';
      const status = (item._id?.status || '').toUpperCase();
      const target = result[accType];

      target.totalCount += item.count;

      if (status === 'SUCCESS') {
        target.successCount += item.count;
        target.rechargeVolume += item.volumeRupees || 0;
        target.providerCommission += item.providerCommRupees || 0;
        target.retailerCommission += item.retailerCommRupees || 0;

        const netProfit = item.companyProfitRupees > 0
          ? item.companyProfitRupees
          : ((item.providerCommRupees || 0) - (item.retailerCommRupees || 0));

        target.companyProfit += netProfit;
      } else if (status === 'FAILED') {
        target.failedCount += item.count;
      } else if (status === 'PENDING') {
        target.pendingCount += item.count;
      }
    });

    ['PERSONAL', 'BUSINESS'].forEach(accType => {
      const target = result[accType];
      target.rechargeVolume = parseFloat(target.rechargeVolume.toFixed(2));
      target.providerCommission = parseFloat(target.providerCommission.toFixed(2));
      target.retailerCommission = parseFloat(target.retailerCommission.toFixed(2));
      target.companyProfit = parseFloat(target.companyProfit.toFixed(2));
      target.successRate = target.totalCount > 0 ? parseFloat(((target.successCount / target.totalCount) * 100).toFixed(1)) : 0;
    });

    return result;
  }

  /**
   * Daily Performance Aggregation (Date-wise trends for charts)
   */
  static async getDailyPerformance({ startDate, endDate, period, accountType, showTest = false }) {
    const { startDate: start, endDate: end } = this.parseDateRange(startDate, endDate, period);

    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
    };

    if (!showTest) {
      matchQuery.isTest = { $ne: true };
      matchQuery.orderId = { $not: /^TEST/i };
    }

    if (accountType && accountType.toUpperCase() !== 'ALL') {
      matchQuery.accountType = accountType.toUpperCase();
    }

    const report = await RechargeTransaction.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc',
        },
      },
      {
        $unwind: {
          path: '$commissionDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
            status: '$status',
          },
          count: { $sum: 1 },
          volumeRupees: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0],
            },
          },
          providerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.providerCommissionAmount', 0] },
                0,
              ],
            },
          },
          retailerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.retailerCommissionAmount', 0] },
                0,
              ],
            },
          },
          companyProfitRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.companyProfitAmount', 0] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Format into date map
    const dateMap = {};

    report.forEach(item => {
      const date = item._id.date;
      const status = (item._id.status || '').toUpperCase();

      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          rechargeVolume: 0,
          providerCommission: 0,
          retailerCommission: 0,
          companyProfit: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          total: 0,
        };
      }

      const row = dateMap[date];
      row.total += item.count;

      if (status === 'SUCCESS') {
        row.successful += item.count;
        row.rechargeVolume += item.volumeRupees || 0;
        row.providerCommission += item.providerCommRupees || 0;
        row.retailerCommission += item.retailerCommRupees || 0;

        const netProfit = item.companyProfitRupees > 0
          ? item.companyProfitRupees
          : ((item.providerCommRupees || 0) - (item.retailerCommRupees || 0));

        row.companyProfit += netProfit;
      } else if (status === 'FAILED') {
        row.failed += item.count;
      } else if (status === 'PENDING') {
        row.pending += item.count;
      }
    });

    const dailyList = Object.values(dateMap).map(row => ({
      ...row,
      rechargeVolume: parseFloat(row.rechargeVolume.toFixed(2)),
      providerCommission: parseFloat(row.providerCommission.toFixed(2)),
      retailerCommission: parseFloat(row.retailerCommission.toFixed(2)),
      companyProfit: parseFloat(row.companyProfit.toFixed(2)),
      successRate: row.total > 0 ? parseFloat(((row.successful / row.total) * 100).toFixed(1)) : 0,
    }));

    return dailyList;
  }

  /**
   * Operator-wise Performance Aggregation
   */
  static async getOperatorPerformance({ startDate, endDate, period, accountType, showTest = false }) {
    const { startDate: start, endDate: end } = this.parseDateRange(startDate, endDate, period);

    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
    };

    if (!showTest) {
      matchQuery.isTest = { $ne: true };
      matchQuery.orderId = { $not: /^TEST/i };
    }

    if (accountType && accountType.toUpperCase() !== 'ALL') {
      matchQuery.accountType = accountType.toUpperCase();
    }

    const report = await RechargeTransaction.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc',
        },
      },
      {
        $unwind: {
          path: '$commissionDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            operatorCode: { $ifNull: ['$operatorCode', 'OTHER'] },
            status: '$status',
          },
          count: { $sum: 1 },
          volumeRupees: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0],
            },
          },
          providerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.providerCommissionAmount', 0] },
                0,
              ],
            },
          },
          retailerCommRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.retailerCommissionAmount', 0] },
                0,
              ],
            },
          },
          companyProfitRupees: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                { $ifNull: ['$commissionDoc.companyProfitAmount', 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const opMap = {};

    report.forEach(item => {
      const code = (item._id.operatorCode || 'OTHER').toUpperCase();
      const status = (item._id.status || '').toUpperCase();

      if (!opMap[code]) {
        opMap[code] = {
          operatorCode: code,
          operatorName: OPERATOR_NAME_MAP[code] || code,
          rechargeVolume: 0,
          providerCommission: 0,
          retailerCommission: 0,
          companyProfit: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          total: 0,
        };
      }

      const op = opMap[code];
      op.total += item.count;

      if (status === 'SUCCESS') {
        op.successful += item.count;
        op.rechargeVolume += item.volumeRupees || 0;
        op.providerCommission += item.providerCommRupees || 0;
        op.retailerCommission += item.retailerCommRupees || 0;

        const netProfit = item.companyProfitRupees > 0
          ? item.companyProfitRupees
          : ((item.providerCommRupees || 0) - (item.retailerCommRupees || 0));

        op.companyProfit += netProfit;
      } else if (status === 'FAILED') {
        op.failed += item.count;
      } else if (status === 'PENDING') {
        op.pending += item.count;
      }
    });

    const list = Object.values(opMap).map(op => ({
      ...op,
      rechargeVolume: parseFloat(op.rechargeVolume.toFixed(2)),
      providerCommission: parseFloat(op.providerCommission.toFixed(2)),
      retailerCommission: parseFloat(op.retailerCommission.toFixed(2)),
      companyProfit: parseFloat(op.companyProfit.toFixed(2)),
      successRate: op.total > 0 ? parseFloat(((op.successful / op.total) * 100).toFixed(1)) : 0,
    }));

    list.sort((a, b) => b.rechargeVolume - a.rechargeVolume);

    return list;
  }

  /**
   * Period Comparison (Selected Period vs Previous Equivalent Period)
   */
  static async getPeriodComparison({ startDate, endDate, period, accountType, showTest = false }) {
    const { startDate: currentStart, endDate: currentEnd } = this.parseDateRange(startDate, endDate, period);

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - durationMs);

    const [currentSummary, previousSummary] = await Promise.all([
      this.getFinancialSummary({ startDate: currentStart.toISOString().split('T')[0], endDate: currentEnd.toISOString().split('T')[0], accountType, showTest }),
      this.getFinancialSummary({ startDate: previousStart.toISOString().split('T')[0], endDate: previousEnd.toISOString().split('T')[0], accountType, showTest }),
    ]);

    const computeChange = (curr, prev) => {
      const diff = parseFloat((curr - prev).toFixed(2));
      const pct = prev > 0 ? parseFloat(((diff / prev) * 100).toFixed(1)) : (curr > 0 ? 100 : 0);
      return { current: curr, previous: prev, diff, pct };
    };

    return {
      rechargeVolume: computeChange(currentSummary.rechargeVolumeRupees, previousSummary.rechargeVolumeRupees),
      providerCommission: computeChange(currentSummary.providerCommRupees, previousSummary.providerCommRupees),
      retailerCommission: computeChange(currentSummary.retailerCommRupees, previousSummary.retailerCommRupees),
      companyProfit: computeChange(currentSummary.companyProfitRupees, previousSummary.companyProfitRupees),
      transactions: computeChange(currentSummary.successCount, previousSummary.successCount),
      previousDateRange: { startDate: previousStart, endDate: previousEnd },
    };
  }

  /**
   * Executive Master Dashboard Method for Financial Reports Screen
   */
  static async getExecutiveDashboardData({ startDate, endDate, period, accountType, showTest = false }) {
    const [
      summary,
      personalVsBusiness,
      dailyPerformance,
      operatorPerformance,
      periodComparison
    ] = await Promise.all([
      this.getFinancialSummary({ startDate, endDate, period, accountType, showTest }),
      this.getAccountTypePerformance({ startDate, endDate, period, showTest }),
      this.getDailyPerformance({ startDate, endDate, period, accountType, showTest }),
      this.getOperatorPerformance({ startDate, endDate, period, accountType, showTest }),
      this.getPeriodComparison({ startDate, endDate, period, accountType, showTest })
    ]);

    return {
      summary,
      personalVsBusiness,
      dailyPerformance,
      operatorPerformance,
      periodComparison,
    };
  }

  /**
   * Wallet Ledger Report Query
   */
  static async getLedgerReport({ startDate, endDate, period }) {
    const { startDate: start, endDate: end } = this.parseDateRange(startDate, endDate, period);

    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
    };

    const report = await WalletLedger.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
            type: '$transactionType',
            referenceType: '$referenceType',
          },
          totalCount: { $sum: 1 },
          totalAmountRupees: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          type: '$_id.type',
          transactionType: '$_id.referenceType',
          totalCount: 1,
          totalAmountRupees: { $round: ['$totalAmountRupees', 2] },
          totalAmountPaise: { $round: [{ $multiply: ['$totalAmountRupees', 100] }, 0] },
        },
      },
      { $sort: { date: -1, type: 1 } },
    ]);

    return report;
  }
}

module.exports = FinancialSummaryService;
