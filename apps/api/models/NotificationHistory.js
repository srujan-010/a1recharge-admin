const mongoose = require('mongoose');

const notificationHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // null if it's a broadcast that didn't target a specific user directly in this record, though usually we store one per user
    },
    fcmToken: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    deepLink: {
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: false,
    },
    isAutomatic: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ['RECHARGE', 'WALLET', 'KYC', 'SECURITY', 'SYSTEM', 'ADMIN'],
      default: 'SYSTEM',
    },
    firebaseMessageId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'PENDING'],
      default: 'PENDING',
    },
    errorDetails: {
      type: String,
      default: null,
    },
    retries: {
      type: Number,
      default: 0,
    },
    openedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

notificationHistorySchema.index({ userId: 1, createdAt: -1 });
notificationHistorySchema.index({ status: 1 });

const NotificationHistory = mongoose.model('NotificationHistory', notificationHistorySchema);
module.exports = NotificationHistory;
