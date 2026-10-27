const mongoose = require('mongoose');

const recipientStatusSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
  requestId: { type: String, default: null },
  errorDetails: { type: String, default: null },
  channel: { type: String, default: 'WHATSAPP' },
  sentAt: { type: Date, default: Date.now },
}, { _id: false });

const providerAutomationLogSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    index: true,
  },
  rechargeOrderId: {
    type: String,
  },
  rechargeAmount: {
    type: Number,
    default: 0,
  },
  providerName: {
    type: String,
    default: 'A1Topup',
  },
  providerBalance: {
    type: Number,
  },
  threshold: {
    type: Number,
    default: 2000,
  },
  detectedAt: {
    type: Date,
    default: Date.now,
  },
  overallStatus: {
    type: String,
    enum: [
      'ALERT_SENT',
      'PARTIAL_SUCCESS',
      'FAILED',
      'NO_ALERT_NEEDED',
      'ERROR_SKIPPED',
      'DISABLED',
      'ALREADY_ALERTED',
      'RECOVERED'
    ],
    required: true,
  },
  triggerType: {
    type: String,
    enum: ['SCHEDULED_CHECK', 'MANUAL_CHECK', 'RECHARGE_EVENT', 'EXTERNAL_CRON'],
    default: 'SCHEDULED_CHECK',
  },
  recipientsStatus: [recipientStatusSchema],
  errorDetails: {
    type: String,
  },
  executionTimeMs: {
    type: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model('ProviderAutomationLog', providerAutomationLogSchema);
