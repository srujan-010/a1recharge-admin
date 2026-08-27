const mongoose = require('mongoose');

const planApiSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'GLOBAL_PLANAPI_SETTINGS',
      unique: true,
    },
    lowBalanceWarning: {
      type: Number,
      default: 500, // Warning threshold for balance
    },
    criticalBalance: {
      type: Number,
      default: 100, // Critical threshold for balance
    },
    lowRemainingHits: {
      type: Number,
      default: 1000, // Warning threshold for remaining API hits
    },
    criticalRemainingHits: {
      type: Number,
      default: 200, // Critical threshold for remaining API hits
    },
    enableWhatsAppAlerts: {
      type: Boolean,
      default: true,
    },
    enablePushAlerts: {
      type: Boolean,
      default: true,
    },
    enableInternalNotifications: {
      type: Boolean,
      default: true,
    },
    autoRefreshInterval: {
      type: Number,
      default: 15, // in minutes
    },
    alertRecipients: {
      type: [String],
      default: ['8275366399', '9100329521'],
    },
    alertState: {
      balanceAlertSent: {
        type: Boolean,
        default: false,
      },
      hitAlertSent: {
        type: Boolean,
        default: false,
      },
      lastBalanceAlertAt: {
        type: Date,
        default: null,
      },
      lastHitAlertAt: {
        type: Date,
        default: null,
      },
      fast2smsAlertSent: {
        type: Boolean,
        default: false,
      },
      lastFast2smsAlertAt: {
        type: Date,
        default: null,
      },
      lastFast2smsAlertBalance: {
        type: Number,
        default: null,
      }
    }
  },
  { timestamps: true }
);

const PlanApiSettings = mongoose.model('PlanApiSettings', planApiSettingsSchema);
module.exports = PlanApiSettings;
