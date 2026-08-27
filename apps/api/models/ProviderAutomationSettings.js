const mongoose = require('mongoose');

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
    default: 500,
  },
  recipients: {
    type: [String],
    default: ['9100329521', '8275366399'],
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
  lastCheckAt: {
    type: Date,
  },
  lastAlertAt: {
    type: Date,
  },
  lastBalance: {
    type: Number,
  },
  lastStatus: {
    type: String,
    enum: ['NORMAL', 'LOW_BALANCE', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('ProviderAutomationSettings', providerAutomationSettingsSchema);
