const mongoose = require('mongoose');
const RechargeTransaction = require('../models/RechargeTransaction');
const a1TopupProvider = require('../services/providers/a1topup/provider.service');
const walletService = require('../services/wallet/wallet.service');
const commissionService = require('../services/commission/commission.service');
const ledgerService = require('../services/ledger/ledger.service');
const CommissionHistory = require('../models/CommissionHistory');
const Transaction = require('../models/Transaction');
const NotificationService = require('../services/notification.service');

class PendingRechargeWorker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start(intervalMs = 60000) { // Run every minute by default
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => this.processPending(), intervalMs);
    console.log(`[Worker] Pending Recharge Worker started (Interval: ${intervalMs}ms)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Worker] Pending Recharge Worker stopped');
    }
  }

  async processPending() {
    if (this.isRunning) return; // Prevent concurrent overlapping runs
    this.isRunning = true;

    try {
      // Find all transactions that are PENDING and have a providerTransactionId
      // We also check transactions older than 1 minute to avoid checking ones just created
      const oneMinuteAgo = new Date(Date.now() - 60000);
      
      const pendingTransactions = await RechargeTransaction.find({
        status: 'PENDING',
        providerTransactionId: { $ne: null },
        createdAt: { $lte: oneMinuteAgo }
      }).limit(50); // Process in batches

      if (pendingTransactions.length === 0) {
        this.isRunning = false;
        return;
      }

      console.log(`[Worker] Found ${pendingTransactions.length} pending transactions to verify.`);

      for (const transaction of pendingTransactions) {
        try {
          const statusResponse = await a1TopupProvider.status(transaction.providerTransactionId);

          if (statusResponse.status === 'SUCCESS') {
            transaction.status = 'SUCCESS';
            transaction.operatorReference = statusResponse.operatorReference;
            
            // Deduct Wallet
            await walletService.commitReservation(transaction.userId, transaction.amount);
            
            await ledgerService.logTransaction({
              userId: transaction.userId,
              type: 'DEBIT',
              amount: transaction.amount,
              referenceType: 'RECHARGE',
              referenceId: transaction._id,
              description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
            });

            const User = require('../models/User');
            const userRec = await User.findById(transaction.userId).lean();
            const userAccountType = userRec?.accountType || transaction.accountType || 'PERSONAL';
            transaction.accountType = userAccountType;

            // Idempotency Check: Verify if commission was already calculated
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
                await walletService.addBalance(transaction.userId, commission.retailerCommissionAmount);
                await ledgerService.logTransaction({
                  userId: transaction.userId,
                  type: 'CREDIT',
                  amount: commission.retailerCommissionAmount,
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
            await transaction.save();
            console.log(`[Worker] Transaction ${transaction.orderId} marked SUCCESS | AccountType: ${userAccountType}`);

            // Send automatic notification
            NotificationService.sendRechargeSuccess({
              userId: transaction.userId,
              transactionId: transaction.orderId,
              orderId: transaction.orderId,
              service: transaction.service || 'mobile_recharge',
              operator: transaction.operatorCode,
              amount: transaction.amount,
              number: transaction.mobileNumber
            });

            // Background Provider Low-Balance Automation (Non-blocking)
            const providerAutomationService = require('../services/providerAutomation.service');
            setImmediate(() => {
              providerAutomationService.checkAndTriggerLowBalanceAlert(transaction).catch(err => {
                console.error('[Worker] Low balance automation error:', err.message);
              });
            });

          } else if (statusResponse.status === 'FAILED') {
            transaction.status = 'FAILED';
            transaction.failureReason = statusResponse.message;
            await walletService.releaseReservation(transaction.userId, transaction.amount);
            
            await Transaction.updateOne({ referenceId: transaction.orderId }, { 
              status: 'failed', 
              apiReference: statusResponse.providerTransactionId 
            });

            await transaction.save();
            console.log(`[Worker] Transaction ${transaction.orderId} marked FAILED. Funds refunded.`);

            // Send automatic notification
            NotificationService.sendRechargeFailed({
              userId: transaction.userId,
              transactionId: transaction.orderId,
              operator: transaction.operatorCode,
              amount: transaction.amount,
              reason: statusResponse.message
            });
          }
          // If still PENDING, do nothing
        } catch (err) {
          console.error(`[Worker] Error processing transaction ${transaction.orderId}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[Worker] Error in Pending Recharge Worker:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new PendingRechargeWorker();
