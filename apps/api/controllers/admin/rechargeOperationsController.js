const mongoose = require('mongoose');
const RechargeTransaction = require('../../models/RechargeTransaction');
const Transaction = require('../../models/Transaction');
const CommissionHistory = require('../../models/CommissionHistory');
const TransactionActionLog = require('../../models/TransactionActionLog');
const AuditLog = require('../../models/AuditLog');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');
const User = require('../../models/User');
const ProviderFactory = require('../../services/providers/provider.factory');
const walletService = require('../../services/wallet/wallet.service');
const commissionService = require('../../services/commission/commission.service');
const { normalizePaymentType, getRawPaymentStatus } = require('../../utils/paymentHelper');

const sanitizeAccountType = (type) => {
  if (!type) return 'PERSONAL';
  const upper = String(type).toUpperCase();
  if (['PERSONAL', 'BUSINESS'].includes(upper)) return upper;
  return 'PERSONAL';
};

// @desc    Get recharge transactions (Paginated & Searchable)
// @route   GET /api/admin/recharges
// @access  Private (Admin)
const getRecharges = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const operator = req.query.operator || '';
    const service = req.query.service || '';
    const accountType = req.query.accountType || '';
    const paymentMethod = req.query.paymentMethod || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = { isTest: { $ne: true } };

    if (accountType && accountType !== 'all') {
      query.accountType = sanitizeAccountType(accountType);
    }

    if (paymentMethod && paymentMethod !== 'all') {
      const normFilter = normalizePaymentType(paymentMethod);
      if (normFilter === 'UPI') {
        query.$or = [
          { paymentMethod: { $in: ['UPI', 'RAZORPAY_UPI', 'RAZORPAY', 'upi', 'razorpay_upi', 'bhim_upi', 'upi_qr'] } },
          { paymentStatus: { $in: ['UPI', 'RAZORPAY_UPI', 'RAZORPAY', 'upi', 'razorpay_upi', 'bhim_upi', 'upi_qr'] } },
          { razorpayPaymentId: { $ne: null } }
        ];
      } else if (normFilter === 'WALLET') {
        query.$or = [
          { paymentMethod: { $in: ['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT', 'wallet'] } },
          { paymentStatus: { $in: ['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT', 'wallet'] } }
        ];
      } else {
        query.$or = [
          { paymentMethod: { $regex: new RegExp(`^${normFilter}$`, 'i') } },
          { paymentStatus: { $regex: new RegExp(`^${normFilter}$`, 'i') } }
        ];
      }
    }

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }
    
    if (operator) {
      query.operatorCode = operator;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (search) {
      const searchOr = [
        { orderId: { $regex: search, $options: 'i' } },
        { providerTransactionId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await RechargeTransaction.countDocuments(query);
    
    const recharges = await RechargeTransaction.find(query)
      .populate('userId', 'name retailerId phone accountType')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    const formattedRecharges = recharges.map(doc => {
      const canonicalMethod = normalizePaymentType(doc);
      const rawStatus = doc.paymentStatus || doc.paymentMethod || 'UNKNOWN';
      return {
        ...doc,
        paymentStatus: rawStatus,
        paymentMethod: canonicalMethod,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedRecharges,
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

// @desc    Get full details of a single recharge transaction
// @route   GET /api/admin/recharges/:orderId/details
// @access  Private (Admin)
const getRechargeDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    const recharge = await RechargeTransaction.findOne({ orderId })
      .populate('userId', 'name retailerId phone email accountType')
      .populate('internalNotes.adminId', 'name role')
      .lean();

    if (!recharge) {
      return res.status(404).json({ success: false, message: 'Recharge not found' });
    }

    const walletTransaction = await Transaction.findOne({ referenceId: orderId, type: 'debit' }).lean();
    const commissionHistory = await CommissionHistory.findOne({ transactionId: recharge._id }).lean();
    const wallet = await Wallet.findOne({ userId: recharge.userId?._id || recharge.userId }).lean();
    
    const walletLedgers = await WalletLedger.find({
      $or: [
        { referenceId: recharge._id },
        { description: { $regex: orderId, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 }).lean();

    const actionLogs = await TransactionActionLog.find({ transactionId: recharge._id })
      .populate('adminId', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    const auditLogs = await AuditLog.find({ resourceId: recharge._id })
      .populate('adminId', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    const rechargeFormatted = {
      ...recharge,
      paymentStatus: recharge.paymentStatus || recharge.paymentMethod || 'UNKNOWN',
      paymentMethod: normalizePaymentType(recharge),
    };

    let walletTxnFormatted = null;
    if (walletTransaction) {
      walletTxnFormatted = {
        ...walletTransaction,
        paymentStatus: walletTransaction.paymentStatus || walletTransaction.paymentMethod || 'UNKNOWN',
        paymentMethod: normalizePaymentType(walletTransaction),
      };
    }

    res.status(200).json({
      success: true,
      data: {
        recharge: rechargeFormatted,
        walletTransaction: walletTxnFormatted,
        commissionHistory,
        wallet: wallet ? {
          balance: (wallet.balancePaise || 0) / 100,
          onHold: (wallet.onHoldPaise || 0) / 100,
        } : null,
        walletLedgers,
        actionLogs,
        auditLogs,
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Perform manual action on a recharge transaction
// @route   POST /api/admin/recharges/:orderId/action
// @access  Private (Admin/Finance/SuperAdmin)
const performAction = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { action, remarks } = req.body;
    const admin = req.admin;
    const adminId = admin._id;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action is required' });
    }

    // Role verification
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
    if (!allowedRoles.includes(admin.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role for manual transaction actions.' });
    }

    const transaction = await RechargeTransaction.findOne({ orderId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Recharge not found' });
    }

    const previousStatus = transaction.status;
    const userRec = await User.findById(transaction.userId).lean();
    const retailerName = userRec?.name || 'Retailer';

    // Helper for logging action & audit log
    const logAuditAndActionLog = async (actionType, newStatus, remarksText, auditAction = 'RECHARGE_MANUALLY_RESOLVED', details = {}) => {
      await TransactionActionLog.create({
        transactionId: transaction._id,
        adminId,
        action: actionType,
        previousStatus,
        newStatus: newStatus || previousStatus,
        remarks: remarksText || 'Action performed'
      });

      await AuditLog.create({
        adminId,
        action: auditAction,
        resource: 'RECHARGE',
        resourceId: transaction._id,
        oldValue: { status: previousStatus, reservedAmount: transaction.reservedAmount, refundStatus: transaction.refundStatus },
        newValue: { status: newStatus || previousStatus, ...details },
        description: `Recharge Order ${orderId}: ${actionType} - ${remarksText}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1'
      });
    };

    switch (action) {
      // -------------------------------------------------------------
      // 1. CHECK_STATUS (Queries provider & updates status)
      // -------------------------------------------------------------
      case 'CHECK_STATUS':
      case 'PROVIDER_STATUS': {
        if (!transaction.providerTransactionId) {
          return res.status(400).json({ success: false, message: 'No provider transaction ID attached to query status.' });
        }
        
        const providerName = transaction.providerName || 'A1Topup';
        const provider = ProviderFactory.getProvider(providerName);
        const statusResponse = await provider.status(transaction.providerTransactionId);

        transaction.providerResponse = statusResponse;

        if (['PENDING', 'PROCESSING', 'PROVIDER_TIMEOUT', 'TIMEOUT'].includes(previousStatus)) {
          if (statusResponse.status === 'SUCCESS') {
            transaction.status = 'SUCCESS';
            transaction.operatorReference = statusResponse.operatorReference || transaction.operatorReference;
            
            await walletService.commitReservation(transaction.userId, transaction.amount, {
              referenceType: 'RECHARGE',
              referenceId: transaction._id,
              description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
            });

            const userAccountType = sanitizeAccountType(userRec?.accountType || transaction.accountType);
            transaction.accountType = userAccountType;
            transaction.reservedAmount = 0;

            // Idempotency check: Ensure commission not credited twice
            const existingComm = await CommissionHistory.findOne({ transactionId: transaction._id });
            let commission;
            if (!existingComm) {
              commission = await commissionService.calculateCommission(
                transaction.operatorCode,
                transaction.amount,
                '',
                'mobile',
                userAccountType,
                transaction.userId
              );
              if (commission.retailerCommissionAmount > 0) {
                await walletService.addBalance(transaction.userId, commission.retailerCommissionAmount, {
                  referenceType: 'COMMISSION',
                  referenceId: transaction._id,
                  description: `Commission for Recharge ${transaction.orderId}`,
                });
                await Transaction.create({
                  userId: transaction.userId,
                  accountType: userAccountType,
                  type: 'credit',
                  amountPaise: commission.retailerCommissionAmount * 100,
                  status: 'success',
                  service: 'commission',
                  referenceId: `COM${Date.now()}${Math.floor(Math.random() * 1000)}`,
                  description: `Commission for Recharge ${transaction.orderId}`,
                  apiReference: transaction._id.toString(),
                  paymentMethod: 'wallet',
                });
              }

              await CommissionHistory.create({
                transactionId: transaction._id,
                userId: transaction.userId,
                accountType: userAccountType,
                operatorCode: transaction.operatorCode,
                rechargeAmount: transaction.amount,
                providerCommissionPercentage: commission.providerCommissionPercentage,
                providerCommissionAmount: commission.providerCommissionAmount,
                retailerCommissionPercentage: commission.retailerCommissionPercentage,
                retailerCommissionAmount: commission.retailerCommissionAmount,
                companyProfitPercentage: commission.companyProfitPercentage,
                companyProfitAmount: commission.companyProfitAmount,
              });
            } else {
              commission = { retailerCommissionAmount: existingComm.retailerCommissionAmount };
            }

            await Transaction.updateOne({ referenceId: transaction.orderId }, { 
              status: 'success', 
              accountType: userAccountType,
              apiReference: statusResponse.providerTransactionId,
              commissionEarnedPaise: (commission.retailerCommissionAmount || 0) * 100 
            });

            transaction.commissionCalculated = true;
          } else if (statusResponse.status === 'FAILED') {
            transaction.status = 'FAILED';
            transaction.failureReason = statusResponse.message || 'Provider status confirmed failed';
            transaction.reservedAmount = 0;

            await walletService.releaseHoldWithLedger(transaction.userId, transaction.amount, {
              referenceId: transaction._id,
              orderId: transaction.orderId,
              description: `Provider failed recharge hold release for ${transaction.orderId}`
            });

            await Transaction.updateOne({ referenceId: transaction.orderId }, { 
              status: 'failed', 
              apiReference: statusResponse.providerTransactionId 
            });
          }
        }
        
        await transaction.save();
        await logAuditAndActionLog('CHECK_STATUS', transaction.status, remarks || `Provider status check returned: ${statusResponse.status}`, 'RECHARGE_STATUS_CHANGED');
        
        return res.status(200).json({ success: true, message: `Status checked: Provider status is ${statusResponse.status}`, data: transaction });
      }

      // -------------------------------------------------------------
      // 2. MARK_SUCCESS / MANUAL_SUCCESS
      // -------------------------------------------------------------
      case 'MARK_SUCCESS':
      case 'MANUAL_SUCCESS': {
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ success: false, message: 'Admin reason/remarks are required for marking SUCCESS.' });
        }
        if (['SUCCESS', 'REFUNDED'].includes(previousStatus)) {
          return res.status(400).json({ success: false, message: `Transaction is already in ${previousStatus} state.` });
        }

        // Commit hold if amount was held
        await walletService.commitReservation(transaction.userId, transaction.amount, {
          referenceType: 'RECHARGE',
          referenceId: transaction._id,
          description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
        });

        const userAccountType = sanitizeAccountType(userRec?.accountType || transaction.accountType);
        transaction.accountType = userAccountType;
        transaction.reservedAmount = 0;

        // Calculate & credit commission if not calculated yet
        const existingComm = await CommissionHistory.findOne({ transactionId: transaction._id });
        let commission;
        if (!existingComm) {
          commission = await commissionService.calculateCommission(
            transaction.operatorCode,
            transaction.amount,
            '',
            'mobile',
            userAccountType,
            transaction.userId
          );
          if (commission.retailerCommissionAmount > 0) {
            await walletService.addBalance(transaction.userId, commission.retailerCommissionAmount, {
              referenceType: 'COMMISSION',
              referenceId: transaction._id,
              description: `Commission for Recharge ${transaction.orderId}`,
            });
            await Transaction.create({
              userId: transaction.userId,
              accountType: userAccountType,
              type: 'credit',
              amountPaise: commission.retailerCommissionAmount * 100,
              status: 'success',
              service: 'commission',
              referenceId: `COM${Date.now()}${Math.floor(Math.random() * 1000)}`,
              description: `Commission for Recharge ${transaction.orderId}`,
              apiReference: transaction._id.toString(),
              paymentMethod: 'wallet',
            });
          }
          await CommissionHistory.create({
            transactionId: transaction._id,
            userId: transaction.userId,
            accountType: userAccountType,
            operatorCode: transaction.operatorCode,
            rechargeAmount: transaction.amount,
            providerCommissionPercentage: commission.providerCommissionPercentage,
            providerCommissionAmount: commission.providerCommissionAmount,
            retailerCommissionPercentage: commission.retailerCommissionPercentage,
            retailerCommissionAmount: commission.retailerCommissionAmount,
            companyProfitPercentage: commission.companyProfitPercentage,
            companyProfitAmount: commission.companyProfitAmount,
          });
        } else {
          commission = { retailerCommissionAmount: existingComm.retailerCommissionAmount };
        }

        await Transaction.updateOne({ referenceId: transaction.orderId }, { 
          status: 'success', 
          accountType: userAccountType,
          commissionEarnedPaise: (commission.retailerCommissionAmount || 0) * 100 
        });

        transaction.status = 'SUCCESS';
        transaction.commissionCalculated = true;
        await transaction.save();

        await logAuditAndActionLog('MARK_SUCCESS', 'SUCCESS', remarks, 'RECHARGE_STATUS_CHANGED');

        const updatedWallet = await Wallet.findOne({ userId: transaction.userId }).lean();
        return res.status(200).json({ 
          success: true, 
          message: `Recharge ${orderId} marked as SUCCESS.`, 
          data: transaction,
          wallet: updatedWallet ? { balance: updatedWallet.balancePaise / 100, onHold: updatedWallet.onHoldPaise / 100 } : null
        });
      }

      // -------------------------------------------------------------
      // 3. MARK_FAILED / MANUAL_FAILURE
      // -------------------------------------------------------------
      case 'MARK_FAILED':
      case 'MANUAL_FAILURE': {
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ success: false, message: 'Admin reason/remarks are required for marking FAILED.' });
        }
        if (['FAILED', 'REFUNDED'].includes(previousStatus)) {
          return res.status(400).json({ success: false, message: `Transaction is already in ${previousStatus} state.` });
        }

        // Check if money was held or reserved
        const wallet = await Wallet.findOne({ userId: transaction.userId });
        if (transaction.reservedAmount > 0 || (wallet && wallet.onHoldPaise > 0)) {
          await walletService.releaseHoldWithLedger(transaction.userId, transaction.amount, {
            referenceId: transaction._id,
            orderId: transaction.orderId,
            description: `Manual failure hold release for order ${transaction.orderId}: ${remarks}`
          });
        }

        transaction.status = 'FAILED';
        transaction.failureReason = remarks;
        transaction.reservedAmount = 0;
        await transaction.save();

        await Transaction.updateOne({ referenceId: transaction.orderId }, { status: 'failed' });

        await logAuditAndActionLog('MARK_FAILED', 'FAILED', remarks, 'RECHARGE_STATUS_CHANGED');

        const updatedWallet = await Wallet.findOne({ userId: transaction.userId }).lean();
        return res.status(200).json({ 
          success: true, 
          message: `Recharge ${orderId} marked as FAILED and held amount released.`, 
          data: transaction,
          wallet: updatedWallet ? { balance: updatedWallet.balancePaise / 100, onHold: updatedWallet.onHoldPaise / 100 } : null
        });
      }

      // -------------------------------------------------------------
      // 4. RELEASE_HOLD
      // -------------------------------------------------------------
      case 'RELEASE_HOLD': {
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ success: false, message: 'Admin reason/remarks are required for releasing hold.' });
        }

        const wallet = await Wallet.findOne({ userId: transaction.userId });
        const heldAmountPaise = wallet ? wallet.onHoldPaise : 0;

        if (transaction.reservedAmount <= 0 && heldAmountPaise <= 0) {
          return res.status(400).json({ success: false, message: 'No wallet amount is currently held for release.' });
        }

        const releaseAmount = transaction.reservedAmount > 0 ? transaction.amount : (heldAmountPaise / 100);

        const releaseRes = await walletService.releaseHoldWithLedger(transaction.userId, releaseAmount, {
          referenceId: transaction._id,
          orderId: transaction.orderId,
          description: `Hold released by admin for ${transaction.orderId}: ${remarks}`
        });

        transaction.reservedAmount = 0;
        if (['PENDING', 'PROCESSING', 'PROVIDER_TIMEOUT', 'TIMEOUT'].includes(transaction.status)) {
          transaction.status = 'FAILED';
          transaction.failureReason = `Hold released by admin: ${remarks}`;
        }
        await transaction.save();

        await logAuditAndActionLog('RELEASE_HOLD', transaction.status, remarks, 'RECHARGE_HOLD_RELEASED', { releasedAmount: releaseAmount });

        return res.status(200).json({
          success: true,
          message: `Released ₹${releaseAmount.toFixed(2)} hold to retailer wallet.`,
          data: transaction,
          wallet: releaseRes
        });
      }

      // -------------------------------------------------------------
      // 5. REFUND (Idempotent Wallet Credit)
      // -------------------------------------------------------------
      case 'REFUND': {
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ success: false, message: 'Admin reason/remarks are required for performing a refund.' });
        }

        // Idempotency Check
        if (transaction.status === 'REFUNDED' || transaction.refundStatus === true || transaction.refundStatus === 'true' || transaction.refundStatus === 'REFUNDED') {
          return res.status(400).json({ success: false, message: 'Transaction has already been refunded. Multiple refunds are not allowed.' });
        }

        // Eligibility Check
        const walletTransaction = await Transaction.findOne({ referenceId: orderId, type: 'debit' });
        const wallet = await Wallet.findOne({ userId: transaction.userId });

        let fromHold = false;
        if (transaction.status !== 'SUCCESS') {
          if (transaction.reservedAmount > 0 || (wallet && wallet.onHoldPaise > 0)) {
            fromHold = true;
          } else if (!walletTransaction) {
            return res.status(400).json({ success: false, message: 'No wallet amount is available for refund.' });
          }
        }

        const refundRes = await walletService.refundRecharge(transaction.userId, transaction.amount, {
          referenceId: transaction._id,
          orderId: transaction.orderId,
          fromHold,
          description: `Recharge Refund for order ${transaction.orderId}: ${remarks}`
        });

        transaction.status = 'REFUNDED';
        transaction.refundStatus = 'REFUNDED';
        transaction.reservedAmount = 0;
        await transaction.save();

        await Transaction.updateOne({ referenceId: transaction.orderId }, { 
          status: 'reversed', 
          description: `Refunded: ${transaction.orderId}`
        });

        await logAuditAndActionLog('REFUND', 'REFUNDED', remarks, 'RECHARGE_REFUNDED', { refundAmount: transaction.amount });

        return res.status(200).json({ 
          success: true, 
          message: `₹${transaction.amount.toFixed(2)} refunded successfully to retailer wallet.`,
          data: transaction,
          wallet: refundRes
        });
      }

      // -------------------------------------------------------------
      // 6. RETRY
      // -------------------------------------------------------------
      case 'RETRY': {
        if (['SUCCESS', 'REFUNDED'].includes(transaction.status)) {
          return res.status(400).json({ success: false, message: `Cannot retry a ${transaction.status} transaction.` });
        }
        if (transaction.retryCount >= 3) {
          return res.status(400).json({ success: false, message: 'Maximum retry limit (3) reached.' });
        }

        const retryProviderName = transaction.providerName || 'A1Topup';
        const retryProvider = ProviderFactory.getProvider(retryProviderName);
        
        const retryResponse = await retryProvider.recharge({
          orderId: transaction.orderId,
          mobileNumber: transaction.mobileNumber,
          amount: transaction.amount,
          operatorCode: transaction.operatorCode,
          circleCode: transaction.circleCode,
        });

        transaction.retryCount += 1;
        transaction.retryHistory.push({
          timestamp: new Date(),
          providerTransactionId: retryResponse.providerTransactionId,
          status: retryResponse.status,
          response: retryResponse
        });

        transaction.providerTransactionId = retryResponse.providerTransactionId || transaction.providerTransactionId;
        transaction.providerResponse = retryResponse;
        
        if (retryResponse.status === 'SUCCESS') {
          transaction.status = 'SUCCESS';
          await walletService.commitReservation(transaction.userId, transaction.amount, {
            referenceType: 'RECHARGE',
            referenceId: transaction._id,
            description: `Retry successful for ${transaction.orderId}`,
          });
        }
        
        await transaction.save();
        await logAuditAndActionLog('RETRY', transaction.status, remarks || `Retry executed. Provider status: ${retryResponse.status}`, 'RECHARGE_STATUS_CHANGED');
        
        return res.status(200).json({ success: true, message: `Retry executed: ${retryResponse.status}`, data: transaction });
      }

      // -------------------------------------------------------------
      // 7. ADD_NOTE
      // -------------------------------------------------------------
      case 'ADD_NOTE': {
        if (!remarks || !remarks.trim()) {
          return res.status(400).json({ success: false, message: 'Note text is required.' });
        }
        transaction.internalNotes.push({ note: remarks, adminId });
        await transaction.save();
        await logAuditAndActionLog('ADD_NOTE', transaction.status, `Added Note: ${remarks}`, 'RECHARGE_MANUALLY_RESOLVED');
        return res.status(200).json({ success: true, message: 'Note added successfully.', data: transaction });
      }

      case 'KEEP_PENDING': {
        await logAuditAndActionLog('KEEP_PENDING', transaction.status, remarks || 'Decided to keep transaction pending', 'RECHARGE_MANUALLY_RESOLVED');
        return res.status(200).json({ success: true, message: 'Logged decision to keep pending.', data: transaction });
      }

      default:
        return res.status(400).json({ success: false, message: `Invalid action: ${action}` });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecharges,
  getRechargeDetails,
  performAction,
};
