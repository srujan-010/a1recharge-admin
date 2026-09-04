const WalletLedger = require('../../models/WalletLedger');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const walletService = require('../../services/wallet/wallet.service');
const NotificationService = require('../../services/notification.service');
const { logAudit } = require('../../utils/auditHelper');
const mongoose = require('mongoose');

// @desc    Get global wallet ledger (Paginated & Searchable)
// @route   GET /api/admin/wallets/ledger
// @access  Private (Admin)
const getGlobalLedger = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || ''; // Could search by Retailer ID or reference ID

    const query = {};

    if (search) {
      // If the search is a valid ObjectId, search by userId or referenceId
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or = [
          { userId: search },
          { referenceId: search }
        ];
      } else {
        // Find users matching search term to get their ObjectIds
        const users = await User.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { retailerId: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        const userIds = users.map(u => u._id);
        
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        } else {
          // If search doesn't match any user and isn't an ObjectId, return empty
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, pages: 0 }
          });
        }
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await WalletLedger.countDocuments(query);
    
    // Fetch ledger entries and populate user details
    const ledger = await WalletLedger.find(query)
      .populate('userId', 'name retailerId phone')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: ledger,
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

// @desc    Manually Adjust Wallet (Credit or Debit)
// @route   POST /api/admin/wallets/:userId/adjust
// @access  Private (Super Admin / Finance)
const manualCreditDebit = async (req, res, next) => {
  try {
    const { type, amountPaise, reason } = req.body;
    const { userId } = req.params;

    const normType = String(type || '').toLowerCase();
    if (!['credit', 'debit'].includes(normType)) {
      res.status(400);
      throw new Error('Invalid adjustment type. Must be credit or debit.');
    }

    const parsedPaise = Math.round(Number(amountPaise));
    if (!Number.isFinite(parsedPaise) || parsedPaise <= 0) {
      res.status(400);
      throw new Error('Amount must be greater than 0 paise.');
    }

    if (!reason || reason.trim().length < 5) {
      res.status(400);
      throw new Error('A valid reason (min 5 chars) is required for manual adjustments.');
    }

    const retailer = await User.findById(userId);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const adminId = adminUser?._id || null;
    const isCredit = normType === 'credit';
    const amountRupees = Number((parsedPaise / 100).toFixed(2));
    const trimmedReason = reason.trim();

    // Idempotency: use header key or generate unique reference
    const idempotencyKey = req.headers['idempotency-key'] || req.body.referenceId;
    const refId = idempotencyKey ? String(idempotencyKey) : `ADM_${normType.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Check if this referenceId was already processed
    const existingTxn = await Transaction.findOne({ referenceId: refId });
    if (existingTxn) {
      const currentWallet = await Wallet.findOne({ userId });
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: `Adjustment request already processed (idempotent response).`,
        data: {
          referenceId: refId,
          transaction: existingTxn,
          newBalanceRupees: Number(((currentWallet ? currentWallet.balancePaise : 0) / 100).toFixed(2))
        }
      });
    }

    // Atomic Wallet Mutation with balance validation for debits
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balancePaise: 0, onHoldPaise: 0 });
    }

    const previousBalancePaise = Math.round(wallet.balancePaise || 0);

    if (isCredit) {
      wallet.balancePaise = previousBalancePaise + parsedPaise;
    } else {
      if (previousBalancePaise < parsedPaise) {
        res.status(400);
        throw new Error(`Insufficient wallet balance for manual debit. Current: ₹${(previousBalancePaise / 100).toFixed(2)}, Requested Debit: ₹${amountRupees.toFixed(2)}`);
      }
      wallet.balancePaise = previousBalancePaise - parsedPaise;
    }

    await wallet.save();

    const newBalancePaise = Math.round(wallet.balancePaise);
    const newBalanceRupees = Number((newBalancePaise / 100).toFixed(2));
    const prevBalanceRupees = Number((previousBalancePaise / 100).toFixed(2));
    const description = `Manual ${isCredit ? 'Credit' : 'Debit'}: ${trimmedReason}`;

    // 1. Authoritative WalletLedger entry
    const ledger = await WalletLedger.create({
      userId,
      adminId,
      adminName,
      transactionType: isCredit ? 'CREDIT' : 'DEBIT',
      amountPaise: parsedPaise,
      previousBalancePaise,
      balanceAfterPaise: newBalancePaise,
      amount: amountRupees,
      previousBalance: prevBalanceRupees,
      balanceAfter: newBalanceRupees,
      referenceType: isCredit ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      referenceId: refId,
      remark: trimmedReason,
      description
    });

    // 2. Authoritative Transaction record for Global Transactions & Retailer Statement
    const rawAcc = retailer.accountType ? retailer.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const transaction = await Transaction.create({
      userId,
      accountType: userAccountType,
      type: isCredit ? 'credit' : 'debit',
      amountPaise: parsedPaise,
      closingBalancePaise: newBalancePaise,
      status: 'success',
      service: isCredit ? 'admin_credit' : 'admin_debit',
      transactionType: isCredit ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      paymentMethod: 'ADMIN',
      paymentStatus: 'SUCCESS',
      source: 'ADMIN',
      performedBy: adminName,
      adminId,
      adminName,
      reason: trimmedReason,
      description,
      referenceId: refId,
      isTest: false
    });

    // 3. Notification to retailer
    try {
      if (isCredit) {
        NotificationService.sendWalletCredited({
          userId,
          amount: amountRupees,
          newBalance: newBalanceRupees,
          reason: description,
          referenceId: refId
        });
      } else {
        NotificationService.sendWalletDebited({
          userId,
          amount: amountRupees,
          newBalance: newBalanceRupees,
          reason: description,
          referenceId: refId
        });
      }
    } catch (err) {
      console.error('[WALLET NOTIFICATION ERROR]', err);
    }

    // 4. Audit Log this critical action
    await logAudit(
      req.admin, 
      `WALLET_ADJUSTMENT`, 
      'WALLET', 
      null, 
      { userId, type: normType, amountPaise: parsedPaise, reason: trimmedReason, referenceId: refId, adminName }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `Successfully applied manual ${normType} of ₹${amountRupees.toFixed(2)} to ${retailer.name}.`,
      data: {
        referenceId: refId,
        transactionId: transaction._id,
        ledgerId: ledger._id,
        newBalanceRupees,
        newBalancePaise
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGlobalLedger,
  manualCreditDebit
};
