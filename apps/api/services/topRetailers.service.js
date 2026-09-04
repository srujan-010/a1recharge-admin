const mongoose = require('mongoose');
const RechargeTransaction = require('../models/RechargeTransaction');

class TopRetailersService {
  /**
   * Helper to parse date boundaries strictly in Asia/Kolkata (IST, UTC+05:30)
   */
  static parseDateRange(startDateInput, endDateInput, period = 'today') {
    const now = new Date();

    // If custom range provided
    if (startDateInput && endDateInput) {
      const startStr = `${startDateInput}T00:00:00.000+05:30`;
      const endStr = `${endDateInput}T23:59:59.999+05:30`;
      return {
        startDate: new Date(startStr),
        endDate: new Date(endStr),
        periodName: 'custom',
      };
    }

    const p = (period || 'today').toLowerCase();

    // Get current date components in Asia/Kolkata
    const istDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const [yearStr, monthStr, dayStr] = istDateString.split('-');
    const curYear = parseInt(yearStr, 10);
    const curMonth = parseInt(monthStr, 10); // 1-12
    const curDay = parseInt(dayStr, 10);

    if (p === 'today') {
      const start = new Date(`${istDateString}T00:00:00.000+05:30`);
      return { startDate: start, endDate: now, periodName: 'today' };
    }

    if (p === 'yesterday') {
      const yDate = new Date(new Date(`${istDateString}T12:00:00.000+05:30`).getTime() - 24 * 60 * 60 * 1000);
      const yDateStr = yDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const start = new Date(`${yDateStr}T00:00:00.000+05:30`);
      const end = new Date(`${yDateStr}T23:59:59.999+05:30`);
      return { startDate: start, endDate: end, periodName: 'yesterday' };
    }

    if (p === '7d' || p === '7days' || p === 'last 7 days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start, endDate: now, periodName: '7d' };
    }

    if (p === '30d' || p === '30days' || p === 'last 30 days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: start, endDate: now, periodName: '30d' };
    }

    if (p === 'this_month' || p === 'month' || p === 'this month') {
      const mm = String(curMonth).padStart(2, '0');
      const start = new Date(`${curYear}-${mm}-01T00:00:00.000+05:30`);
      return { startDate: start, endDate: now, periodName: 'this_month' };
    }

    if (p === 'last_month' || p === 'last month') {
      let prevMonth = curMonth - 1;
      let prevYear = curYear;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const mm = String(prevMonth).padStart(2, '0');
      const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
      const dd = String(lastDayOfPrevMonth).padStart(2, '0');
      const start = new Date(`${prevYear}-${mm}-01T00:00:00.000+05:30`);
      const end = new Date(`${prevYear}-${mm}-${dd}T23:59:59.999+05:30`);
      return { startDate: start, endDate: end, periodName: 'last_month' };
    }

    if (p === 'this_year' || p === 'year' || p === 'this year') {
      const start = new Date(`${curYear}-01-01T00:00:00.000+05:30`);
      return { startDate: start, endDate: now, periodName: 'this_year' };
    }

    if (p === 'all' || p === 'all_time' || p === 'all time') {
      return { startDate: new Date(0), endDate: now, periodName: 'all' };
    }

    // Default: today
    const start = new Date(`${istDateString}T00:00:00.000+05:30`);
    return { startDate: start, endDate: now, periodName: 'today' };
  }

