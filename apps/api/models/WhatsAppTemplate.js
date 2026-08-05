const mongoose = require('mongoose');

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    messageId: {
      type: Number,
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    wabaId: {
      type: String,
      default: null,
    },
    phoneNumberId: {
      type: String,
      default: null,
    },
    senderNumber: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: 'UTILITY',
      uppercase: true,
    },
    status: {
      type: String,
      default: 'Approved',
    },
    language: {
      type: String,
      default: 'en',
    },
    varCount: {
      type: Number,
      default: 0,
    },
    components: {
      type: Array,
      default: [],
    },
    headerText: {
      type: String,
      default: null,
    },
    bodyText: {
      type: String,
      default: null,
    },
    footerText: {
      type: String,
      default: null,
    },
    buttons: {
      type: Array,
      default: [],
    },
    exampleValues: {
      type: Array,
      default: [],
    },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'NONE'],
      default: 'NONE',
    },
    templateType: {
      type: String,
      default: 'TEXT',
      uppercase: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

whatsAppTemplateSchema.index({ templateName: 1, isDeleted: 1 });
whatsAppTemplateSchema.index({ category: 1, status: 1 });

const WhatsAppTemplate = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema);
module.exports = WhatsAppTemplate;
