const mongoose = require('mongoose');

const whatsAppCampaignHistorySchema = new mongoose.Schema(
  {
    messageId: {
      type: Number,
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      default: null,
    },
    templateName: {
      type: String,
      default: null,
    },
    phoneNumberId: {
      type: String,
      default: null,
    },
    recipients: {
      type: [String],
      default: [],
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    variablesValues: {
      type: String,
      default: '',
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    documentFilename: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'PENDING', 'SENT', 'ACCEPTED', 'READ', 'QUEUED'],
      default: 'PENDING',
    },
    requestId: {
      type: String,
      default: null,
    },
    fast2smsResponse: {
      type: Object,
      default: null,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    source: {
      type: String,
      enum: ['PORTAL', 'API', 'CAMPAIGN', 'AUTOMATION', 'WEBHOOK', 'MANUAL', 'AUTOMATIC'],
      default: 'PORTAL',
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    errorDetails: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

whatsAppCampaignHistorySchema.index({ createdAt: -1 });
whatsAppCampaignHistorySchema.index({ status: 1 });

const WhatsAppCampaignHistory = mongoose.model('WhatsAppCampaignHistory', whatsAppCampaignHistorySchema);
module.exports = WhatsAppCampaignHistory;