  /**
   * Primary Aggregation Method for Top Retailers Analytics
   */
  static async getTopRetailers({
    startDate,
    endDate,
    period = 'today',
    sortBy = 'volume',
    sortOrder = 'desc',
    limit = 10,
    accountType = 'all',
    showTest = false,
  }) {
    const { startDate: start, endDate: end, periodName } = this.parseDateRange(startDate, endDate, period);

    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const isAsc = String(sortOrder).toLowerCase() === 'asc';
    const sortDirection = isAsc ? 1 : -1;

    // Determine sort field
    let sortField = 'rechargeVolumePaise';
    const s = String(sortBy).toLowerCase();
    if (s === 'count' || s === 'rechargecount') {
      sortField = 'successfulRecharges';
    } else if (s === 'commission' || s === 'commissionpaise') {
      sortField = 'commissionPaise';
    } else if (s === 'successrate' || s === 'rate') {
      sortField = 'successRate';
    }

    // Base match criteria on authoritative RechargeTransaction (resilient to BSON Date and ISO String types)
    const matchQuery = {
      $expr: {
        $and: [
          { $gte: [{ $toDate: { $ifNull: ['$createdAt', '$completedAt'] } }, start] },
          { $lte: [{ $toDate: { $ifNull: ['$createdAt', '$completedAt'] } }, end] },
        ],
      },
    };

    if (!showTest) {
      matchQuery.isTest = { $ne: true };
      matchQuery.orderId = { $not: /^(TEST|COM)/i };
    } else {
      matchQuery.orderId = { $not: /^COM/i };
    }
    matchQuery.operatorCode = { $ne: 'COMMISSION' };

    if (accountType && accountType.toUpperCase() !== 'ALL') {
      matchQuery.accountType = accountType.toUpperCase();
    }

    // Main Aggregation Pipeline
    const pipeline = [
      { $match: matchQuery },

      // Lookup Commission History to extract exact historical retailer commission
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc',
        },
      },
      {
        $addFields: {
          comm: { $arrayElemAt: ['$commissionDoc', 0] },
        },
      },

