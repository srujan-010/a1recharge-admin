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

/**
 * Compute 10-day activity status for a list of retailer userIds using server current time.
 * Purely read-only calculation, does NOT modify any account status or database records.
 * Checks Transaction, RechargeTransaction, and WalletLedger (excluding test data and initial 'Account Created').
 */
async function getRetailersActivityMap(userIds) {
  if (!userIds || userIds.length === 0) return {};

  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const [txnAgg, rechargeAgg, ledgerAgg] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          isTest: { $ne: true },
          referenceId: { $not: /^TEST/i }
        }
      },
      {
        $group: {
          _id: '$userId',
          lastActivityAt: { $max: '$createdAt' }
        }
      }
    ]),
    RechargeTransaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          isTest: { $ne: true },
          orderId: { $not: /^TEST/i }
        }
      },
      {
        $group: {
          _id: '$userId',
          lastActivityAt: { $max: '$createdAt' }
        }
      }
    ]),
    WalletLedger.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          $or: [
            { amount: { $gt: 0 } },
            { amountPaise: { $gt: 0 } }
          ],
          description: { $not: /Account Created/i },
          referenceId: { $not: /^TEST/i }
        }
      },
      {
        $group: {
          _id: '$userId',
          lastActivityAt: { $max: '$createdAt' }
        }
      }
    ])
  ]);

  const txnMap = txnAgg.reduce((acc, t) => { acc[t._id.toString()] = t.lastActivityAt; return acc; }, {});
  const rechargeMap = rechargeAgg.reduce((acc, r) => { acc[r._id.toString()] = r.lastActivityAt; return acc; }, {});
  const ledgerMap = ledgerAgg.reduce((acc, l) => { acc[l._id.toString()] = l.lastActivityAt; return acc; }, {});

  const resultMap = {};
  for (const uid of userIds) {
    const uidStr = uid.toString();
    const dates = [
      txnMap[uidStr],
      rechargeMap[uidStr],
      ledgerMap[uidStr]
    ].filter(Boolean).map(d => new Date(d));

    const lastActivityAt = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    const activityStatus = (lastActivityAt && lastActivityAt >= tenDaysAgo) ? 'ACTIVE' : 'INACTIVE';

    resultMap[uidStr] = {
      lastActivityAt,
      activityStatus
    };
  }

  return resultMap;
}

/**
 * Find userIds with valid transaction activity within the last 10 days.
 * Excludes test transactions and account creation records.
 */
async function getActiveRetailerUserIdsInLast10Days() {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const [activeTxnUserIds, activeRechargeUserIds, activeLedgerUserIds] = await Promise.all([
    Transaction.distinct('userId', {
      createdAt: { $gte: tenDaysAgo },
      isTest: { $ne: true },
      referenceId: { $not: /^TEST/i },
      userId: { $ne: null }
    }),
    RechargeTransaction.distinct('userId', {
      createdAt: { $gte: tenDaysAgo },
      isTest: { $ne: true },
      orderId: { $not: /^TEST/i },
      userId: { $ne: null }
    }),
    WalletLedger.distinct('userId', {
      createdAt: { $gte: tenDaysAgo },
      $or: [{ amount: { $gt: 0 } }, { amountPaise: { $gt: 0 } }],
      description: { $not: /Account Created/i },
      referenceId: { $not: /^TEST/i },
      userId: { $ne: null }
    })
  ]);

  const activeUserSet = new Set([
    ...activeTxnUserIds.map(id => id.toString()),
    ...activeRechargeUserIds.map(id => id.toString()),
    ...activeLedgerUserIds.map(id => id.toString())
  ]);

  return Array.from(activeUserSet).map(id => new mongoose.Types.ObjectId(id));
}

/**
 * Classifies wallet status strictly based on available balance:
 * - availableBalance < 0: NEGATIVE_BALANCE
 * - availableBalance === 0: ZERO_BALANCE
 * - availableBalance > 0 && availableBalance < 500: LOW_WALLET
 * - availableBalance >= 500: AVAILABLE
 */
