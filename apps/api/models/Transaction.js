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
    default: 'WALLET',
  },
  paymentStatus: {
    type: String,
    default: null,
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

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ service: 1, status: 1, createdAt: -1 });
transactionSchema.index({ 'upiDetails.gatewayOrderId': 1 });
transactionSchema.index({ 'upiDetails.gatewayPaymentId': 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
