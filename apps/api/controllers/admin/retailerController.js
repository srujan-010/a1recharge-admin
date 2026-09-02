const mongoose = require('mongoose');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');
const Kyc = require('../../models/Kyc');
const Bank = require('../../models/Bank');
const Transaction = require('../../models/Transaction');
const RechargeTransaction = require('../../models/RechargeTransaction');
const CommissionHistory = require('../../models/CommissionHistory');
const { logAudit } = require('../../utils/auditHelper');
const NotificationService = require('../../services/notification.service');
const OtpSession = require('../../models/OtpSession');
const walletService = require('../../services/wallet/wallet.service');

function getISTDateRanges() {
  const now = new Date();
  const istOffsetMs = 5.5 * 3600 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istTodayStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0));
  const startOfToday = new Date(istTodayStart.getTime() - istOffsetMs);

  const istMonthStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1, 0, 0, 0, 0));
  const startOfMonth = new Date(istMonthStart.getTime() - istOffsetMs);

  return { startOfToday, startOfMonth };
}

// @desc    Get all retailers (Paginated & Searchable)
// @route   GET /api/admin/retailers
// @access  Private (Admin)
const getRetailers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const accountType = req.query.accountType || '';

    const query = { role: 'retailer' };

    if (accountType && accountType !== 'all') {
      query.accountType = accountType.toUpperCase();
    }

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
    
    // Calculate Today's & Monthly Recharge using IST timezone boundaries
    const { startOfToday, startOfMonth } = getISTDateRanges();

    const rechargeStats = await RechargeTransaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          status: 'SUCCESS',
          isTest: { $ne: true },
          orderId: { $not: /^TEST/i },
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$userId',
          todaysRechargePaise: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', startOfToday] }, { $multiply: ['$amount', 100] }, 0]
            }
          },
          monthlyRechargePaise: {
            $sum: { $multiply: ['$amount', 100] }
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

    const enrichedRetailers = retailers.map(r => {
      let normAccountType = r.accountType;
      if (!normAccountType || !['PERSONAL', 'BUSINESS'].includes(normAccountType.toUpperCase())) {
        normAccountType = (r.shopName || r.businessType || r.gstNumber) ? 'BUSINESS' : 'PERSONAL';
      } else {
        normAccountType = normAccountType.toUpperCase();
      }
      return {
        ...r,
        accountType: normAccountType,
        walletBalancePaise: walletMap[r._id.toString()] || 0,
        todaysRechargePaise: statsMap[r._id.toString()]?.todaysRechargePaise || 0,
        monthlyRechargePaise: statsMap[r._id.toString()]?.monthlyRechargePaise || 0
      };
    });

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

    const { startOfToday, startOfMonth } = getISTDateRanges();

    // Parallel fetch related data
    const [
      wallet, kyc, bank, recentRawTxns, walletTopups, lastLogins,
      txnStats, commissionStats, ledgerStats
    ] = await Promise.all([
      Wallet.findOne({ userId: retailer._id }).lean(),
      Kyc.findOne({ userId: retailer._id }).lean(),
      Bank.findOne({ userId: retailer._id }).lean(),
      RechargeTransaction.find({ userId: retailer._id, isTest: { $ne: true }, orderId: { $not: /^TEST/i } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Transaction.find({ userId: retailer._id, service: 'wallet_topup', isTest: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Promise.resolve([]),
      
      // Transaction Aggregations
      RechargeTransaction.aggregate([
        { $match: { 
          userId: retailer._id, 
          isTest: { $ne: true },
          orderId: { $not: /^TEST/i }
        } },
        {
          $group: {
            _id: null,
            lifetimeRecharge: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, { $multiply: ['$amount', 100] }, 0] } },
            todaysRecharge: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'SUCCESS'] }, { $gte: ['$createdAt', startOfToday] }] }, { $multiply: ['$amount', 100] }, 0] } },
            monthlyRecharge: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'SUCCESS'] }, { $gte: ['$createdAt', startOfMonth] }] }, { $multiply: ['$amount', 100] }, 0] } },
            successfulRecharges: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
            failedRecharges: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
            pendingRecharges: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
            highestRecharge: { $max: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, { $multiply: ['$amount', 100] }, 0] } }
          }
        }
      ]),
      
      // Commission / Profit Aggregations
      CommissionHistory.aggregate([
        { $match: { userId: retailer._id } },
        {
          $lookup: {
            from: 'rechargetransactions',
            localField: 'transactionId',
            foreignField: '_id',
            as: 'txn'
          }
        },
        { $unwind: { path: '$txn', preserveNullAndEmptyArrays: true } },
        { $match: { 'txn.status': 'SUCCESS' } },
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

    // Attach CommissionHistory fields to recent transactions
    const recentTxnIds = recentRawTxns.map(t => t._id);
    const commHistoryList = await CommissionHistory.find({ transactionId: { $in: recentTxnIds } }).lean();
    const commMap = {};
    commHistoryList.forEach(c => {
      commMap[c.transactionId.toString()] = c;
    });

    const formattedRecharges = recentRawTxns.map(t => {
      const c = commMap[t._id.toString()] || {};
      return {
        ...t,
        amountPaise: (t.amount || 0) * 100,
        referenceId: t.orderId,
        operatorName: t.internalOperatorName || t.operatorCode || 'Recharge',
        retailerCommissionAmount: c.retailerCommissionAmount || 0,
        providerCommissionAmount: c.providerCommissionAmount || 0,
        companyProfitAmount: c.companyProfitAmount || 0,
        commissionEarnedPaise: (c.retailerCommissionAmount || 0) * 100,
      };
    });

    const formattedTopups = walletTopups.map(t => ({
      _id: t._id,
      orderId: t.referenceId,
      referenceId: t.referenceId,
      amount: t.amountPaise / 100,
      amountPaise: t.amountPaise,
      status: (t.status || 'SUCCESS').toUpperCase(),
      service: 'wallet_topup',
      serviceType: 'wallet_topup',
      operatorName: 'Wallet Top-up',
      internalOperatorName: 'Wallet Top-up',
      paymentMethod: t.paymentMethod || 'UPI',
      paymentStatus: t.paymentStatus || 'RAZORPAY_UPI',
      retailerCommissionAmount: 0,
      providerCommissionAmount: 0,
      companyProfitAmount: 0,
      commissionEarnedPaise: 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt || t.createdAt,
      upiDetails: t.upiDetails
    }));

    const recentTxns = [...formattedRecharges, ...formattedTopups]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    const tx = txnStats[0] || {};
    const comm = commissionStats[0] || {};
    const led = ledgerStats[0] || {};

    const totalRecharges = (tx.successfulRecharges || 0) + (tx.failedRecharges || 0);
    const successRate = totalRecharges > 0 ? ((tx.successfulRecharges / totalRecharges) * 100).toFixed(1) : 0;
    const avgRechargePaise = (tx.successfulRecharges || 0) > 0 ? (tx.lifetimeRecharge || 0) / tx.successfulRecharges : 0;

    // Fetch active holds/reserved transactions
    const activeHolds = await RechargeTransaction.find({
      userId: retailer._id,
      $or: [
        { reservedAmount: { $gt: 0 } },
        { status: { $in: ['PENDING', 'PROCESSING', 'PROVIDER_TIMEOUT', 'TIMEOUT'] } }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      data: {
        ...retailer,
        accountType: (retailer.accountType && ['PERSONAL', 'BUSINESS'].includes(retailer.accountType.toUpperCase()))
          ? retailer.accountType.toUpperCase()
          : ((retailer.shopName || retailer.businessType || retailer.gstNumber) ? 'BUSINESS' : 'PERSONAL'),
        wallet: wallet || { balancePaise: 0, onHoldPaise: 0, updatedAt: new Date() },
        kyc: kyc || { status: retailer.kycStatus, documents: [] },
        bank: bank || null,
        recentTransactions: recentTxns,
        recentLogins: lastLogins,
        activeHolds: activeHolds.map(h => ({
          _id: h._id,
          orderId: h.orderId,
          amount: h.amount,
          operatorCode: h.operatorCode,
          providerName: h.providerName || 'A1Topup',
          status: h.status,
          reservedAmount: h.reservedAmount || 0,
          createdAt: h.createdAt,
          mobileNumber: h.mobileNumber
        })),
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

// @desc    Update retailer account type (e.g. PERSONAL, BUSINESS)
// @route   PUT /api/admin/retailers/:id/account-type
// @access  Private (Admin)
const updateRetailerAccountType = async (req, res, next) => {
  try {
    const { accountType } = req.body;
    
    if (!accountType || !['PERSONAL', 'BUSINESS'].includes(accountType.toUpperCase())) {
      res.status(400);
      throw new Error('Invalid account type.');
    }

    const upperAccType = accountType.toUpperCase();
    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const oldAccountType = retailer.accountType || 'PERSONAL';
    retailer.accountType = upperAccType;
    await retailer.save();

    // Audit log this critical action
    await logAudit(
      req.admin, 
      `CHANGE_ACCOUNT_TYPE`, 
      'RETAILER', 
      { accountType: oldAccountType }, 
      { accountType: retailer.accountType }, 
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: `Retailer account type updated to ${upperAccType}`,
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

// @desc    Update retailer profile details
// @route   PUT /api/admin/retailers/:id
// @access  Private (Admin)
const updateRetailerProfile = async (req, res, next) => {
  try {
    const { name, phone, email, shopName, city, state, accountType } = req.body;
    const retailer = await User.findById(req.params.id);

    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const oldData = {
      name: retailer.name,
      phone: retailer.phone,
      email: retailer.email,
      shopName: retailer.shopName,
      city: retailer.city,
      state: retailer.state,
      accountType: retailer.accountType,
    };

    if (name !== undefined) retailer.name = name.trim();
    if (phone !== undefined) retailer.phone = phone.trim();
    if (email !== undefined) retailer.email = email.trim();
    if (shopName !== undefined) retailer.shopName = shopName.trim();
    if (city !== undefined) retailer.city = city.trim();
    if (state !== undefined) retailer.state = state.trim();
    if (accountType !== undefined && ['PERSONAL', 'BUSINESS'].includes(accountType.toUpperCase())) {
      retailer.accountType = accountType.toUpperCase();
    }

    await retailer.save();

    await logAudit(
      req.admin,
      'UPDATE_RETAILER',
      'Retailer',
      oldData,
      {
        name: retailer.name,
        phone: retailer.phone,
        email: retailer.email,
        shopName: retailer.shopName,
        city: retailer.city,
        state: retailer.state,
        accountType: retailer.accountType,
      },
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: 'Retailer profile updated successfully.',
      data: retailer.toSafeJSON ? retailer.toSafeJSON() : retailer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft Delete Retailer
// @route   DELETE /api/admin/retailers/:id
// @access  Private (Super Admin)
const deleteRetailer = async (req, res, next) => {
  try {
    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    retailer.status = 'blocked';
    retailer.isDeleted = true;
    retailer.deletedAt = new Date();
    await retailer.save();

    await logAudit(
      req.admin,
      'DELETE_RETAILER',
      'Retailer',
      { retailerId: retailer.retailerId, status: retailer.status },
      { isDeleted: true, status: 'blocked' },
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: 'Retailer account deleted (deactivated) successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Retailer Security (MPIN & Password)
// @route   POST /api/admin/retailers/:id/reset-security
// @access  Private (Admin)
const resetRetailerSecurity = async (req, res, next) => {
  try {
    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    retailer.failedMpinAttempts = 0;
    retailer.failedLoginAttempts = 0;
    retailer.isLocked = false;
    retailer.lockUntil = null;
    retailer.lockReason = null;
    retailer.mpinHash = undefined; // Force MPIN reset on next login
    await retailer.save();

    await logAudit(
      req.admin,
      'RESET_SECURITY',
      'Retailer',
      null,
      { retailerId: retailer.retailerId, action: 'RESET_SECURITY' },
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: 'Security credentials and MPIN lock reset successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke Retailer Active Sessions & FCM Token
// @route   POST /api/admin/retailers/:id/revoke-sessions
// @access  Private (Admin)
const revokeRetailerSessions = async (req, res, next) => {
  try {
    const retailer = await User.findById(req.params.id);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    retailer.fcmToken = null;
    retailer.tokenVersion = (retailer.tokenVersion || 0) + 1;
    await retailer.save();

    await logAudit(
      req.admin,
      'REVOKE_SESSIONS',
      'Retailer',
      null,
      { retailerId: retailer.retailerId, tokenVersion: retailer.tokenVersion },
      req,
      retailer._id
    );

    res.status(200).json({
      success: true,
      message: 'Active retailer sessions and device tokens revoked successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually release retailer wallet hold/reservation
// @route   POST /api/admin/retailers/:id/release-hold
// @access  Private (SuperAdmin, Admin, Finance)
const releaseRetailerHold = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderId, releaseAll, remarks } = req.body;
    const admin = req.admin;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Admin reason/remarks are required for releasing hold.' });
    }

    const retailer = await User.findById(id).lean();
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const wallet = await Wallet.findOne({ userId: retailer._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Retailer wallet not found' });
    }

    const previousHoldPaise = wallet.onHoldPaise || 0;
    const previousBalancePaise = wallet.balancePaise || 0;

    if (previousHoldPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Retailer currently has no wallet hold balance to release.' });
    }

    let releaseAmountPaise = 0;
    let targetTransaction = null;

    if (orderId) {
      targetTransaction = await RechargeTransaction.findOne({ 
        $or: [{ orderId }, { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : null }],
        userId: retailer._id 
      });

      if (!targetTransaction) {
        return res.status(404).json({ success: false, message: `No transaction found matching ${orderId} for this retailer.` });
      }

      // Protection Check: Active Processing Transaction Guard
      if (['PROCESSING', 'INITIATED', 'RECHARGE_PROCESSING'].includes(targetTransaction.status)) {
        return res.status(400).json({
          success: false,
          isProcessingWarning: true,
          message: `Transaction ${targetTransaction.orderId} is currently actively processing. Please verify provider status before releasing hold.`,
          data: targetTransaction
        });
      }

      const txnHoldPaise = targetTransaction.reservedAmount > 0 ? (targetTransaction.reservedAmount * 100) : previousHoldPaise;
      releaseAmountPaise = Math.min(txnHoldPaise, previousHoldPaise);
    } else {
      releaseAmountPaise = previousHoldPaise;
    }

    const releaseAmountRupees = releaseAmountPaise / 100;

    // Perform atomic wallet hold release via wallet service
    const updatedWallet = await walletService.releaseHoldWithLedger(retailer._id, releaseAmountRupees, {
      referenceId: targetTransaction?._id || retailer._id,
      orderId: targetTransaction?.orderId || 'MANUAL_RELEASE',
      description: `Manual admin hold release by ${admin.name}: ${remarks}`
    });

    if (targetTransaction) {
      targetTransaction.reservedAmount = 0;
      if (['PENDING', 'PROVIDER_TIMEOUT', 'TIMEOUT'].includes(targetTransaction.status)) {
        targetTransaction.status = 'FAILED';
        targetTransaction.failureReason = `Hold manually released by admin (${admin.name}): ${remarks}`;
      }
      await targetTransaction.save();
    } else {
      await RechargeTransaction.updateMany(
        { userId: retailer._id, reservedAmount: { $gt: 0 } },
        { $set: { reservedAmount: 0 } }
      );
    }

    await logAudit(
      admin,
      'RECHARGE_HOLD_RELEASED',
      'RETAILER',
      {
        previousHoldBalance: previousHoldPaise / 100,
        previousAvailableBalance: previousBalancePaise / 100,
      },
      {
        newHoldBalance: updatedWallet.onHoldPaise / 100,
        newAvailableBalance: updatedWallet.balancePaise / 100,
        releasedAmount: releaseAmountRupees,
        orderId: targetTransaction?.orderId || 'ALL_HOLDS',
        reason: remarks
      },
      req,
      retailer._id
    );

    return res.status(200).json({
      success: true,
      message: `Successfully released ₹${releaseAmountRupees.toFixed(2)} hold to retailer wallet.`,
      wallet: {
        balance: updatedWallet.balancePaise / 100,
        onHold: updatedWallet.onHoldPaise / 100
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRetailers,
  getRetailerById,
  updateRetailerStatus,
  updateRetailerAccountType,
  unlockRetailerAccount,
  updateRetailerProfile,
  deleteRetailer,
  resetRetailerSecurity,
  revokeRetailerSessions,
  releaseRetailerHold,
};