function classifyWalletStatus(availableBalance) {
  const balance = Number(availableBalance ?? 0);
  if (balance < 0) {
    return 'NEGATIVE_BALANCE';
  }
  if (balance === 0) {
    return 'ZERO_BALANCE';
  }
  if (balance > 0 && balance < 500) {
    return 'LOW_WALLET';
  }
  return 'AVAILABLE';
}

/**
 * Calculates global summary statistics across ALL retailers
 * Completely independent of pagination, limit, or skip.
 */
async function calculateRetailersSummary() {
  const [allRetailers, activeUserIds] = await Promise.all([
    User.find({ role: 'retailer' })
      .select('_id status isLocked lockUntil kycStatus accountType shopName businessType gstNumber')
      .lean(),
    getActiveRetailerUserIdsInLast10Days()
  ]);

  const activeSet = new Set(activeUserIds.map(id => id.toString()));
  const allRetailerIds = allRetailers.map(r => r._id);
  const wallets = await Wallet.find({ userId: { $in: allRetailerIds } })
    .select('userId balancePaise onHoldPaise')
    .lean();
  const walletMap = new Map(wallets.map(w => [w.userId.toString(), w]));

  const now = new Date();
  let activeAccounts = 0;
  let locked = 0;
  let blocked = 0;
  let pendingKyc = 0;
  let activeActivity = 0;
  let inactiveActivity = 0;
  let zeroBalance = 0;
  let lowWallet = 0;
  let available = 0;
  let negativeBalance = 0;
  let totalWalletPaise = 0;

  const zeroBalanceUserIds = [];
  const lowWalletUserIds = [];
  const availableUserIds = [];
  const negativeBalanceUserIds = [];
  const activeAccountUserIds = [];
  const lockedUserIds = [];
  const blockedUserIds = [];
  const pendingKycUserIds = [];

  for (const r of allRetailers) {
    const isAccountLocked = Boolean(r.isLocked || (r.lockUntil && new Date(r.lockUntil) > now));
    const cleanStatus = r.status || 'active';
    const uidStr = r._id.toString();

    if (isAccountLocked) {
      locked++;
      lockedUserIds.push(r._id);
    }
    if (cleanStatus === 'blocked') {
      blocked++;
      blockedUserIds.push(r._id);
    }
    if ((cleanStatus === 'active' || !r.status) && !isAccountLocked) {
      activeAccounts++;
      activeAccountUserIds.push(r._id);
    }
    if (r.kycStatus === 'pending') {
      pendingKyc++;
      pendingKycUserIds.push(r._id);
    }

    const isActive = activeSet.has(uidStr);
    if (isActive) {
      activeActivity++;
    } else {
      inactiveActivity++;
    }

    let normAccountType = r.accountType;
    if (!normAccountType || !['PERSONAL', 'BUSINESS'].includes(normAccountType.toUpperCase())) {
      normAccountType = (r.shopName || r.businessType || r.gstNumber) ? 'BUSINESS' : 'PERSONAL';
    } else {
      normAccountType = normAccountType.toUpperCase();
    }

    if (normAccountType !== 'PERSONAL') {
      const w = walletMap.get(uidStr);
      const balancePaise = Number(w?.balancePaise || 0);
      const onHoldPaise = Number(w?.onHoldPaise || 0);
      const availPaise = balancePaise - onHoldPaise;
      const availRupees = Number((availPaise / 100).toFixed(2));
      const wStatus = classifyWalletStatus(availRupees);

      if (wStatus === 'ZERO_BALANCE') {
        zeroBalance++;
        zeroBalanceUserIds.push(r._id);
      } else if (wStatus === 'LOW_WALLET') {
        lowWallet++;
        lowWalletUserIds.push(r._id);
      } else if (wStatus === 'AVAILABLE') {
        available++;
        availableUserIds.push(r._id);
      } else if (wStatus === 'NEGATIVE_BALANCE') {
        negativeBalance++;
        negativeBalanceUserIds.push(r._id);
      }

      totalWalletPaise += availPaise;
    }
  }

  const summary = {
    totalRetailers: allRetailers.length,
    activeAccounts,
    activeActivity,
    inactiveActivity,
    locked,
    blocked,
    pendingKyc,
    zeroBalance,
    lowWallet,
    available,
    negativeBalance,
    totalWalletBalance: Number((totalWalletPaise / 100).toFixed(2))
  };

  const userGroups = {
    zeroBalanceUserIds,
    lowWalletUserIds,
    availableUserIds,
    negativeBalanceUserIds,
    activeAccountUserIds,
    lockedUserIds,
    blockedUserIds,
    pendingKycUserIds,
    activeActivityUserIds: activeUserIds
  };

  return { summary, userGroups };
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
    const activityStatus = req.query.activityStatus || '';
    const quickFilter = req.query.quickFilter || '';

    // 1. Calculate global summary across ALL retailers (completely independent of pagination)
    const { summary, userGroups } = await calculateRetailersSummary();

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
      if (status === 'active') {
        query.$or = [{ status: 'active' }, { status: { $exists: false } }, { status: null }];
      } else {
        query.status = status;
      }
    }

    if (activityStatus && activityStatus !== 'all') {
      if (activityStatus.toLowerCase() === 'active') {
        query._id = { $in: userGroups.activeActivityUserIds };
      } else if (activityStatus.toLowerCase() === 'inactive') {
        query._id = { $nin: userGroups.activeActivityUserIds };
      }
    }

    if (quickFilter && quickFilter !== 'All') {
      const qf = quickFilter.toLowerCase();
      if (qf === 'active accounts' || qf === 'active') {
        query._id = { $in: userGroups.activeAccountUserIds };
      } else if (qf === 'active activity') {
        query._id = { $in: userGroups.activeActivityUserIds };
      } else if (qf === 'inactive activity') {
        query._id = { $nin: userGroups.activeActivityUserIds };
      } else if (qf === 'locked') {
        query._id = { $in: userGroups.lockedUserIds };
      } else if (qf === 'pending kyc') {
        query._id = { $in: userGroups.pendingKycUserIds };
      } else if (qf === 'blocked') {
        query._id = { $in: userGroups.blockedUserIds };
      } else if (qf === 'zero balance') {
        query._id = { $in: userGroups.zeroBalanceUserIds };
      } else if (qf === 'low wallet') {
        query._id = { $in: userGroups.lowWalletUserIds };
      }
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
    
    // Map wallet balances and canonical wallet status to retailers
    const walletMap = wallets.reduce((acc, w) => {
      const balancePaise = Number(w.balancePaise || 0);
      const onHoldPaise = Number(w.onHoldPaise || 0);
      const availableBalancePaise = balancePaise - onHoldPaise;
      const availableBalance = Number((availableBalancePaise / 100).toFixed(2));
      const walletStatus = classifyWalletStatus(availableBalance);

      acc[w.userId.toString()] = {
        balancePaise,
        onHoldPaise,
        availableBalancePaise,
        availableBalance,
        walletStatus
      };
      return acc;
    }, {});

    // Compute activity status in parallel for retailers on this page
    const activityMap = await getRetailersActivityMap(userIds);

    const enrichedRetailers = retailers.map(r => {
      let normAccountType = r.accountType;
      if (!normAccountType || !['PERSONAL', 'BUSINESS'].includes(normAccountType.toUpperCase())) {
        normAccountType = (r.shopName || r.businessType || r.gstNumber) ? 'BUSINESS' : 'PERSONAL';
      } else {
        normAccountType = normAccountType.toUpperCase();
      }

      const uidStr = r._id.toString();
      const activityInfo = activityMap[uidStr] || { activityStatus: 'INACTIVE', lastActivityAt: null };
      const cleanStatus = r.status || 'active';
      const wInfo = walletMap[uidStr] || {
        balancePaise: 0,
        onHoldPaise: 0,
        availableBalancePaise: 0,
        availableBalance: 0,
        walletStatus: 'ZERO_BALANCE'
      };

      return {
        ...r,
        status: cleanStatus,
        accountStatus: cleanStatus.toUpperCase(),
        activityStatus: activityInfo.activityStatus,
        lastActivityAt: activityInfo.lastActivityAt,
        accountType: normAccountType,
        walletBalancePaise: wInfo.balancePaise,
        availableBalancePaise: wInfo.availableBalancePaise,
        availableBalance: wInfo.availableBalance,
        walletStatus: wInfo.walletStatus,
        todaysRechargePaise: statsMap[uidStr]?.todaysRechargePaise || 0,
        monthlyRechargePaise: statsMap[uidStr]?.monthlyRechargePaise || 0
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedRetailers,
      retailers: enrichedRetailers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit)
      },
      summary
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
            lifetimeCreditPaise: {
              $sum: {
                $cond: [
                  { $eq: ['$transactionType', 'CREDIT'] },
                  { $ifNull: ['$amountPaise', { $multiply: ['$amount', 100] }] },
                  0
                ]
              }
            },
            lifetimeDebitPaise: {
              $sum: {
                $cond: [
                  { $eq: ['$transactionType', 'DEBIT'] },
                  { $ifNull: ['$amountPaise', { $multiply: ['$amount', 100] }] },
                  0
                ]
              }
            },
            todaysCreditPaise: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$transactionType', 'CREDIT'] },
                      { $gte: ['$createdAt', startOfToday] }
                    ]
                  },
                  { $ifNull: ['$amountPaise', { $multiply: ['$amount', 100] }] },
                  0
                ]
              }
            },
            todaysDebitPaise: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$transactionType', 'DEBIT'] },
                      { $gte: ['$createdAt', startOfToday] }
                    ]
                  },
                  { $ifNull: ['$amountPaise', { $multiply: ['$amount', 100] }] },
                  0
                ]
              }
            }
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

    const activityInfo = (await getRetailersActivityMap([retailer._id]))[retailer._id.toString()] || {
      activityStatus: 'INACTIVE',
      lastActivityAt: null
    };
    const cleanStatus = retailer.status || 'active';

    const walletDoc = wallet || { balancePaise: 0, onHoldPaise: 0, updatedAt: new Date() };
    const wBalancePaise = Number(walletDoc.balancePaise || 0);
    const wOnHoldPaise = Number(walletDoc.onHoldPaise || 0);
    const wAvailPaise = wBalancePaise - wOnHoldPaise;
    const wAvailableBalance = Number((wAvailPaise / 100).toFixed(2));
    const wWalletStatus = classifyWalletStatus(wAvailableBalance);

    res.status(200).json({
      success: true,
      data: {
        ...retailer,
        status: cleanStatus,
        accountStatus: cleanStatus.toUpperCase(),
        activityStatus: activityInfo.activityStatus,
        lastActivityAt: activityInfo.lastActivityAt,
        availableBalance: wAvailableBalance,
        walletStatus: wWalletStatus,
        accountType: (retailer.accountType && ['PERSONAL', 'BUSINESS'].includes(retailer.accountType.toUpperCase()))
          ? retailer.accountType.toUpperCase()
          : ((retailer.shopName || retailer.businessType || retailer.gstNumber) ? 'BUSINESS' : 'PERSONAL'),
        wallet: {
          ...walletDoc,
          availableBalancePaise: wAvailPaise,
          availableBalance: wAvailableBalance,
          walletStatus: wWalletStatus
        },
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
          lifetimeCreditPaise: led.lifetimeCreditPaise || 0,
          lifetimeDebitPaise: led.lifetimeDebitPaise || 0,
          todaysCreditPaise: led.todaysCreditPaise || 0,
          todaysDebitPaise: led.todaysDebitPaise || 0,
          lifetimeCredit: Number(((led.lifetimeCreditPaise || 0) / 100).toFixed(2)),
          lifetimeDebit: Number(((led.lifetimeDebitPaise || 0) / 100).toFixed(2)),
          todaysCredit: Number(((led.todaysCreditPaise || 0) / 100).toFixed(2)),
          todaysDebit: Number(((led.todaysDebitPaise || 0) / 100).toFixed(2))
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
  classifyWalletStatus,
  calculateRetailersSummary,
};
