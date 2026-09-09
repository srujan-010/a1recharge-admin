const mongoose = require('mongoose');

const manualPaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    retailerName: {
      type: String,
      required: true,
    },
    retailerPhone: {
      type: String,
      default: null,
    },
    amountPaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER', 'ADMIN_ADJUSTMENT', 'NOT_SPECIFIED', 'NOT_SET', null],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'UNPAID', 'NOT_SET'],
      default: 'PAID',
      index: true,
    },
    walletStatus: {
      type: String,
      enum: ['CREDITED', 'REVERSED'],
      default: 'CREDITED',
      index: true,
    },
    previousBalancePaise: {
      type: Number,
      default: 0,
    },
    closingBalancePaise: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RECEIVED', 'VERIFIED', 'REJECTED', 'CANCELLED', 'PAID', 'UNPAID'],
      default: 'VERIFIED',
      required: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    receivedByName: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    verifiedByName: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
    referenceNumber: {
      type: String,
      default: null,
    },
    upiTransactionId: {
      type: String,
      default: null,
    },
    utrNumber: {
      type: String,
      default: null,
      index: true,
    },
    bankReference: {
      type: String,
      default: null,
    },
    senderName: {
      type: String,
      default: null,
    },
    senderUpiId: {
      type: String,
      default: null,
    },
    receivedByPerson: {
      type: String,
      default: null, // For CASH payments: Received By
    },
    receiptReference: {
      type: String,
      default: null, // For CASH payments: Receipt/reference
    },
    notes: {
      type: String,
      default: null,
    },
    proofImage: {
      type: String,
      default: null,
    },
    walletCredited: {
      type: Boolean,
      default: false,
      index: true,
    },
    walletCreditedAt: {
      type: Date,
      default: null,
    },
    walletCreditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    walletCreditedByName: {
      type: String,
      default: null,
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    walletLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletLedger',
      default: null,
    },
    isReversed: {
      type: Boolean,
      default: false,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    reversedByName: {
      type: String,
      default: null,
    },
    reversalReason: {
      type: String,
      default: null,
    },
    reversalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    reversalLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletLedger',
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    rejectedByName: {
      type: String,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

manualPaymentSchema.index({ createdAt: -1 });
manualPaymentSchema.index({ status: 1, walletCredited: 1 });
manualPaymentSchema.index({ retailerId: 1, createdAt: -1 });

const ManualPayment = mongoose.model('ManualPayment', manualPaymentSchema);
module.exports = ManualPayment;
