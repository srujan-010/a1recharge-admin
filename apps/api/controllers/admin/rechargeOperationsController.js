const mongoose = require('mongoose');
const RechargeTransaction = require('../../models/RechargeTransaction');
const Transaction = require('../../models/Transaction');
const CommissionHistory = require('../../models/CommissionHistory');
const TransactionActionLog = require('../../models/TransactionActionLog');
const ProviderFactory = require('../../services/providers/provider.factory');
const walletService = require('../../services/wallet/wallet.service');
const commissionService = require('../../services/commission/commission.service');

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
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = { isTest: { $ne: true } };

    if (accountType && accountType !== 'all') {
      query.accountType = accountType.toUpperCase();
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
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { providerTransactionId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const startIndex = (page - 1) * limit;
    const total = await RechargeTransaction.countDocuments(query);
    
    const recharges = await RechargeTransaction.find(query)
      .populate('userId', 'name retailerId phone accountType')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: recharges,
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
      .populate('userId', 'name retailerId phone email')
      .populate('internalNotes.adminId', 'name role')
      .lean();

    if (!recharge) {
      return res.status(404).json({ success: false, message: 'Recharge not found' });
    }

    const walletTransaction = await Transaction.findOne({ referenceId: orderId, type: 'debit' }).lean();
    const commissionHistory = await CommissionHistory.findOne({ transactionId: recharge._id }).lean();
    
    const actionLogs = await TransactionActionLog.find({ transactionId: recharge._id })
      .populate('adminId', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        recharge,
        walletTransaction,
        commissionHistory,
        actionLogs,
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
    const adminId = req.admin._id;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action is required' });
    }

    const transaction = await RechargeTransaction.findOne({ orderId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Recharge not found' });
    }

    const previousStatus = transaction.status;

    // Helper to log action
    const logAction = async (newStatus, customRemarks = remarks) => {
      await TransactionActionLog.create({
        transactionId: transaction._id,
        adminId,
        action,
        previousStatus,
        newStatus: newStatus || previousStatus,
        remarks: customRemarks || 'Action performed'
      });
    };

    switch (action) {
      case 'CHECK_STATUS':
        if (!transaction.providerTransactionId) {
          return res.status(400).json({ success: false, message: 'No provider ID attached.' });
        }
        
        const providerName = transaction.providerName || 'A1Topup';
        const provider = ProviderFactory.getProvider(providerName);
        const statusResponse = await provider.status(transaction.providerTransactionId);

        transaction.providerResponse = statusResponse;

        if (previousStatus === 'PENDING' && statusResponse.status === 'SUCCESS') {
          transaction.status = 'SUCCESS';
          transaction.operatorReference = statusResponse.operatorReference;
          
          await walletService.commitReservation(transaction.userId, transaction.amount, {
            referenceType: 'RECHARGE',
            referenceId: transaction._id,
            description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
          });

          const User = require('../../models/User');
          const userRec = await User.findById(transaction.userId).lean();
          const userAccountType = userRec?.accountType || transaction.accountType || 'PERSONAL';
          transaction.accountType = userAccountType;

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
        } else if (previousStatus === 'PENDING' && statusResponse.status === 'FAILED') {
          transaction.status = 'FAILED';
          transaction.failureReason = statusResponse.message;
          await walletService.releaseReservation(transaction.userId, transaction.amount);
          await Transaction.updateOne({ referenceId: transaction.orderId }, { 
            status: 'failed', 
            apiReference: statusResponse.providerTransactionId 
          });
        }
        
        await transaction.save();
        await logAction(transaction.status, `Status Check. Provider says: ${statusResponse.status}`);
        
        return res.status(200).json({ success: true, message: 'Status checked and updated', data: transaction });

      case 'RETRY':
        if (transaction.status !== 'PENDING') {
          return res.status(400).json({ success: false, message: 'Only PENDING transactions can be retried.' });
        }
        if (transaction.retryCount >= 3) {
          return res.status(400).json({ success: false, message: 'Maximum retry limit reached.' });
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
        
        // Wait, for retry, if it succeeds immediately, we handle it? Usually retry returns PENDING.
        if (retryResponse.status === 'FAILED') {
           // We might just leave it pending to let another provider try, or mark as failed.
           // For now, let's keep it pending so admin can retry again.
           await transaction.save();
           await logAction(transaction.status, `Retry Failed. Message: ${retryResponse.message}`);
           return res.status(200).json({ success: true, message: 'Retry executed. Still pending.' });
        }
        
        await transaction.save();
        await logAction(transaction.status, `Retried Recharge. Response: ${retryResponse.status}`);
        return res.status(200).json({ success: true, message: 'Retried successfully.' });

      case 'REFUND':
        if (!['SUPER_ADMIN', 'FINANCE'].includes(req.admin.role)) {
          return res.status(403).json({ success: false, message: 'Unauthorized for Refunds' });
        }
        if (transaction.refundStatus) {
          return res.status(400).json({ success: false, message: 'Already refunded' });
        }
        if (transaction.status === 'SUCCESS') {
          return res.status(400).json({ success: false, message: 'Cannot refund a successful transaction directly without reversing.' });
        }
        
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          
          transaction.status = 'REFUNDED';
          transaction.refundStatus = true;
          
          await walletService.releaseReservation(transaction.userId, transaction.amount, session);
          
          await Transaction.updateOne({ referenceId: transaction.orderId }, { 
            status: 'reversed', 
            description: `Refunded: ${transaction.orderId}`
          }).session(session);

          await transaction.save({ session });
          
          await TransactionActionLog.create([{
            transactionId: transaction._id,
            adminId,
            action: 'REFUND',
            previousStatus,
            newStatus: 'REFUNDED',
            remarks: remarks || 'Manual Refund'
          }], { session });

          await session.commitTransaction();
          session.endSession();
          
          return res.status(200).json({ success: true, message: 'Refund successful' });
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
          throw err;
        }

      case 'MANUAL_SUCCESS':
      case 'MANUAL_FAILURE':
        if (req.admin.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ success: false, message: 'Only SUPER_ADMIN can manually override status.' });
        }
        if (!remarks) {
          return res.status(400).json({ success: false, message: 'Remarks are mandatory for manual override.' });
        }

        const overrideStatus = action === 'MANUAL_SUCCESS' ? 'SUCCESS' : 'FAILED';
        
        if (overrideStatus === 'SUCCESS') {
            await walletService.commitReservation(transaction.userId, transaction.amount, {
              referenceType: 'RECHARGE',
              referenceId: transaction._id,
              description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
            });
            const User = require('../../models/User');
            const userRec = await User.findById(transaction.userId).lean();
            const userAccountType = userRec?.accountType || transaction.accountType || 'PERSONAL';
            transaction.accountType = userAccountType;

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
              commissionEarnedPaise: (commission.retailerCommissionAmount || 0) * 100 
            });
            transaction.commissionCalculated = true;
        } else {
            await walletService.releaseReservation(transaction.userId, transaction.amount);
            await Transaction.updateOne({ referenceId: transaction.orderId }, { status: 'failed' });
        }

        transaction.status = overrideStatus;
        await transaction.save();
        await logAction(overrideStatus);
        
        return res.status(200).json({ success: true, message: `Status manually set to ${overrideStatus}` });

      case 'KEEP_PENDING':
        await logAction(transaction.status, 'Decided to keep pending: ' + remarks);
        return res.status(200).json({ success: true, message: 'Logged.' });
        
      case 'ADD_NOTE':
        if (!remarks) return res.status(400).json({ success: false, message: 'Note text required.' });
        transaction.internalNotes.push({ note: remarks, adminId });
        await transaction.save();
        await logAction(transaction.status, `Added Note: ${remarks}`);
        return res.status(200).json({ success: true, message: 'Note added' });
        
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
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
