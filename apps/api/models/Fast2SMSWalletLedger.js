const mongoose = require('mongoose');

const fast2SMSWalletLedgerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['MARKETING_MSG', 'UTILITY_MSG', 'AUTH_MSG', 'TEMPLATE_MSG', 'DLT_SMS', 'CREDIT', 'DEBIT', 'REFUND'],
      default: 'MARKETING_MSG',
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
      default: 'MARKETING',
    },
    templateName: {
      type: String,
      default: 'WhatsApp Message',
    },
    campaignName: {
      type: String,
      default: null,
    },
    recipientCount: {
      type: Number,
      default: 1,
    },
    ratePerMessage: {
      type: Number,
      default: 0.95,
    },
    totalDebit: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    requestId: {
      type: String,
      default: null,
    },
    recipientList: [{
      type: String,
    }],
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING', 'REFUNDED'],
      default: 'SUCCESS',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    createdByName: {
      type: String,
      default: 'System Admin',
    },
    notes: {
      type: String,
      default: null,
    }
  },
  { timestamps: true }
);

const Fast2SMSWalletLedger = mongoose.model('Fast2SMSWalletLedger', fast2SMSWalletLedgerSchema);
module.exports = Fast2SMSWalletLedger;
