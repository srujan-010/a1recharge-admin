const mongoose = require('mongoose');

const rechargeTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    accountType: {
      type: String,
      default: 'PERSONAL',
    },
    providerName: {
      type: String,
      required: true,
      default: 'A1Topup',
    },
    providerTransactionId: {
      type: String,
      default: null,
    },
    operatorReference: {
      type: String,
      default: null,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    operatorCode: {
      type: String,
      required: true,
    },
    circleCode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: 'PENDING',
    },
    reservedAmount: {
      type: Number,
      default: 0,
    },
    commissionCalculated: {
      type: Boolean,
      default: false,
    },
    failureReason: {
      type: String,
      default: null,
    },
    isTest: {
      type: Boolean,
      default: false,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    retryHistory: [{
      timestamp: Date,
      providerTransactionId: String,
      status: String,
      response: mongoose.Schema.Types.Mixed
    }],
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    internalNotes: [{
      note: String,
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      createdAt: { type: Date, default: Date.now }
    }],
    refundStatus: {
      type: mongoose.Schema.Types.Mixed,
      default: 'NONE',
    },
    paymentMethod: {
      type: String,
      enum: ['WALLET', 'UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER', 'UNKNOWN', 'wallet', 'upi', 'bank_transfer', 'cash', 'card', 'other', 'unknown'],
      default: 'WALLET',
    }
  },
  { timestamps: true }
);

const RechargeTransaction = mongoose.model('RechargeTransaction', rechargeTransactionSchema);
module.exports = RechargeTransaction;
