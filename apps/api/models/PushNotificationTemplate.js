const mongoose = require('mongoose');

const pushNotificationTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['RECHARGE', 'WALLET', 'OFFERS', 'FESTIVAL', 'KYC', 'SECURITY', 'SYSTEM', 'PROMOTION', 'ANNOUNCEMENT', 'CUSTOM'],
      required: true,
      uppercase: true,
      default: 'CUSTOM',
    },
    title: {
      type: String,
      required: true,
      maxlength: 65,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 240,
      trim: true,
    },
    bannerImage: {
      type: String,
      default: null,
      trim: true,
    },
    deepLink: {
      type: String,
      default: null,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['high', 'normal'],
      default: 'normal',
    },
    ttl: {
      type: Number,
      default: 2419200, // 4 weeks in seconds
    },
    variables: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isSystemTemplate: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound Index for fast search and filtering
pushNotificationTemplateSchema.index({ category: 1, isDeleted: 1 });
pushNotificationTemplateSchema.index({ isFavorite: -1, createdAt: -1 });

const PushNotificationTemplate = mongoose.model('PushNotificationTemplate', pushNotificationTemplateSchema);
module.exports = PushNotificationTemplate;
