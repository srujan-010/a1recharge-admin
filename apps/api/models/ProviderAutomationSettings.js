const mongoose = require('mongoose');

const recipientDeliverySchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
  requestId: { type: String, default: null },
  errorDetails: { type: String, default: null },
  channel: { type: String, default: 'WHATSAPP' },
  sentAt: { type: Date, default: Date.now },
}, { _id: false });

const thresholdAlertItemSchema = new mongoose.Schema({
  alertSent: { type: Boolean, default: false },
  lastAlertAt: { type: Date, default: null },
  lastAlertBalance: { type: Number, default: null },
  deliveredRecipients: { type: [String], default: [] },
  recipientsStatus: [recipientDeliverySchema],
  messageId: { type: Number, required: true },
  templateId: { type: String, required: true },
  templateName: { type: String, required: true },
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
  recipients: {
    type: [String],
    default: ['8275366399', '9100329521'],
  },
  channel: {
    type: String,
    enum: ['WHATSAPP', 'SMS'],
    default: 'WHATSAPP',
  },
  phoneNumberId: {
    type: String,
    default: '1294250930429862',
  },
  minRefreshSeconds: {
    type: Number,
    default: 60,
  },
  reconcileIntervalMinutes: {
    type: Number,
    default: 15,
  },
  monitoringStatus: {
    type: String,
    enum: ['ACTIVE', 'DISABLED', 'ERROR', 'CHECKING'],
    default: 'ACTIVE',
  },
  currentThresholdState: {
    type: String,
    enum: ['NORMAL', 'LOW_2000', 'LOW_1000', 'CRITICAL_500', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  isRecovered: {
    type: Boolean,
    default: true,
  },
  lastRecoveredAt: {
    type: Date,
    default: null,
  },
  thresholdAlerts: {
    LOW_2000: {
      type: thresholdAlertItemSchema,
      default: () => ({
        alertSent: false,
        messageId: 40230,
        templateId: process.env.PROVIDER_WALLET_TEMPLATE_2000_TEMPLATE_ID || '165519901612689',
        templateName: 'provider_wallet_low_balance_2000',
        deliveredRecipients: [],
      }),
    },
    LOW_1000: {
      type: thresholdAlertItemSchema,
      default: () => ({
        alertSent: false,
        messageId: 40235,
        templateId: process.env.PROVIDER_WALLET_TEMPLATE_1000_TEMPLATE_ID || '112150956740956',
        templateName: 'provider_wallet_low_balance_1000',
        deliveredRecipients: [],
      }),
    },
    CRITICAL_500: {
      type: thresholdAlertItemSchema,
      default: () => ({
        alertSent: false,
        messageId: 40237,
        templateId: process.env.PROVIDER_WALLET_TEMPLATE_500_TEMPLATE_ID || '193212102821660',
        templateName: 'provider_wallet_critical_balance_500',
        deliveredRecipients: [],
      }),
    },
  },
  lastBalance: {
    type: Number,
    default: null,
  },
  lastCheckAt: {
    type: Date,
  },
  lastSuccessfulCheckAt: {
    type: Date,
  },
  nextReconcileAt: {
    type: Date,
  },
  lastAlertAt: {
    type: Date,
  },
  lastAlertLevel: {
    type: String,
    enum: ['LOW_2000', 'LOW_1000', 'CRITICAL_500', null],
    default: null,
  },
  lastAlertBalance: {
    type: Number,
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
  
  // Distributed lock for single-instance reconciliation worker
  reconcileLockUntil: {
    type: Date,
    default: null,
  },
  reconcileLockedBy: {
    type: String,
    default: null,
  },

  // Backward-compatibility legacy fields
  threshold: {
    type: Number,
    default: 2000,
  },
  alertSent: {
    type: Boolean,
    default: false,
  },
  deliveredRecipients: {
    type: [String],
    default: [],
  },
  checkIntervalMinutes: {
    type: Number,
    default: 15,
  },
  lastStatus: {
    type: String,
    enum: ['NORMAL', 'LOW_BALANCE', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  templateName: {
    type: String,
    default: 'provider_wallet_low_balance_2000',
  },
  messageId: {
    type: Number,
    default: 40230,
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('ProviderAutomationSettings', providerAutomationSettingsSchema);
