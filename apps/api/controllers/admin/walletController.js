const WalletLedger = require('../../models/WalletLedger');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const ManualPayment = require('../../models/ManualPayment');
const walletService = require('../../services/wallet/wallet.service');
const NotificationService = require('../../services/notification.service');
const { logAudit } = require('../../utils/auditHelper');
const mongoose = require('mongoose');

/**
 * Helper to generate a unique Manual Payment Reference ID (e.g. MP202609090001)
 */
const generatePaymentRefId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `MP${dateStr}`;
  const count = await ManualPayment.countDocuments({
    paymentId: new RegExp(`^${prefix}`)
  });
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${String(count + 1).padStart(3, '0')}_${randomSuffix}`;
};

// @desc    Get global wallet ledger (Paginated & Searchable)
// @route   GET /api/admin/wallets/ledger
// @access  Private (Admin)
const getGlobalLedger = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = {};

    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or = [
          { userId: search },
          { referenceId: search }
        ];
      } else {
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

// @desc    Manually Adjust Wallet (Single Atomic Credit/Debit + Automatic Payment Linking)
// @route   POST /api/admin/wallets/:userId/adjust
// @access  Private (Super Admin / Finance)
const manualCreditDebit = async (req, res, next) => {
  try {
    const {
      type,
      amountPaise,
      amount,
      reason,
      paymentMethod = 'UPI',
      paymentStatus = 'PAID',
      referenceId: customRef
    } = req.body;
    const { userId } = req.params;

    const normType = String(type || '').toLowerCase();
    if (!['credit', 'debit'].includes(normType)) {
      res.status(400);
      throw new Error('Invalid adjustment type. Must be credit or debit.');
    }

    // Money calculation (Integer paise integer minor units)
    let parsedPaise = 0;
    if (amountPaise !== undefined && amountPaise !== null) {
      parsedPaise = Math.round(Number(amountPaise));
    } else if (amount !== undefined && amount !== null) {
      parsedPaise = Math.round(Number(amount) * 100);
    }

    if (!Number.isFinite(parsedPaise) || parsedPaise <= 0) {
      res.status(400);
      throw new Error('Amount must be greater than 0.');
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      res.status(400);
      throw new Error('A valid reason is required for manual adjustments.');
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
    const canonicalPaymentStatus = ['PAID', 'UNPAID'].includes(String(paymentStatus).toUpperCase())
      ? String(paymentStatus).toUpperCase()
      : 'PAID';

    // Canonical Payment Method logic (UNPAID does NOT require payment method)
    const validMethods = ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'];
    const passedMethod = paymentMethod ? String(paymentMethod).toUpperCase() : '';
    let canonicalMethod = 'NOT_SET';

    if (canonicalPaymentStatus === 'PAID') {
      if (validMethods.includes(passedMethod)) {
        canonicalMethod = passedMethod;
      } else {
        res.status(400);
        throw new Error('Please select a payment method for a paid payment.');
      }
    } else {
      // UNPAID status: optional payment method
      if (validMethods.includes(passedMethod)) {
        canonicalMethod = passedMethod;
      } else {
        canonicalMethod = 'NOT_SET';
      }
    }

    // Unique Reference ID (e.g. MP20260909001_4628 or custom UTR)
    const idempotencyKey = req.headers['idempotency-key'] || customRef;
    const refId = idempotencyKey ? String(idempotencyKey) : await generatePaymentRefId();

    // Idempotency check: if transaction already exists, return existing record
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

    // Atomic Wallet Mutation
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
    const description = isCredit ? `Manual Wallet Credit: ${trimmedReason}` : `Manual Wallet Debit: ${trimmedReason}`;

    // 1. WalletLedger entry
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

    // 2. Transaction Record for Global Transactions & Retailer Statement
    const rawAcc = retailer.accountType ? retailer.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const transaction = await Transaction.create({
      userId,
      accountType: userAccountType,
      type: isCredit ? 'credit' : 'debit',
      amountPaise: parsedPaise,
      closingBalancePaise: newBalancePaise,
      status: 'success',
      service: isCredit ? 'manual_wallet_topup' : 'manual_debit',
      transactionType: isCredit ? 'MANUAL_TOPUP' : 'ADMIN_DEBIT',
      paymentMethod: canonicalMethod,
      paymentStatus: canonicalPaymentStatus,
      source: 'ADMIN',
      performedBy: adminName,
      adminId,
      adminName,
      reason: trimmedReason,
      description,
      referenceId: refId,
      upiDetails: {
        utr: refId,
        gateway: `Admin ${canonicalMethod}`
      },
      isTest: false
    });

    // 3. Create Linked ManualPayment Document if it was a Credit
    let manualPayment = null;
    if (isCredit) {
      manualPayment = await ManualPayment.create({
        paymentId: refId,
        retailerId: retailer._id,
        retailerName: retailer.name || retailer.shopName || 'Retailer',
        retailerPhone: retailer.phone,
        amountPaise: parsedPaise,
        amount: amountRupees,
        paymentMethod: canonicalMethod,
        paymentStatus: canonicalPaymentStatus,
        walletStatus: 'CREDITED',
        status: canonicalPaymentStatus === 'PAID' ? 'VERIFIED' : 'PENDING',
        paymentDate: new Date(),
        walletCredited: true,
        walletCreditedAt: new Date(),
        walletCreditedBy: adminId,
        walletCreditedByName: adminName,
        walletTransactionId: transaction._id,
        walletLedgerId: ledger._id,
        createdBy: adminId,
        createdByName: adminName,
        verifiedAt: canonicalPaymentStatus === 'PAID' ? new Date() : null,
        verifiedBy: canonicalPaymentStatus === 'PAID' ? adminId : null,
        verifiedByName: canonicalPaymentStatus === 'PAID' ? adminName : null,
        notes: trimmedReason,
        previousBalancePaise,
        closingBalancePaise: newBalancePaise
      });
    }

    // 4. Notification to retailer
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

    // 5. Audit Log
    await logAudit(
      req.admin, 
      isCredit ? `ADMIN_WALLET_CREDIT_CREATED` : `WALLET_ADJUSTMENT`, 
      'WALLET', 
      null, 
      { userId, type: normType, amountPaise: parsedPaise, paymentMethod: canonicalMethod, paymentStatus: canonicalPaymentStatus, reason: trimmedReason, referenceId: refId, adminName }, 
      req,
      manualPayment?._id || transaction._id
    );

    res.status(200).json({
      success: true,
      message: `Successfully applied manual ${normType} of ₹${amountRupees.toFixed(2)} to ${retailer.name}.`,
      data: {
        referenceId: refId,
        transactionId: transaction._id,
        ledgerId: ledger._id,
        manualPaymentId: manualPayment?._id,
        paymentMethod: canonicalMethod,
        paymentStatus: canonicalPaymentStatus,
        newBalanceRupees,
        newBalancePaise
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Payment Status (PAID <-> UNPAID) - Does NOT touch wallet balance (Requirement 6 & 12)
// @route   POST /api/admin/wallets/transactions/:id/payment-status
// @access  Private (Super Admin / Finance)
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    const { id } = req.params;

    const normStatus = String(paymentStatus || '').toUpperCase();
    if (!['PAID', 'UNPAID'].includes(normStatus)) {
      res.status(400);
      throw new Error('Invalid payment status. Allowed: PAID, UNPAID.');
    }

    // Find transaction by ID or referenceId
    let transaction = await Transaction.findById(id);
    if (!transaction) {
      transaction = await Transaction.findOne({ referenceId: id });
    }

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found.');
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const oldStatus = transaction.paymentStatus || 'NOT_SET';

    const validMethods = ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'];
    const passedMethod = req.body.paymentMethod ? String(req.body.paymentMethod).toUpperCase() : '';

    if (normStatus === 'PAID') {
      if (passedMethod && validMethods.includes(passedMethod)) {
        transaction.paymentMethod = passedMethod;
      } else if (!transaction.paymentMethod || transaction.paymentMethod === 'NOT_SET') {
        res.status(400);
        throw new Error('Please select a payment method for a paid payment.');
      }
    }

    // 1. Update Transaction
    transaction.paymentStatus = normStatus;
    await transaction.save();

    // 2. Update WalletLedger
    await WalletLedger.updateMany(
      { referenceId: transaction.referenceId },
      { $set: { paymentStatus: normStatus, paymentMethod: transaction.paymentMethod } }
    );

    // 3. Update ManualPayment record
    const manualPayment = await ManualPayment.findOneAndUpdate(
      { $or: [{ walletTransactionId: transaction._id }, { paymentId: transaction.referenceId }] },
      {
        $set: {
          paymentStatus: normStatus,
          paymentMethod: transaction.paymentMethod,
          status: normStatus === 'PAID' ? 'VERIFIED' : 'PENDING',
          updatedBy: adminUser._id,
          updatedByName: adminName
        }
      },
      { new: true }
    );

    // 4. Audit Log (Requirement 23)
    await logAudit(
      adminUser,
      'PAYMENT_STATUS_CHANGED',
      'MANUAL_PAYMENT',
      { previousStatus: oldStatus },
      { newStatus: normStatus, referenceId: transaction.referenceId, transactionId: transaction._id },
      req,
      transaction._id
    );

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${normStatus}. Wallet balance remains unchanged.`,
      data: {
        transactionId: transaction._id,
        paymentStatus: normStatus,
        manualPayment
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Payment Method (UPI / CASH / BANK_TRANSFER / OTHER) (Requirement 12)
// @route   POST /api/admin/wallets/transactions/:id/payment-method
// @access  Private (Super Admin / Finance)
const updatePaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body;
    const { id } = req.params;

    const validMethods = ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'];
    const normMethod = String(paymentMethod || '').toUpperCase();
    if (!validMethods.includes(normMethod)) {
      res.status(400);
      throw new Error(`Invalid payment method. Allowed: ${validMethods.join(', ')}`);
    }

    let transaction = await Transaction.findById(id);
    if (!transaction) {
      transaction = await Transaction.findOne({ referenceId: id });
    }

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found.');
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const oldMethod = transaction.paymentMethod || 'NOT_SET';

    transaction.paymentMethod = normMethod;
    await transaction.save();

    await WalletLedger.updateMany(
      { referenceId: transaction.referenceId },
      { $set: { paymentMethod: normMethod } }
    );

    const manualPayment = await ManualPayment.findOneAndUpdate(
      { $or: [{ walletTransactionId: transaction._id }, { paymentId: transaction.referenceId }] },
      {
        $set: {
          paymentMethod: normMethod,
          updatedBy: adminUser._id,
          updatedByName: adminName
        }
      },
      { new: true }
    );

    await logAudit(
      adminUser,
      'PAYMENT_METHOD_CHANGED',
      'MANUAL_PAYMENT',
      { previousMethod: oldMethod },
      { newMethod: normMethod, referenceId: transaction.referenceId, transactionId: transaction._id },
      req,
      transaction._id
    );

    res.status(200).json({
      success: true,
      message: `Payment method updated to ${normMethod}.`,
      data: {
        transactionId: transaction._id,
        paymentMethod: normMethod,
        manualPayment
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reverse Wallet Credit (Requirement 7)
// @route   POST /api/admin/wallets/transactions/:id/reverse
// @access  Private (Super Admin / Finance)
const reverseWalletCredit = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { id } = req.params;

    if (!reason || reason.trim().length < 3) {
      res.status(400);
      throw new Error('A valid reason (min 3 chars) is required for credit reversal.');
    }

    let transaction = await Transaction.findById(id);
    if (!transaction) {
      transaction = await Transaction.findOne({ referenceId: id });
    }

    if (!transaction) {
      res.status(404);
      throw new Error('Original credit transaction not found.');
    }

    if (transaction.type !== 'credit') {
      res.status(400);
      throw new Error('Only credit transactions can be reversed.');
    }

    if (transaction.status === 'reversed' || transaction.walletStatus === 'REVERSED') {
      res.status(400);
      throw new Error('This credit transaction has already been reversed.');
    }

    const retailer = await User.findById(transaction.userId);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found.');
    }

    let wallet = await Wallet.findOne({ userId: retailer._id });
    if (!wallet) {
      res.status(400);
      throw new Error('Retailer wallet not found.');
    }

    const amountPaise = transaction.amountPaise;
    const amountRupees = Number((amountPaise / 100).toFixed(2));

    if (wallet.balancePaise < amountPaise) {
      res.status(400);
      throw new Error(`Insufficient wallet balance to perform reversal. Current: ₹${(wallet.balancePaise/100).toFixed(2)}, Reversal Required: ₹${amountRupees.toFixed(2)}`);
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const previousBalancePaise = Math.round(wallet.balancePaise || 0);

    // Atomic debit
    wallet.balancePaise = previousBalancePaise - amountPaise;
    await wallet.save();

    const newBalancePaise = Math.round(wallet.balancePaise);
    const newBalanceRupees = Number((newBalancePaise / 100).toFixed(2));
    const prevBalanceRupees = Number((previousBalancePaise / 100).toFixed(2));
    const revRefId = `REV_${transaction.referenceId}_${Date.now()}`;
    const description = `MANUAL WALLET CREDIT REVERSAL (${transaction.referenceId}): ${reason.trim()}`;

    // Reversal Ledger Record
    const ledger = await WalletLedger.create({
      userId: retailer._id,
      adminId: adminUser._id,
      adminName,
      transactionType: 'DEBIT',
      amountPaise,
      previousBalancePaise,
      balanceAfterPaise: newBalancePaise,
      amount: amountRupees,
      previousBalance: prevBalanceRupees,
      balanceAfter: newBalanceRupees,
      referenceType: 'MANUAL',
      referenceId: revRefId,
      remark: 'ADMIN_WALLET_CREDIT_REVERSED',
      description
    });

    // Reversal Transaction Record
    const rawAcc = retailer.accountType ? retailer.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const reversalTxn = await Transaction.create({
      userId: retailer._id,
      accountType: userAccountType,
      type: 'debit',
      amountPaise,
      closingBalancePaise: newBalancePaise,
      status: 'success',
      service: 'manual_wallet_reversal',
      transactionType: 'MANUAL_REVERSAL',
      paymentMethod: transaction.paymentMethod || 'ADMIN',
      paymentStatus: transaction.paymentStatus || 'PAID',
      source: 'ADMIN',
      performedBy: adminName,
      adminId: adminUser._id,
      adminName,
      reason: reason.trim(),
      description,
      referenceId: revRefId,
      isTest: false
    });

    // Mark original transaction & manual payment as REVERSED
    transaction.status = 'reversed';
    transaction.walletStatus = 'REVERSED';
    await transaction.save();

    const manualPayment = await ManualPayment.findOneAndUpdate(
      { $or: [{ walletTransactionId: transaction._id }, { paymentId: transaction.referenceId }] },
      {
        $set: {
          walletStatus: 'REVERSED',
          isReversed: true,
          reversedAt: new Date(),
          reversedBy: adminUser._id,
          reversedByName: adminName,
          reversalReason: reason.trim(),
          reversalTransactionId: reversalTxn._id,
          reversalLedgerId: ledger._id
        }
      },
      { new: true }
    );

    // Audit Log (Requirement 23)
    await logAudit(
      adminUser,
      'ADMIN_WALLET_CREDIT_REVERSED',
      'MANUAL_PAYMENT',
      { originalTransactionId: transaction._id, originalReference: transaction.referenceId },
      { reversalTransactionId: reversalTxn._id, amountRupees, newBalanceRupees, reason: reason.trim() },
      req,
      transaction._id
    );

    res.status(200).json({
      success: true,
      message: `Successfully reversed wallet credit of ₹${amountRupees.toFixed(2)} for ${transaction.referenceId}.`,
      data: {
        originalTransactionId: transaction._id,
        reversalTransactionId: reversalTxn._id,
        newBalanceRupees
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGlobalLedger,
  manualCreditDebit,
  updatePaymentStatus,
  updatePaymentMethod,
  reverseWalletCredit
};
