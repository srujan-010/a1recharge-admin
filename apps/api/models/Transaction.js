const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  accountType: {
    type: String,
    enum: ['PERSONAL', 'BUSINESS'],
    default: 'PERSONAL',
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amountPaise: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['success', 'pending', 'failed', 'reversed', 'refunded', 'cancelled', 'timeout'],
    required: true,
  },
  failureReason: {
    type: String,
    default: null,
  },
  service: {
    type: String,
    required: true,
    // e.g., 'mobile_recharge', 'bbps', 'dmt', 'wallet_topup', etc.
  },
  referenceId: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  closingBalancePaise: {
    type: Number,
  },
  recipientName: String,
  mobileNumber: String,
  commissionEarnedPaise: {
    type: Number,
    default: 0
  },
  operatorName: {
    type: String,
  },
  apiReference: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ['WALLET', 'UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER', 'UNKNOWN', 'wallet', 'upi', 'bank_transfer', 'cash', 'card', 'other', 'unknown'],
    default: 'WALLET',
  },
  upiDetails: {
    utr: { type: String, default: null },
    gateway: { type: String, default: null },
    gatewayOrderId: { type: String, default: null },
    gatewayPaymentId: { type: String, default: null },
  },
  isTest: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
