const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const { normalizeIndianPhone } = require('../utils/phoneNormalizer');

/**
 * Standard exclusion query for test retailers across the admin portal.
 */
const TEST_RETAILER_QUERY_EXCLUSION = {
  isTest: { $ne: true },
  name: { $not: /test/i },
  email: { $not: /test/i },
  retailerId: { $not: /^RET98888|^RET123456|^TEST/i },
  phone: { $nin: ['9888877777', '9999999999', '9999000000'] }
};

/**
 * Find userIds with valid transaction activity within the last 10 days.
 * Excludes test transactions and initial account creation ledger entries.
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
 * Classifies wallet status strictly based on available balance in Rupees:
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
 * Calculates global summary statistics across ALL non-test retailers in database.
 * Completely independent of UI pagination limits.
 */
async function calculateRetailersSummaryAndGroups() {
  const [allRetailers, activeUserIds] = await Promise.all([
    User.find({
      role: 'retailer',
      ...TEST_RETAILER_QUERY_EXCLUSION
    })
      .select('_id retailerId name phone email shopName city state status isLocked lockUntil kycStatus accountType notificationEnabled')
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
    const cleanStatus = (r.status || 'active').toLowerCase();
    const uidStr = r._id.toString();

    if (isAccountLocked) {
      locked++;
      lockedUserIds.push(r._id);
    }
    if (cleanStatus === 'blocked') {
      blocked++;
      blockedUserIds.push(r._id);
    }
    if ((cleanStatus === 'active' || cleanStatus === '') && !isAccountLocked) {
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

  return { summary, userGroups, allRetailers, walletMap, activeSet };
}

/**
 * Returns audience recipients for Fast2SMS targeting.
 * Handles all 11 audience modes & targeted segment sub-filters.
 */
async function getSegmentRetailers(targetAudience = 'ALL', filters = {}) {
  const { summary, userGroups, allRetailers, walletMap, activeSet } = await calculateRetailersSummaryAndGroups();
  const now = new Date();

  let targetRetailers = [];

  const audUpper = (targetAudience || 'ALL').toUpperCase();

  switch (audUpper) {
    case 'ALL':
      targetRetailers = allRetailers;
      break;

    case 'ACTIVE_ACCOUNTS':
    case 'ACTIVE':
      {
        const idSet = new Set(userGroups.activeAccountUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'ACTIVE_ACTIVITY':
      {
        const idSet = new Set(userGroups.activeActivityUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'INACTIVE_ACTIVITY':
      {
        const activeIdSet = new Set(userGroups.activeActivityUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => !activeIdSet.has(r._id.toString()));
      }
      break;

    case 'PENDING_KYC':
      {
        const idSet = new Set(userGroups.pendingKycUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'ZERO_BALANCE':
      {
        const idSet = new Set(userGroups.zeroBalanceUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'LOW_WALLET':
      {
        const idSet = new Set(userGroups.lowWalletUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'BLOCKED':
      {
        const idSet = new Set(userGroups.blockedUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'LOCKED':
      {
        const idSet = new Set(userGroups.lockedUserIds.map(id => id.toString()));
        targetRetailers = allRetailers.filter(r => idSet.has(r._id.toString()));
      }
      break;

    case 'TARGETED_SEGMENT':
    case 'MULTIPLE':
      {
        const {
          accountType = 'ALL',
          accountStatus = 'ALL',
          activity = 'ALL',
          wallet = 'ALL',
          kyc = 'ALL',
          state,
          district
        } = filters;

        targetRetailers = allRetailers.filter(r => {
          const uidStr = r._id.toString();
          const isLocked = Boolean(r.isLocked || (r.lockUntil && new Date(r.lockUntil) > now));
          const cleanStatus = (r.status || 'active').toLowerCase();
          const w = walletMap.get(uidStr);
          const balancePaise = Number(w?.balancePaise || 0);
          const onHoldPaise = Number(w?.onHoldPaise || 0);
          const availRupees = Number(((balancePaise - onHoldPaise) / 100).toFixed(2));
          const isActiveActivity = activeSet.has(uidStr);

          // 1. Account Type
          if (accountType && accountType !== 'ALL') {
            const userAccType = (r.accountType || 'PERSONAL').toUpperCase();
            if (userAccType !== accountType.toUpperCase()) return false;
          }

          // 2. Account Status
          if (accountStatus && accountStatus !== 'ALL') {
            const accStatUpper = accountStatus.toUpperCase();
            if (accStatUpper === 'ACTIVE' && (cleanStatus === 'blocked' || isLocked)) return false;
            if (accStatUpper === 'BLOCKED' && cleanStatus !== 'blocked') return false;
            if (accStatUpper === 'LOCKED' && !isLocked) return false;
          }

          // 3. Activity
          if (activity && activity !== 'ALL') {
            const actUpper = activity.toUpperCase();
            if ((actUpper === 'ACTIVE_10_DAYS' || actUpper === 'ACTIVE') && !isActiveActivity) return false;
            if (actUpper === 'INACTIVE' && isActiveActivity) return false;
          }

          // 4. Wallet
          if (wallet && wallet !== 'ALL') {
            const wallUpper = wallet.toUpperCase();
            if (wallUpper === 'ZERO_BALANCE' && availRupees !== 0) return false;
            if (wallUpper === 'LOW_WALLET' && !(availRupees > 0 && availRupees < 500)) return false;
            if (wallUpper === 'HEALTHY' && !(availRupees >= 500)) return false;
          }

          // 5. KYC Status
          if (kyc && kyc !== 'ALL') {
            const kycUpper = kyc.toUpperCase();
            const rKyc = (r.kycStatus || 'notStarted').toLowerCase();
            if (kycUpper === 'COMPLETED' && rKyc !== 'verified') return false;
            if (kycUpper === 'PENDING' && rKyc !== 'pending') return false;
            if (kycUpper === 'NOT_STARTED' && (rKyc === 'verified' || rKyc === 'pending')) return false;
          }

          // State / District (City) optional subfilters
          if (state && r.state && !r.state.toLowerCase().includes(state.toLowerCase())) return false;
          if (district && r.city && !r.city.toLowerCase().includes(district.toLowerCase())) return false;

          return true;
        });
      }
      break;

    case 'SINGLE':
      {
        const { singleRetailerId, targetMobile } = filters;
        if (singleRetailerId) {
          targetRetailers = allRetailers.filter(r => r._id.toString() === singleRetailerId || r.retailerId === singleRetailerId);
        } else if (targetMobile) {
          const normTarget = normalizeIndianPhone(targetMobile);
          targetRetailers = allRetailers.filter(r => {
            const normUser = normalizeIndianPhone(r.phone);
            return normUser === normTarget || r.phone === targetMobile;
          });

          // Fallback if custom non-registered number entered
          if (targetRetailers.length === 0) {
            const normCustom = normalizeIndianPhone(targetMobile);
            return {
              totalCount: 1,
              eligibleCount: normCustom ? 1 : 0,
              skippedCount: normCustom ? 0 : 1,
              skippedNoPhone: 0,
              skippedInvalid: normCustom ? 0 : 1,
              eligibleNumbers: normCustom ? [normCustom] : [],
              recipients: [{
                _id: 'CUSTOM',
                retailerId: 'CUSTOM',
                name: 'Single Retailer',
                phone: targetMobile,
                normalizedPhone: normCustom,
                accountType: 'PERSONAL',
                shopName: '',
                walletBalance: 0,
                activityStatus: 'INACTIVE',
                accountStatus: 'ACTIVE',
                kycStatus: 'notStarted',
                isEligible: !!normCustom,
                skipReason: normCustom ? null : 'Invalid 10-digit mobile number format'
              }],
              summary
            };
          }
        }
      }
      break;

    default:
      targetRetailers = allRetailers;
      break;
  }

  // Build processed recipient details & eligibility breakdown
  let eligibleCount = 0;
  let skippedNoPhone = 0;
  let skippedInvalid = 0;
  const eligibleNumbersSet = new Set();

  const recipientList = targetRetailers.map(r => {
    const uidStr = r._id.toString();
    const w = walletMap.get(uidStr);
    const balancePaise = Number(w?.balancePaise || 0);
    const onHoldPaise = Number(w?.onHoldPaise || 0);
    const availRupees = Number(((balancePaise - onHoldPaise) / 100).toFixed(2));

    const isLocked = Boolean(r.isLocked || (r.lockUntil && new Date(r.lockUntil) > now));
    const cleanStatus = (r.status || 'active').toLowerCase();
    
    let accountStatusLabel = 'ACTIVE';
    if (isLocked) accountStatusLabel = 'LOCKED';
    else if (cleanStatus === 'blocked') accountStatusLabel = 'BLOCKED';

    const activityStatusLabel = activeSet.has(uidStr) ? 'ACTIVE' : 'INACTIVE';

    const phoneRaw = r.phone || r.mobile;
    let isEligible = true;
    let skipReason = null;

    if (!phoneRaw) {
      isEligible = false;
      skipReason = 'Missing mobile number';
      skippedNoPhone++;
    } else {
      const normalized = normalizeIndianPhone(phoneRaw);
      if (!normalized) {
        isEligible = false;
        skipReason = 'Invalid mobile number format';
        skippedInvalid++;
      } else {
        if (r.notificationEnabled === false) {
          isEligible = false;
          skipReason = 'Communication disabled by user';
          skippedInvalid++;
        } else {
          eligibleCount++;
          eligibleNumbersSet.add(normalized);
        }
      }
    }

    const normalizedPhone = normalizeIndianPhone(phoneRaw) || phoneRaw;

    return {
      _id: r._id,
      retailerId: r.retailerId,
      name: r.name,
      phone: phoneRaw,
      normalizedPhone,
      accountType: r.accountType || 'PERSONAL',
      shopName: r.shopName || '',
      city: r.city || '',
      state: r.state || '',
      walletBalance: availRupees,
      activityStatus: activityStatusLabel,
      accountStatus: accountStatusLabel,
      kycStatus: r.kycStatus || 'notStarted',
      isEligible,
      skipReason
    };
  });

  return {
    totalCount: recipientList.length,
    eligibleCount,
    skippedCount: recipientList.length - eligibleCount,
    skippedNoPhone,
    skippedInvalid,
    eligibleNumbers: Array.from(eligibleNumbersSet),
    recipients: recipientList,
    summary
  };
}

module.exports = {
  TEST_RETAILER_QUERY_EXCLUSION,
  getActiveRetailerUserIdsInLast10Days,
  classifyWalletStatus,
  calculateRetailersSummaryAndGroups,
  getSegmentRetailers
};