      // Group by Retailer (userId)
      {
        $group: {
          _id: '$userId',
          successfulRecharges: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
          },
          failedRecharges: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
          rechargeVolumePaise: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                {
                  $cond: [
                    { $and: [{ $ne: ['$grossAmountPaise', null] }, { $gt: ['$grossAmountPaise', 0] }] },
                    '$grossAmountPaise',
                    {
                      $cond: [
                        { $and: [{ $ne: ['$amountPaise', null] }, { $gt: ['$amountPaise', 0] }] },
                        '$amountPaise',
                        { $round: [{ $multiply: [{ $ifNull: ['$amount', 0] }, 100] }, 0] },
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
          commissionPaise: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUCCESS'] },
                {
                  $cond: [
                    { $ne: ['$comm.retailerCommissionAmountPaise', null] },
                    '$comm.retailerCommissionAmountPaise',
                    {
                      $cond: [
                        { $ne: ['$commissionAmountPaise', null] },
                        '$commissionAmountPaise',
                        { $round: [{ $multiply: [{ $ifNull: ['$comm.retailerCommissionAmount', { $ifNull: ['$commissionAmount', 0] }] }, 100] }, 0] },
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
          lastRechargeAt: { $max: { $toDate: { $ifNull: ['$createdAt', '$completedAt'] } } },
          // Collect services and payment methods for successful transactions
          txItems: {
            $push: {
              status: '$status',
              operatorCode: '$operatorCode',
              paymentMethod: '$paymentMethod',
              amount: '$amount',
            },
          },
        },
      },

      // Only include retailers with at least 1 successful recharge in the ranking
      {
        $match: {
          successfulRecharges: { $gt: 0 },
        },
      },

      // Lookup User details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      {
        $addFields: {
          user: { $arrayElemAt: ['$userDoc', 0] },
        },
      },

      // Calculate Derived Metrics
      {
        $addFields: {
          totalAttempts: { $add: ['$successfulRecharges', '$failedRecharges'] },
          successRate: {
            $cond: [
              { $gt: [{ $add: ['$successfulRecharges', '$failedRecharges'] }, 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$successfulRecharges', { $add: ['$successfulRecharges', '$failedRecharges'] }] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
          averageRechargePaise: {
            $cond: [
              { $gt: ['$successfulRecharges', 0] },
              { $round: [{ $divide: ['$rechargeVolumePaise', '$successfulRecharges'] }, 0] },
              0,
            ],
          },
        },
      },

      // Sort
      {
        $sort: {
          [sortField]: sortDirection,
          rechargeVolumePaise: -1, // Secondary tie-breaker
          _id: 1,
        },
      },
    ];

    const results = await RechargeTransaction.aggregate(pipeline);

    // Compute Overall Summary from the un-limited results
    const totalRechargeVolumePaise = results.reduce((sum, r) => sum + (r.rechargeVolumePaise || 0), 0);
    const successfulRechargeCount = results.reduce((sum, r) => sum + (r.successfulRecharges || 0), 0);
    const totalCommissionPaise = results.reduce((sum, r) => sum + (r.commissionPaise || 0), 0);
    const activeRetailerCount = results.length;

    // DTH operator codes set for service classification
    const dthCodes = new Set(['VIDEOCON D2H', 'DISH TV', 'SUN DIRECT', 'TATA SKY', 'D2H', 'TS', 'AD', 'VD', 'SUN']);

    // Format retailer list with rank, clean service & payment method breakdown
    const formattedRetailers = results.map((r, index) => {
      // Calculate service breakdown
      let mobileVolPaise = 0;
      let mobileCount = 0;
      let dthVolPaise = 0;
      let dthCount = 0;

      // Calculate payment method breakdown
      let walletVolPaise = 0;
      let walletCount = 0;
      let upiVolPaise = 0;
      let upiCount = 0;

      (r.txItems || []).forEach(item => {
        if (item.status === 'SUCCESS') {
          const paise = Math.round((item.amount || 0) * 100);
          const op = String(item.operatorCode || '').toUpperCase();
          if (dthCodes.has(op)) {
            dthVolPaise += paise;
            dthCount += 1;
          } else {
            mobileVolPaise += paise;
            mobileCount += 1;
          }

          const pm = String(item.paymentMethod || 'WALLET').toUpperCase();
          if (pm === 'UPI' || pm.includes('UPI') || pm === 'RAZORPAY') {
            upiVolPaise += paise;
            upiCount += 1;
          } else {
            walletVolPaise += paise;
            walletCount += 1;
          }
        }
      });

      const user = r.user || {};
      const rawAccountType = String(user.accountType || 'RETAILER').toUpperCase();
      let accountTypeFormatted = 'RETAILER';
      if (rawAccountType === 'BUSINESS') accountTypeFormatted = 'BUSINESS';
      else if (rawAccountType === 'PERSONAL') accountTypeFormatted = 'PERSONAL';

      return {
        rank: index + 1,
        retailerId: r._id,
        retailerCode: user.retailerId || 'N/A',
        name: user.name || 'Unknown Retailer',
        phone: user.phone || user.mobileNumber || 'N/A',
        email: user.email || null,
        accountType: accountTypeFormatted,
        rechargeVolumePaise: r.rechargeVolumePaise,
        successfulRecharges: r.successfulRecharges,
        failedRecharges: r.failedRecharges,
        totalAttempts: r.totalAttempts,
        commissionPaise: r.commissionPaise,
        averageRechargePaise: r.averageRechargePaise,
        successRate: r.successRate,
        lastRechargeAt: r.lastRechargeAt,
        serviceBreakdown: {
          mobile: { volumePaise: mobileVolPaise, count: mobileCount },
          dth: { volumePaise: dthVolPaise, count: dthCount },
        },
        paymentMethodBreakdown: {
          wallet: { volumePaise: walletVolPaise, count: walletCount },
          upi: { volumePaise: upiVolPaise, count: upiCount },
        },
      };
    });

    // Top Retailer highlight is Rank #1
    const topRetailer = formattedRetailers.length > 0 ? formattedRetailers[0] : null;

    // Apply Top N Limit
    const limitedRetailers = formattedRetailers.slice(0, limitNum);

    return {
      period: {
        name: periodName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      summary: {
        totalRechargeVolumePaise,
        successfulRechargeCount,
        totalCommissionPaise,
        activeRetailerCount,
      },
      topRetailer,
      retailers: limitedRetailers,
      pagination: {
        total: formattedRetailers.length,
        limit: limitNum,
        displayed: limitedRetailers.length,
      },
    };
  }
}

module.exports = TopRetailersService;
