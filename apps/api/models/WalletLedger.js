const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transactionType: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['RECHARGE', 'COMMISSION', 'REFUND', 'ADD_MONEY', 'MANUAL', 'HOLD_RELEASE', 'ADMIN_CREDIT', 'RAZORPAY_WALLET_CREDIT'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed, // Could be ObjectId, RechargeTransaction ID, or Razorpay/Order string ID
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const WalletLedger = mongoose.model('WalletLedger', walletLedgerSchema);
module.exports = WalletLedger;
