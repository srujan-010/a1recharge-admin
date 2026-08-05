const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');
const Kyc = require('../../models/Kyc');
const Bank = require('../../models/Bank');
const Transaction = require('../../models/Transaction');
const CommissionHistory = require('../../models/CommissionHistory');
const { logAudit } = require('../../utils/auditHelper');
const NotificationService = require('../../services/notification.service');
const OtpSession = require('../../models/OtpSession');

// @desc    Get all retailers (Paginated & Searchable)
// @route   GET /api/admin/retailers
// @access  Private (Admin)
const getRetailers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = { role: 'retailer' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { retailerId: { $regex: search, $options: 'i' } },
        { shopName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const startIndex = (page - 1) * limit;
    const total = await User.countDocuments(query);
    
    // Fetch retailers
    const retailers = await User.find(query)
      .select('-mpinHash -otp -otpExpires') // Hide sensitive info
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    // Fetch wallet balances for these retailers
    const userIds = retailers.map(r => r._id);
    const wallets = await Wallet.find({ userId: { $in: userIds } }).lean();
    
    // Calculate Today's & Monthly Recharge
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const rechargeStats = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          status: 'success',
          type: 'debit',
          isTest: { $ne: true },
          service: { $nin: ['wallet_topup', 'commission', 'refund', 'manual_adjustment', 'admin_credit', 'admin_debit', 'system_credit', 'ledger_entry'] },
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$userId',
          todaysRechargePaise: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', startOfToday] }, '$amountPaise', 0]
            }
          },
          monthlyRechargePaise: {
            $sum: '$amountPaise'
          }
        }
      }
    ]);

    const statsMap = rechargeStats.reduce((acc, stat) => {
      acc[stat._id.toString()] = {
        todaysRechargePaise: stat.todaysRechargePaise,
        monthlyRechargePaise: stat.monthlyRechargePaise
      };
      return acc;
    }, {});
    
    // Map wallet balances to retailers
    const walletMap = wallets.reduce((acc, w) => {
      acc[w.userId.toString()] = w.balancePaise;
      return acc;
    }, {});

    const enrichedRetailers = retailers.map(r => ({
      ...r,
      walletBalancePaise: walletMap[r._id.toString()] || 0,
      todaysRechargePaise: statsMap[r._id.toString()]?.todaysRechargePaise || 0,
      monthlyRechargePaise: statsMap[r._id.toString()]?.monthlyRechargePaise || 0
    }));

    res.status(200).json({
      success: true,
      data: enrichedRetailers,
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

// @desc    Get single retailer profile with all related data
// @route   GET /api/admin/retailers/:id
// @access  Private (Admin)
const getRetailerById = async (req, res, next) => {
  try {
    const retailer = await User.findById(req.params.id)
      .select('-mpinHash -otp -otpExpires')
      .lean();

    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Parallel fetch related data
    const [
      wallet, kyc, bank, recentTxns, lastLogins,
      txnStats, commissionStats, ledgerStats
    ] = await Promise.all([
      Wallet.findOne({ userId: retailer._id }).lean(),
      Kyc.findOne({ userId: retailer._id }).lean(),
      Bank.findOne({ userId: retailer._id }).lean(),
      Transaction.find({ userId: retailer._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      // Mocking last logins for now until we have an AuthLog collection
      Promise.resolve([]),
      
      // Transaction Aggregations
      Transaction.aggregate([
        { $match: { 
          userId: retailer._id, 
          isTest: { $ne: true },
          service: { $nin: ['wallet_topup', 'commission', 'refund', 'manual_adjustment', 'admin_credit', 'admin_debit', 'system_credit', 'ledger_entry'] }
        } },
        {
          $group: {
            _id: null,
            lifetimeRecharge: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amountPaise', 0] } },
            todaysRecharge: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'success'] }, { $gte: ['$createdAt', startOfToday] }] }, '$amountPaise', 0] } },
            monthlyRecharge: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'success'] }, { $gte: ['$createdAt', startOfMonth] }] }, '$amountPaise', 0] } },
            successfulRecharges: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failedRecharges: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            pendingRecharges: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            highestRecharge: { $max: { $cond: [{ $eq: ['$status', 'success'] }, '$amountPaise', 0] } }
          }
        }
      ]),
      
      // Commission / Profit Aggregations
      CommissionHistory.aggregate([
        { $match: { userId: retailer._id } },
        {
          $lookup: {
            from: 'transactions',
            localField: 'transactionId',
            foreignField: '_id',
            as: 'txn'
          }
        },
        { $unwind: { path: '$txn', preserveNullAndEmptyArrays: true } },
        // Only count for success transactions
        { $match: { 'txn.status': 'success' } },
        {
          $group: {
            _id: null,
            lifetimeCompanyProfit: { $sum: '$companyProfitAmount' },
            lifetimeRetailerCommission: { $sum: '$retailerCommissionAmount' },
            lifetimeProviderCommission: { $sum: '$providerCommissionAmount' },
            todaysCompanyProfit: { $sum: { $cond: [{ $gte: ['$createdAt', startOfToday] }, '$companyProfitAmount', 0] } }
          }
        }
      ]),
      
      // Ledger Aggregations
      WalletLedger.aggregate([
        { $match: { userId: retailer._id } },
        {
          $group: {
            _id: null,
            lifetimeCredit: { $sum: { $cond: [{ $eq: ['$transactionType', 'CREDIT'] }, '$amount', 0] } },
            lifetimeDebit: { $sum: { $cond: [{ $eq: ['$transactionType', 'DEBIT'] }, '$amount', 0] } },
            todaysCredit: { $sum: { $cond: [{ $and: [{ $eq: ['$transactionType', 'CREDIT'] }, { $gte: ['$createdAt', startOfToday] }] }, '$amount', 0] } },
            todaysDebit: { $sum: { $cond: [{ $and: [{ $eq: ['$transactionType', 'DEBIT'] }, { $gte: ['$createdAt', startOfToday] }] }, '$amount', 0] } }
          }
        }
      ])
    ]);

    const tx = txnStats[0] || {};
    const comm = commissionStats[0] || {};
    const led = ledgerStats[0] || {};

    const totalRecharges = (tx.successfulRecharges || 0) + (tx.failedRecharges || 0);
    const successRate = totalRecharges > 0 ? ((tx.successfulRecharges / totalRecharges) * 100).toFixed(1) : 0;
    const avgRechargePaise = (tx.successfulRecharges || 0) > 0 ? (tx.lifetimeRecharge || 0) / tx.successfulRecharges : 0;

    res.status(200).json({
      success: true,
      data: {
        ...retailer,
        wallet: wallet || { balancePaise: 0, onHoldPaise: 0, updatedAt: new Date() },
        kyc: kyc || { status: retailer.kycStatus, documents: [] },
        bank: bank || null,
        recentTransactions: recentTxns,
        recentLogins: lastLogins,
        businessStats: {
          lifetimeRechargePaise: tx.lifetimeRecharge || 0,
          todaysRechargePaise: tx.todaysRecharge || 0,
          monthlyRechargePaise: tx.monthlyRecharge || 0,
          successfulRecharges: tx.successfulRecharges || 0,
          failedRecharges: tx.failedRecharges || 0,
          pendingRecharges: tx.pendingRecharges || 0,
          successRate: Number(successRate),
          averageRechargePaise: avgRechargePaise,
          highestRechargePaise: tx.highestRecharge || 0,
          lifetimeCompanyProfit: comm.lifetimeCompanyProfit || 0,
          todaysCompanyProfit: comm.todaysCompanyProfit || 0,
          lifetimeRetailerCommission: comm.lifetimeRetailerCommission || 0,
          lifetimeProviderCommission: comm.lifetimeProviderCommission || 0
        },
        walletStats: {
          lifetimeCredit: led.lifetimeCredit || 0,
          lifetimeDebit: led.lifetimeDebit || 0,
          todaysCredit: led.todaysCredit || 0,
          todaysDebit: led.todaysDebit || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update retailer status (e.g. Suspend, Active)
// @route   PUT /api/admin/retailers/:id/status
// @access  Private (Admin/Support)
const updateRetailerStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    
    if (!['active', 'suspended', 'blocked'].includes(status)) {
      res.status(400);
      throw new Error('Invalid status value');
    }

    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const oldStatus = retailer.status;
    retailer.status = status;
    await retailer.save();

    if (status === 'suspended' || status === 'blocked') {
      NotificationService.sendAccountBlocked({ userId: retailer._id, reason });
    } else if (status === 'active') {
      NotificationService.sendAccountActivated({ userId: retailer._id });
    }

    // Audit log this critical action
    await logAudit(
      req.admin, 
      `CHANGE_STATUS`, 
      'RETAILER', 
      { status: oldStatus }, 
      { status: retailer.status, reason }, 
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: `Retailer status changed to ${status}`,
      data: retailer.toSafeJSON ? retailer.toSafeJSON() : retailer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlock a locked retailer account
// @route   POST /api/admin/retailers/:id/unlock
// @access  Private (Super Admin / Admin)
const unlockRetailerAccount = async (req, res, next) => {
  try {
    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const wasLocked = !!(retailer.lockUntil && new Date(retailer.lockUntil) > new Date());
    const oldLockReason = retailer.lockReason || 'Too many failed OTP attempts';
    const oldLockTime = retailer.lockTime;
    const oldLockUntil = retailer.lockUntil;

    // Reset failed login/mpin attempts and clear lock fields
    retailer.failedMpinAttempts = 0;
    retailer.failedLoginAttempts = 0;
    retailer.lockUntil = undefined;
    retailer.lockReason = undefined;
    retailer.lockTime = undefined;

    await retailer.save();

    // Clear any active OtpSession lock for retailer's phone if present
    if (retailer.phone) {
      await OtpSession.findOneAndUpdate(
        { phone: retailer.phone },
        { $unset: { blockedUntil: 1 }, $set: { verifyAttempts: 0, requestCount: 0 } }
      );
    }

    // Record Audit Log: Action: ACCOUNT_UNLOCKED, Resource: Retailer
    await logAudit(
      req.admin,
      'ACCOUNT_UNLOCKED',
      'Retailer',
      {
        isLocked: wasLocked,
        lockUntil: oldLockUntil,
        lockReason: oldLockReason,
        lockTime: oldLockTime
      },
      {
        isLocked: false,
        retailerId: retailer.retailerId,
        retailerName: retailer.name,
        timestamp: new Date()
      },
      req,
      retailer._id
    );

    const safeData = retailer.toSafeJSON ? retailer.toSafeJSON() : retailer;

    res.status(200).json({
      success: true,
      message: 'Retailer account unlocked successfully.',
      data: safeData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRetailers,
  getRetailerById,
  updateRetailerStatus,
  unlockRetailerAccount
};
