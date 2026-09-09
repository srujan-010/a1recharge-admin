const ManualPayment = require('../../models/ManualPayment');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');
const Transaction = require('../../models/Transaction');
const NotificationService = require('../../services/notification.service');
const { logAudit } = require('../../utils/auditHelper');
const mongoose = require('mongoose');

/**
 * Generate a unique Manual Payment ID (e.g. MP202609090001)
 */
const generatePaymentId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `MP${dateStr}`;
  const count = await ManualPayment.countDocuments({
    paymentId: new RegExp(`^${prefix}`)
  });
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${String(count + 1).padStart(3, '0')}_${randomSuffix}`;
};

// @desc    Get Manual Payments (Paginated & Filterable)
// @route   GET /api/admin/manual-payments
// @access  Private (Admin / Finance / Support)
const getManualPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const {
      search,
      paymentMethod,
      paymentStatus,
      walletStatus,
      status,
      walletCredited,
      startDate,
      endDate,
      tab,
      retailerId
    } = req.query;

    const query = {};

    // Tab Filtering (Requirement 16)
    if (tab === 'paid') {
      query.paymentStatus = 'PAID';
    } else if (tab === 'unpaid') {
      query.paymentStatus = 'UNPAID';
    } else if (tab === 'pending') {
      query.status = 'PENDING';
    } else if (tab === 'received') {
      query.status = 'RECEIVED';
    } else if (tab === 'verified') {
      query.status = 'VERIFIED';
    } else if (tab === 'rejected') {
      query.status = 'REJECTED';
    }

    // Specific Retailer Filter
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      query.retailerId = retailerId;
    }

    // Payment Method Filter
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod.toUpperCase();
    }

    // Payment Status Filter
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus.toUpperCase();
    }

    // Wallet Status Filter (CREDITED / REVERSED)
    if (walletStatus && walletStatus !== 'all') {
      query.walletStatus = walletStatus.toUpperCase();
    }

    // General Status Filter
    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    // Date Range Filter
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = end;
      }
    }

    // Text Search
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { paymentId: searchRegex },
        { retailerName: searchRegex },
        { retailerPhone: searchRegex },
        { utrNumber: searchRegex },
        { referenceNumber: searchRegex },
        { upiTransactionId: searchRegex },
        { bankReference: searchRegex },
        { senderName: searchRegex }
      ];
    }

    const startIndex = (page - 1) * limit;
    const total = await ManualPayment.countDocuments(query);

    const payments = await ManualPayment.find(query)
      .populate('retailerId', 'name retailerId phone accountType shopName')
      .populate('createdBy', 'name email role')
      .populate('receivedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('walletCreditedBy', 'name email')
      .populate('walletTransactionId', 'referenceId status closingBalancePaise')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: payments,
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

// @desc    Get Manual Payment Summary Stats Cards (Requirement 17)
// @route   GET /api/admin/manual-payments/stats
// @access  Private (Admin)
const getManualPaymentStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayAgg,
      paidAgg,
      unpaidAgg,
      upiAgg,
      cashAgg,
      bankAgg
    ] = await Promise.all([
      // Today's Manual Credits
      ManualPayment.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      // Paid
      ManualPayment.aggregate([
        { $match: { paymentStatus: 'PAID' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      // Unpaid
      ManualPayment.aggregate([
        { $match: { paymentStatus: 'UNPAID' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      // UPI (Paid only)
      ManualPayment.aggregate([
        { $match: { paymentStatus: 'PAID', paymentMethod: 'UPI' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      // Cash (Paid only)
      ManualPayment.aggregate([
        { $match: { paymentStatus: 'PAID', paymentMethod: 'CASH' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      // Bank Transfer (Paid only)
      ManualPayment.aggregate([
        { $match: { paymentStatus: 'PAID', paymentMethod: 'BANK_TRANSFER' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaise: { $sum: '$amountPaise' } } }
      ])
    ]);

    const stats = {
      todayCredits: {
        count: todayAgg[0]?.count || 0,
        amount: Number(((todayAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      },
      paid: {
        count: paidAgg[0]?.count || 0,
        amount: Number(((paidAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      },
      unpaid: {
        count: unpaidAgg[0]?.count || 0,
        amount: Number(((unpaidAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      },
      upi: {
        count: upiAgg[0]?.count || 0,
        amount: Number(((upiAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      },
      cash: {
        count: cashAgg[0]?.count || 0,
        amount: Number(((cashAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      },
      bankTransfer: {
        count: bankAgg[0]?.count || 0,
        amount: Number(((bankAgg[0]?.totalPaise || 0) / 100).toFixed(2))
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Manual Payment Reconciliation Report
// @route   GET /api/admin/manual-payments/reconciliation
// @access  Private (Admin)
const getManualPaymentReconciliation = async (req, res, next) => {
  try {
    const payments = await ManualPayment.find()
      .populate('retailerId', 'name retailerId phone')
      .populate('walletTransactionId', 'amountPaise closingBalancePaise status referenceId')
      .sort({ createdAt: -1 })
      .lean();

    const reconciliation = payments.map((p) => {
      const paymentAmount = p.amount;
      let walletCreditAmount = 0;
      let walletStatus = 'NOT_CREDITED';

      if (p.walletCredited) {
        walletCreditAmount = p.amount; // or p.walletTransactionId?.amountPaise / 100
        walletStatus = 'CREDITED';
      }

      const difference = paymentAmount - walletCreditAmount;

      let status = 'PENDING VERIFICATION';
      if (p.walletCredited && difference === 0) {
        status = 'MATCHED';
      } else if (p.walletCredited && difference !== 0) {
        status = 'MISMATCH';
      } else if (!p.walletCredited && ['RECEIVED', 'VERIFIED'].includes(p.status)) {
        status = 'PAYMENT RECEIVED — WALLET NOT CREDITED';
      }

      return {
        paymentId: p.paymentId,
        id: p._id,
        retailerName: p.retailerName,
        retailerId: p.retailerId,
        paymentMethod: p.paymentMethod,
        utrNumber: p.utrNumber || p.upiTransactionId || p.referenceNumber,
        paymentDate: p.paymentDate,
        paymentStatus: p.status,
        paymentAmount,
        walletCreditAmount,
        difference,
        walletCredited: p.walletCredited,
        reconciliationStatus: status
      };
    });

    // Detect Wallet Credit without linked Manual Payment (Unlinked Wallet Credits)
    const linkedTxnIds = payments
      .filter((p) => p.walletTransactionId)
      .map((p) => p.walletTransactionId._id || p.walletTransactionId);

    const linkedPaymentIds = payments.map((p) => p.paymentId);

    const unlinkedTransactions = await Transaction.find({
      $or: [
        { service: 'manual_credit' },
        { service: 'admin_credit' },
        { source: 'MANUAL' }
      ],
      _id: { $nin: linkedTxnIds },
      referenceId: { $nin: linkedPaymentIds }
    })
      .populate('userId', 'name retailerId phone')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unlinkedCredits = unlinkedTransactions.map((tx) => ({
      transactionId: tx._id,
      referenceId: tx.referenceId,
      retailerName: tx.userId?.name || 'Unknown',
      retailerId: tx.userId?.retailerId || 'N/A',
      amount: (tx.amountPaise || 0) / 100,
      createdAt: tx.createdAt,
      performedBy: tx.performedBy || tx.adminName || 'System',
      reason: tx.reason || tx.description || 'Manual Wallet Adjustment',
      warning: '⚠ Unlinked Wallet Credit (No linked ManualPayment record)'
    }));

    res.status(200).json({
      success: true,
      data: {
        reconciliation,
        unlinkedCredits
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Manual Payments for a specific Retailer (Retailer 360° Profile integration)
// @route   GET /api/admin/manual-payments/retailer/:userId
// @access  Private (Admin)
const getRetailerManualPayments = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const payments = await ManualPayment.find({ retailerId: userId })
      .populate('createdBy', 'name')
      .populate('verifiedBy', 'name')
      .populate('receivedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const latestPayment = payments.length > 0 ? payments[0] : null;

    res.status(200).json({
      success: true,
      data: {
        latestPayment,
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Single Manual Payment Record by ID
// @route   GET /api/admin/manual-payments/:id
// @access  Private (Admin)
const getManualPaymentById = async (req, res, next) => {
  try {
    const payment = await ManualPayment.findById(req.params.id)
      .populate('retailerId', 'name retailerId phone accountType shopName city')
      .populate('createdBy', 'name email role')
      .populate('receivedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('walletCreditedBy', 'name email')
      .populate('walletTransactionId')
      .populate('walletLedgerId')
      .lean();

    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found');
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a New Manual Payment
// @route   POST /api/admin/manual-payments
// @access  Private (Admin / Finance)
const createManualPayment = async (req, res, next) => {
  try {
    const {
      retailerId,
      amount,
      paymentMethod,
      paymentDate,
      referenceNumber,
      upiTransactionId,
      utrNumber,
      bankReference,
      senderName,
      senderUpiId,
      receivedByPerson,
      receiptReference,
      notes,
      proofImage,
      initialStatus
    } = req.body;

    if (!retailerId || !mongoose.Types.ObjectId.isValid(retailerId)) {
      res.status(400);
      throw new Error('Valid retailerId is required.');
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400);
      throw new Error('Valid positive monetary amount in rupees is required.');
    }

    const validMethods = ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'];
    const passedMethod = (paymentMethod || '').toUpperCase();
    const status = (initialStatus || '').toUpperCase() === 'RECEIVED' ? 'RECEIVED' : 'PENDING';
    const isPaidStatus = status === 'RECEIVED' || (req.body.paymentStatus || '').toUpperCase() === 'PAID';

    let finalMethod = null;
    if (isPaidStatus) {
      if (!validMethods.includes(passedMethod)) {
        res.status(400);
        throw new Error(`Payment method is required for paid payments. Allowed: ${validMethods.join(', ')}`);
      }
      finalMethod = passedMethod;
    } else {
      finalMethod = null;
    }

    const newPayment = await ManualPayment.create({
      paymentId,
      retailerId: retailer._id,
      retailerName: retailer.name || retailer.shopName || 'Retailer',
      retailerPhone: retailer.phone,
      amountPaise,
      amount: rupees,
      paymentMethod: finalMethod,
      paymentStatus: isPaidStatus ? 'PAID' : 'UNPAID',
      status,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      receivedAt: status === 'RECEIVED' ? new Date() : null,
      receivedBy: status === 'RECEIVED' ? adminUser._id : null,
      receivedByName: status === 'RECEIVED' ? adminName : null,
      createdBy: adminUser._id,
      createdByName: adminName,
      referenceNumber: referenceNumber || null,
      upiTransactionId: upiTransactionId || null,
      utrNumber: utrNumber || null,
      bankReference: bankReference || null,
      senderName: senderName || null,
      senderUpiId: senderUpiId || null,
      receivedByPerson: receivedByPerson || null,
      receiptReference: receiptReference || null,
      notes: notes || null,
      proofImage: proofImage || null,
      walletCredited: false
    });

    // Audit Log
    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_CREATED',
      'MANUAL_PAYMENT',
      null,
      { paymentId, retailerId: retailer._id, amount: rupees, paymentMethod: normMethod, status },
      req,
      newPayment._id
    );

    res.status(201).json({
      success: true,
      message: `Manual payment ${paymentId} recorded successfully with status ${status}.`,
      data: newPayment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark Payment as RECEIVED
// @route   POST /api/admin/manual-payments/:id/receive
// @access  Private (Admin / Finance)
const markAsReceived = async (req, res, next) => {
  try {
    const payment = await ManualPayment.findById(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (payment.status !== 'PENDING') {
      res.status(400);
      throw new Error(`Only PENDING payments can be marked as RECEIVED. Current status: ${payment.status}`);
    }

    const adminUser = req.admin;
    const oldStatus = payment.status;

    payment.status = 'RECEIVED';
    payment.receivedAt = new Date();
    payment.receivedBy = adminUser._id;
    payment.receivedByName = adminUser.name || 'Admin';
    await payment.save();

    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_RECEIVED',
      'MANUAL_PAYMENT',
      { status: oldStatus },
      { status: 'RECEIVED', receivedAt: payment.receivedAt, receivedByName: payment.receivedByName },
      req,
      payment._id
    );

    res.status(200).json({
      success: true,
      message: `Payment ${payment.paymentId} confirmed as RECEIVED.`,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Payment
// @route   POST /api/admin/manual-payments/:id/verify
// @access  Private (Admin / Finance)
const verifyPayment = async (req, res, next) => {
  try {
    const payment = await ManualPayment.findById(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (['REJECTED', 'CANCELLED'].includes(payment.status)) {
      res.status(400);
      throw new Error(`Cannot verify a ${payment.status} payment.`);
    }

    const adminUser = req.admin;
    const oldStatus = payment.status;

    payment.status = 'VERIFIED';
    payment.verifiedAt = new Date();
    payment.verifiedBy = adminUser._id;
    payment.verifiedByName = adminUser.name || 'Admin';

    if (!payment.receivedAt) {
      payment.receivedAt = new Date();
      payment.receivedBy = adminUser._id;
      payment.receivedByName = adminUser.name || 'Admin';
    }

    await payment.save();

    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_VERIFIED',
      'MANUAL_PAYMENT',
      { status: oldStatus },
      { status: 'VERIFIED', verifiedAt: payment.verifiedAt, verifiedByName: payment.verifiedByName },
      req,
      payment._id
    );

    res.status(200).json({
      success: true,
      message: `Payment ${payment.paymentId} successfully VERIFIED.`,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject Payment Claim
// @route   POST /api/admin/manual-payments/:id/reject
// @access  Private (Admin / Finance)
const rejectPayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await ManualPayment.findById(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (payment.walletCredited) {
      res.status(400);
      throw new Error('Cannot reject a payment after the retailer wallet has already been credited. Reverse the wallet credit first.');
    }

    const adminUser = req.admin;
    const oldStatus = payment.status;

    payment.status = 'REJECTED';
    payment.rejectionReason = reason || 'Payment claim not valid / money not received';
    payment.rejectedBy = adminUser._id;
    payment.rejectedByName = adminUser.name || 'Admin';
    payment.rejectedAt = new Date();
    await payment.save();

    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_REJECTED',
      'MANUAL_PAYMENT',
      { status: oldStatus },
      { status: 'REJECTED', reason: payment.rejectionReason },
      req,
      payment._id
    );

    res.status(200).json({
      success: true,
      message: `Payment ${payment.paymentId} has been REJECTED.`,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel Payment Entry
// @route   POST /api/admin/manual-payments/:id/cancel
// @access  Private (Admin)
const cancelPayment = async (req, res, next) => {
  try {
    const payment = await ManualPayment.findById(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (payment.walletCredited) {
      res.status(400);
      throw new Error('Cannot cancel a payment after the retailer wallet has been credited.');
    }

    const adminUser = req.admin;
    const oldStatus = payment.status;

    payment.status = 'CANCELLED';
    await payment.save();

    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_CANCELLED',
      'MANUAL_PAYMENT',
      { status: oldStatus },
      { status: 'CANCELLED' },
      req,
      payment._id
    );

    res.status(200).json({
      success: true,
      message: `Payment ${payment.paymentId} CANCELLED.`,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    CREDIT WALLET FOR MANUAL PAYMENT (Idempotent & Double-Credit Protected)
// @route   POST /api/admin/manual-payments/:id/credit-wallet
// @access  Private (Super Admin / Finance)
const creditWalletForPayment = async (req, res, next) => {
  try {
    const paymentIdParam = req.params.id;

    // 1. Double-credit guard check on initial read
    const payment = await ManualPayment.findById(paymentIdParam);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (payment.walletCredited === true) {
      return res.status(400).json({
        success: false,
        message: 'Wallet already credited for this payment.',
        walletCreditedAt: payment.walletCreditedAt,
        walletTransactionId: payment.walletTransactionId
      });
    }

    if (['REJECTED', 'CANCELLED'].includes(payment.status)) {
      res.status(400);
      throw new Error(`Cannot credit wallet for a ${payment.status} payment.`);
    }

    const retailer = await User.findById(payment.retailerId);
    if (!retailer) {
      res.status(404);
      throw new Error('Associated retailer not found.');
    }

    // 2. Atomic claim update to prevent race conditions / duplicate requests
    const claimedPayment = await ManualPayment.findOneAndUpdate(
      { _id: payment._id, walletCredited: false },
      {
        $set: {
          walletCredited: true,
          walletCreditedAt: new Date(),
          walletCreditedBy: req.admin._id,
          walletCreditedByName: req.admin.name || 'Admin',
          status: 'VERIFIED',
          verifiedAt: payment.verifiedAt || new Date(),
          verifiedBy: payment.verifiedBy || req.admin._id,
          verifiedByName: payment.verifiedByName || req.admin.name || 'Admin'
        }
      },
      { new: true }
    );

    if (!claimedPayment) {
      return res.status(400).json({
        success: false,
        message: 'Wallet already credited for this payment (atomic lock safeguard).'
      });
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const amountPaise = claimedPayment.amountPaise;
    const amountRupees = claimedPayment.amount;
    const refId = claimedPayment.paymentId;
    const utrRef = claimedPayment.utrNumber || claimedPayment.upiTransactionId || claimedPayment.referenceNumber || refId;
    const topupDescription = `MANUAL TOP-UP via ${claimedPayment.paymentMethod} (Ref: ${utrRef})`;

    // 3. Atomic Wallet Balance Mutation
    let wallet = await Wallet.findOne({ userId: retailer._id });
    if (!wallet) {
      wallet = new Wallet({ userId: retailer._id, balancePaise: 0, onHoldPaise: 0 });
    }

    const previousBalancePaise = Math.round(wallet.balancePaise || 0);
    wallet.balancePaise = previousBalancePaise + amountPaise;
    await wallet.save();

    const newBalancePaise = Math.round(wallet.balancePaise);
    const newBalanceRupees = Number((newBalancePaise / 100).toFixed(2));
    const prevBalanceRupees = Number((previousBalancePaise / 100).toFixed(2));

    // 4. Wallet Ledger Entry
    const ledger = await WalletLedger.create({
      userId: retailer._id,
      adminId: adminUser._id,
      adminName,
      transactionType: 'CREDIT',
      amountPaise,
      previousBalancePaise,
      balanceAfterPaise: newBalancePaise,
      amount: amountRupees,
      previousBalance: prevBalanceRupees,
      balanceAfter: newBalanceRupees,
      referenceType: 'MANUAL',
      referenceId: refId,
      remark: 'MANUAL TOP-UP',
      description: topupDescription
    });

    // 5. Transaction Record for Global Transactions & Retailer Wallet Statement
    const rawAcc = retailer.accountType ? retailer.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const transaction = await Transaction.create({
      userId: retailer._id,
      accountType: userAccountType,
      type: 'credit',
      amountPaise,
      closingBalancePaise: newBalancePaise,
      status: 'success',
      service: 'manual_wallet_topup',
      transactionType: 'MANUAL_TOPUP',
      paymentMethod: claimedPayment.paymentMethod,
      paymentStatus: 'VERIFIED',
      source: 'MANUAL',
      performedBy: adminName,
      adminId: adminUser._id,
      adminName,
      reason: claimedPayment.notes || `Manual payment verification (UTR: ${utrRef})`,
      description: topupDescription,
      referenceId: refId,
      upiDetails: {
        utr: utrRef,
        gateway: `Manual ${claimedPayment.paymentMethod}`,
        gatewayPaymentId: claimedPayment.paymentId
      },
      isTest: false
    });

    // 6. Link Transaction and Ledger back to ManualPayment record
    claimedPayment.walletTransactionId = transaction._id;
    claimedPayment.walletLedgerId = ledger._id;
    await claimedPayment.save();

    // 7. Send Notification
    try {
      NotificationService.sendWalletCredited({
        userId: retailer._id,
        amount: amountRupees,
        newBalance: newBalanceRupees,
        reason: `Manual Top-up (${claimedPayment.paymentMethod}) - UTR: ${utrRef}`,
        referenceId: refId
      });
    } catch (notifErr) {
      console.error('[ManualPayment Controller] Notification error:', notifErr.message);
    }

    // 8. Write Audit Log
    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_WALLET_CREDITED',
      'MANUAL_PAYMENT',
      { walletCredited: false },
      {
        paymentId: refId,
        amount: amountRupees,
        retailerId: retailer._id,
        walletTransactionId: transaction._id,
        walletLedgerId: ledger._id,
        newBalanceRupees
      },
      req,
      claimedPayment._id
    );

    res.status(200).json({
      success: true,
      message: `Successfully credited ₹${amountRupees.toFixed(2)} to ${retailer.name}'s wallet.`,
      data: {
        paymentId: refId,
        walletCredited: true,
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

// @desc    Reverse Wallet Credit for a Manual Payment
// @route   POST /api/admin/manual-payments/:id/reverse
// @access  Private (Super Admin / Finance)
const reverseWalletCredit = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      res.status(400);
      throw new Error('A valid reversal reason (min 5 chars) is required.');
    }

    const payment = await ManualPayment.findById(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Manual payment record not found.');
    }

    if (!payment.walletCredited) {
      res.status(400);
      throw new Error('Cannot reverse a payment that has not credited the wallet yet.');
    }

    if (payment.isReversed) {
      res.status(400);
      throw new Error('This payment has already been reversed.');
    }

    const retailer = await User.findById(payment.retailerId);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found.');
    }

    let wallet = await Wallet.findOne({ userId: retailer._id });
    if (!wallet) {
      res.status(400);
      throw new Error('Retailer wallet not found.');
    }

    const amountPaise = payment.amountPaise;
    const amountRupees = payment.amount;

    if (wallet.balancePaise < amountPaise) {
      res.status(400);
      throw new Error(`Insufficient wallet balance to perform reversal. Wallet balance: ₹${(wallet.balancePaise/100).toFixed(2)}, Reversal required: ₹${amountRupees.toFixed(2)}`);
    }

    const adminUser = req.admin;
    const adminName = adminUser?.name || 'System Admin';
    const previousBalancePaise = Math.round(wallet.balancePaise || 0);

    wallet.balancePaise = previousBalancePaise - amountPaise;
    await wallet.save();

    const newBalancePaise = Math.round(wallet.balancePaise);
    const newBalanceRupees = Number((newBalancePaise / 100).toFixed(2));
    const prevBalanceRupees = Number((previousBalancePaise / 100).toFixed(2));
    const revRefId = `REV_${payment.paymentId}_${Date.now()}`;
    const description = `Reversal of Manual Top-up ${payment.paymentId}: ${reason.trim()}`;

    // Wallet Ledger Debit Entry
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
      remark: 'MANUAL_REVERSAL',
      description
    });

    // Transaction Record
    const rawAcc = retailer.accountType ? retailer.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const transaction = await Transaction.create({
      userId: retailer._id,
      accountType: userAccountType,
      type: 'debit',
      amountPaise,
      closingBalancePaise: newBalancePaise,
      status: 'success',
      service: 'manual_wallet_reversal',
      transactionType: 'MANUAL_REVERSAL',
      paymentMethod: 'ADMIN_DEBIT',
      paymentStatus: 'SUCCESS',
      source: 'MANUAL',
      performedBy: adminName,
      adminId: adminUser._id,
      adminName,
      reason: reason.trim(),
      description,
      referenceId: revRefId,
      isTest: false
    });

    // Update ManualPayment Record
    payment.isReversed = true;
    payment.reversedAt = new Date();
    payment.reversedBy = adminUser._id;
    payment.reversedByName = adminName;
    payment.reversalReason = reason.trim();
    payment.reversalTransactionId = transaction._id;
    payment.reversalLedgerId = ledger._id;
    await payment.save();

    // Audit Log
    await logAudit(
      adminUser,
      'MANUAL_PAYMENT_REVERSED',
      'MANUAL_PAYMENT',
      { isReversed: false },
      { paymentId: payment.paymentId, reversalReason: reason.trim(), amountRupees, newBalanceRupees },
      req,
      payment._id
    );

    res.status(200).json({
      success: true,
      message: `Successfully reversed wallet credit of ₹${amountRupees.toFixed(2)} for ${payment.paymentId}.`,
      data: {
        paymentId: payment.paymentId,
        isReversed: true,
        reversalTransactionId: transaction._id,
        newBalanceRupees
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Payment Proof Image
// @route   POST /api/admin/manual-payments/upload-proof
// @access  Private (Admin)
const uploadProof = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No proof file uploaded.');
    }

    const fileUrl = `/uploads/manual_payments/${req.file.filename}`;

    if (req.body.paymentId) {
      const payment = await ManualPayment.findById(req.body.paymentId);
      if (payment) {
        payment.proofImage = fileUrl;
        await payment.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment proof file uploaded successfully.',
      fileUrl
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getManualPayments,
  getManualPaymentStats,
  getManualPaymentReconciliation,
  getRetailerManualPayments,
  getManualPaymentById,
  createManualPayment,
  markAsReceived,
  verifyPayment,
  rejectPayment,
  cancelPayment,
  creditWalletForPayment,
  reverseWalletCredit,
  uploadProof
};
