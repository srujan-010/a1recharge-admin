const mongoose = require('mongoose');

const planApiSyncLogSchema = new mongoose.Schema(
  {
    balance: {
      type: Number,
      default: 0,
    },
    remainingHits: {
      type: Number,
      default: 0,
    },
    responseTime: {
      type: Number, // milliseconds
      default: 0,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'OFFLINE'],
      required: true,
      default: 'SUCCESS',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
    triggeredBy: {
      type: String,
      enum: ['MANUAL', 'AUTOMATIC'],
      default: 'AUTOMATIC',
    },
    ipWhitelisted: {
      type: Boolean,
      default: true,
    },
    credentialsValid: {
      type: Boolean,
      default: true,
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    }
  },
  { timestamps: true }
);

planApiSyncLogSchema.index({ syncedAt: -1 });
planApiSyncLogSchema.index({ status: 1 });
planApiSyncLogSchema.index({ triggeredBy: 1 });

const PlanApiSyncLog = mongoose.model('PlanApiSyncLog', planApiSyncLogSchema);
module.exports = PlanApiSyncLog;
