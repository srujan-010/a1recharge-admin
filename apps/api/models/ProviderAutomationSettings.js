const mongoose = require('mongoose');

const recipientDeliverySchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
  requestId: { type: String, default: null },
  errorDetails: { type: String, default: null },
  channel: { type: String, default: 'WHATSAPP' },
  sentAt: { type: Date, default: Date.now },
}, { _id: false });

const providerAutomationSettingsSchema = new mongoose.Schema({
  automationKey: {
    type: String,
    default: 'a1topup_low_balance',
    unique: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  providerName: {
    type: String,
    default: 'A1Topup',
  },
  threshold: {
    type: Number,
    default: 2000,
  },
  recipients: {
    type: [String],
    default: ['8275366399', '9100329521'],
  },
  channel: {
    type: String,
    enum: ['WHATSAPP', 'SMS'],
    default: 'WHATSAPP',
  },
  templateName: {
    type: String,
    default: 'provider_wallet_low_balance',
  },
  messageId: {
    type: Number,
    default: 27147,
  },
  phoneNumberId: {
    type: String,
    default: '1294250930429862',
  },
  checkIntervalMinutes: {
    type: Number,
    default: 5,
  },
  monitoringStatus: {
    type: String,
    enum: ['ACTIVE', 'DISABLED', 'ERROR', 'CHECKING'],
    default: 'ACTIVE',
  },
  alertSent: {
    type: Boolean,
    default: false,
  },
  deliveredRecipients: {
    type: [String],
    default: [],
  },
  lastCheckAt: {
    type: Date,
  },
  lastSuccessfulCheckAt: {
    type: Date,
  },
  nextCheckAt: {
    type: Date,
  },
  lastAlertAt: {
    type: Date,
  },
  lastAlertBalance: {
    type: Number,
  },
  lastBalance: {
    type: Number,
  },
  lastStatus: {
    type: String,
    enum: ['NORMAL', 'LOW_BALANCE', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  lastCheckError: {
    type: String,
    default: null,
  },
  lastMessagingError: {
    type: String,
    default: null,
  },
  lastRecipientsStatus: [recipientDeliverySchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('ProviderAutomationSettings', providerAutomationSettingsSchema);
