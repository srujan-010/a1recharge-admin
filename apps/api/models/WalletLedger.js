const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    adminName: {
      type: String,
      default: null,
    },
    transactionType: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amountPaise: {
      type: Number,
    },
    previousBalancePaise: {
      type: Number,
      default: 0,
    },
    balanceAfterPaise: {
      type: Number,
    },
    amount: {
      type: Number,
      required: true,
    },
    previousBalance: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['RECHARGE', 'COMMISSION', 'REFUND', 'ADD_MONEY', 'MANUAL', 'HOLD_RELEASE', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'RAZORPAY_WALLET_CREDIT'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed, // Could be ObjectId, RechargeTransaction ID, or Razorpay/Order string ID
      required: true,
    },
    remark: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

walletLedgerSchema.index({ userId: 1, createdAt: -1 });
walletLedgerSchema.index({ referenceId: 1 });

const WalletLedger = mongoose.model('WalletLedger', walletLedgerSchema);
module.exports = WalletLedger;
