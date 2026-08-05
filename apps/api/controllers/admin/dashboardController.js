const RechargeTransaction = require('../../models/RechargeTransaction');
const User = require('../../models/User');
const ProviderWallet = require('../../models/ProviderWallet');

/**
 * Helper to calculate period start date
 */
function getStartDateForPeriod(period = 'today') {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return start;
    }
    default: {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
  }
}

// @desc    Get Dashboard Statistics (Dynamic DB Query by Period on RechargeTransaction)
// @route   GET /api/admin/dashboard/stats
// @access  Private (Admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const startDate = getStartDateForPeriod(period);

    const matchQuery = {
      createdAt: { $gte: startDate },
      isTest: { $ne: true },
      orderId: { $not: /^TEST/i }
    };

    const [
      rechargeStats,
      totalRetailers,
      activeRetailers,
      walletData
    ] = await Promise.all([
      RechargeTransaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            volumeRupees: {
              $sum: {
                $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0]
              }
            },
            providerCommRupees: {
              $sum: {
                $cond: [{ $eq: ['$status', 'SUCCESS'] }, { $ifNull: ['$providerCommission', 0] }, 0]
              }
            },
            retailerCommRupees: {
              $sum: {
                $cond: [{ $eq: ['$status', 'SUCCESS'] }, { $ifNull: ['$retailerCommission', 0] }, 0]
              }
            }
          }
        }
      ]),
      User.countDocuments({ role: 'retailer', isDeleted: { $ne: true } }),
      User.countDocuments({ role: 'retailer', status: 'active', isDeleted: { $ne: true } }),
      ProviderWallet.findOne({ providerName: 'A1Topup' })
    ]);

    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let rechargeVolumeRupees = 0;
    let providerCommRupees = 0;
    let retailerCommRupees = 0;

    rechargeStats.forEach(item => {
      const status = (item._id || '').toUpperCase();
      if (status === 'SUCCESS') {
        successCount = item.count;
        rechargeVolumeRupees += item.volumeRupees || 0;
        providerCommRupees += item.providerCommRupees || 0;
        retailerCommRupees += item.retailerCommRupees || 0;
      } else if (status === 'PENDING') {
        pendingCount = item.count;
      } else if (status === 'FAILED') {
        failedCount = item.count;
      }
    });

    const totalCount = successCount + pendingCount + failedCount;
    const successRate = totalCount > 0 ? parseFloat(((successCount / totalCount) * 100).toFixed(1)) : 0;
    const rechargeVolume = rechargeVolumeRupees.toFixed(2);
    const providerCommission = providerCommRupees.toFixed(2);
    const retailerCommission = retailerCommRupees.toFixed(2);
    const netProfit = (providerCommRupees - retailerCommRupees).toFixed(2);

    res.json({
      success: true,
      data: {
        rechargeVolume,
        providerCommission,
        retailerCommission,
        netProfit,
        rechargeCount: successCount,
        pendingRecharges: pendingCount,
        failedRecharges: failedCount,
        totalRecharges: totalCount,
        successRate,
        totalRetailers,
        activeRetailers,
        providerBalance: walletData?.balance !== undefined ? walletData.balance.toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Revenue Trend (Last 7 Days)
// @route   GET /api/admin/dashboard/trend
// @access  Private (Admin)
exports.getRevenueTrend = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);

    const trend = await RechargeTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: 'SUCCESS',
          isTest: { $ne: true },
          orderId: { $not: /^TEST/i }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedTrend = trend.map(t => {
      const dateObj = new Date(t._id);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return {
        name: days[dateObj.getDay()],
        revenue: t.revenue, // Direct amount in Rupees
        recharge: t.count
      };
    });

    res.json({ success: true, data: formattedTrend });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Live Transaction Feed (EXCLUSIVELY RechargeTransaction Collection)
// @route   GET /api/admin/dashboard/live
// @access  Private (Admin)
exports.getLiveFeed = async (req, res) => {
  try {
    const feed = await RechargeTransaction.find({
      isTest: { $ne: true },
      orderId: { $not: /^TEST/i }
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .populate('userId', 'name phone shopName')
      .select('orderId amount status providerName operatorCode service mobileNumber createdAt userId')
      .lean();

    const formattedFeed = feed.map(txn => {
      const amountRupees = typeof txn.amount === 'number' ? txn.amount.toFixed(2) : '0.00';

      return {
        id: txn._id,
        orderId: txn.orderId || `A1R${String(txn._id).substring(18).toUpperCase()}`,
        amount: amountRupees, // Direct recharge amount in Rupees (e.g. 199.00, 249.00, 399.00)
        status: (txn.status || 'SUCCESS').toUpperCase(),
        service: txn.service || 'Mobile Recharge',
        operator: txn.operatorCode || txn.providerName || 'Recharge',
        retailerName: txn.userId ? (txn.userId.name || txn.userId.phone) : 'Retailer',
        mobileNumber: txn.mobileNumber || '',
        timestamp: txn.createdAt
      };
    });

    res.json({ success: true, data: formattedFeed });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
