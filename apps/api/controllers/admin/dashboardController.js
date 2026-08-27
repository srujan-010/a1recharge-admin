const RechargeTransaction = require('../../models/RechargeTransaction');
const User = require('../../models/User');
const ProviderWallet = require('../../models/ProviderWallet');
const FinancialSummaryService = require('../../services/financialSummary.service');

// @desc    Get Dashboard Statistics (Dynamic DB Query via FinancialSummaryService)
// @route   GET /api/admin/dashboard/stats
// @access  Private (Admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const period = req.query.period || 'today';

    const [
      finSummary,
      totalRetailers,
      activeRetailers,
      walletData
    ] = await Promise.all([
      FinancialSummaryService.getFinancialSummary({ period }),
      User.countDocuments({ role: 'retailer', isDeleted: { $ne: true } }),
      User.countDocuments({ role: 'retailer', status: 'active', isDeleted: { $ne: true } }),
      ProviderWallet.findOne({ providerName: 'A1Topup' })
    ]);

    res.json({
      success: true,
      data: {
        rechargeVolume: finSummary.rechargeVolume,
        providerCommission: finSummary.providerCommission,
        retailerCommission: finSummary.retailerCommission,
        netProfit: finSummary.netProfit,
        rechargeCount: finSummary.successCount,
        pendingRecharges: finSummary.pendingCount,
        failedRecharges: finSummary.failedCount,
        totalRecharges: finSummary.totalCount,
        successRate: finSummary.successRate,
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
