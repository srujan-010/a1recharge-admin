const ProviderFactory = require('../../services/providers/provider.factory');
const RechargeTransaction = require('../../models/RechargeTransaction');
const User = require('../../models/User');
const ProviderWallet = require('../../models/ProviderWallet');

/**
 * Format Operator Code to Professional Full Name
 */
function formatOperatorName(opCode, providerName) {
  if (!opCode) return providerName || 'A1Topup';
  const code = String(opCode).trim().toUpperCase();

  if (code === 'A' || code === 'AIRTEL') return 'Airtel';
  if (code === 'RC' || code === 'JIO' || code.includes('RELIANCE')) return 'Jio';
  if (code === 'STV' || code.includes('BSNL')) return 'BSNL STV';
  if (code === 'MSEDC' || code.includes('MSEDCL')) return 'MSEDCL';
  if (code === 'V' || code === 'VI' || code.includes('VODAFONE')) return 'Vi';
  if (code.includes('TATA')) return 'Tata Play';
  if (code.includes('DISH')) return 'Dish TV';
  if (code.includes('SUN')) return 'Sun Direct';
  if (code.includes('DTH')) return 'DTH TV';

  return opCode;
}

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
    case 'ALL':
    default:
      return null;
  }
}

// @desc    Get Provider Wallet Dashboard Stats (Filtered by Period)
// @route   GET /api/admin/provider-wallet/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const startDate = getStartDateForPeriod(period);

    const matchQuery = {
      isTest: { $ne: true },
      orderId: { $not: /^TEST/i }
    };
    if (startDate) {
      matchQuery.createdAt = { $gte: startDate };
    }

    const [
      rechargeStats,
      walletData,
      a1TopupBalanceData
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
      ProviderWallet.findOne({ providerName: 'A1Topup' }),
      ProviderFactory.getProvider('A1Topup').balance().catch(() => null)
    ]);

    let successCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let volumeRupees = 0;
    let providerCommRupees = 0;
    let retailerCommRupees = 0;

    rechargeStats.forEach(item => {
      const st = (item._id || '').toUpperCase();
      if (st === 'SUCCESS') {
        successCount = item.count;
        volumeRupees += item.volumeRupees || 0;
        providerCommRupees += item.providerCommRupees || 0;
        retailerCommRupees += item.retailerCommRupees || 0;
      } else if (st === 'FAILED') {
        failedCount = item.count;
      } else if (st === 'PENDING') {
        pendingCount = item.count;
      }
    });

    const liveBalance = a1TopupBalanceData?.success ? a1TopupBalanceData.balance : (walletData?.balance || 1077.97);
    const todaysRechargeVolume = volumeRupees.toFixed(2);
    const todaysDebit = (volumeRupees - providerCommRupees).toFixed(2);
    const todaysProfit = (providerCommRupees - retailerCommRupees).toFixed(2);
    
    let health = 'Safe';
    if (liveBalance < 400) health = 'Critical';
    else if (liveBalance < 1000) health = 'Warning';

    res.status(200).json({
      success: true,
      data: {
        liveBalance,
        todaysRechargeVolume,
        todaysDebit: parseFloat(todaysDebit) > 0 ? todaysDebit : '0.00',
        todaysProfit: parseFloat(todaysProfit) > 0 ? todaysProfit : '0.00',
        todaysCommissionEarned: providerCommRupees.toFixed(2),
        todaysSuccessCount: successCount,
        todaysFailedCount: failedCount,
        todaysPendingCount: pendingCount,
        health,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Live Provider Transactions (Recharge Transactions mapped with full search & period filtering)
// @route   GET /api/admin/provider-wallet/transactions
// @access  Private (Admin)
const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const startIndex = (page - 1) * limit;

    const { status, period, search } = req.query;

    const query = {};
    if (req.query.showTest !== 'true') {
      query.isTest = { $ne: true };
      query.orderId = { $not: /^TEST/i };
    }

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    // Period filtering
    const startDate = getStartDateForPeriod(period);
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }

    // Comprehensive Search filter across Order ID, Recharge ID, Mobile Number, Operator, Remark
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { orderId: regex },
        { mobileNumber: regex },
        { providerTransactionId: regex },
        { operatorReference: regex },
        { operatorCode: regex },
        { failureReason: regex }
      ];
    }

    const total = await RechargeTransaction.countDocuments(query);
    
    const recharges = await RechargeTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('userId', 'name phone shopName')
      .lean();

    const mappedTransactions = recharges.map(tx => {
      const isSuccess = tx.status === 'SUCCESS';
      const amount = tx.amount || 0;

      // Default margin percents by operator
      let marginPercent = 0.80; // default 0.8%
      const op = (tx.operatorCode || '').toUpperCase();
      if (op.includes('DTH') || op.includes('SUN') || op.includes('TATA') || op.includes('DISH')) {
        marginPercent = 3.30;
      } else if (op.includes('BSNL') || op === 'STV') {
        marginPercent = 3.00;
      } else if (op.includes('VI') || op.includes('VODAFONE') || op === 'V') {
        marginPercent = 1.80;
      } else if (op.includes('AIRTEL') || op === 'A' || op.includes('JIO') || op === 'RC') {
        marginPercent = 0.80;
      }

      const profit = isSuccess ? parseFloat(((amount * marginPercent) / 100).toFixed(2)) : 0.00;
      const debitedAmount = isSuccess ? parseFloat((amount - profit).toFixed(2)) : 0.00;

      return {
        _id: tx._id,
        createdAt: tx.createdAt,
        rechargeId: tx.providerTransactionId || tx.operatorReference || String(tx._id).substring(18, 24),
        service: tx.service || 'Mobile Recharge',
        company: formatOperatorName(tx.operatorCode, tx.providerName),
        number: tx.mobileNumber || 'N/A',
        amount,
        marginPercent: `${marginPercent.toFixed(2)}%`,
        debitedAmount,
        profit,
        operatorIdRemark: tx.providerTransactionId || tx.operatorReference || tx.failureReason || 'N/A',
        status: (tx.status || 'PENDING').toUpperCase(),
        orderId: tx.orderId || `A1R${String(tx._id).substring(18).toUpperCase()}`,
        retailerName: tx.userId ? (tx.userId.name || tx.userId.phone) : 'Retailer'
      };
    });

    res.status(200).json({
      success: true,
      data: mappedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Fast2SMS Wallet Balance & Credits
// @route   GET /api/admin/providers/fast2sms/wallet
// @access  Private (Admin)
const getFast2SMSWallet = async (req, res, next) => {
  try {
    const fast2smsService = require('../../services/fast2sms.service');
    const result = await fast2smsService.getWalletBalance();

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getTransactions,
  getFast2SMSWallet
};
