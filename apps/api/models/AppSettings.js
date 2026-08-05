const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
  appName: { type: String, default: 'A1 Recharge' },
  supportNumber: { type: String, default: '+91 00000 00000' },
  whatsappNumber: { type: String, default: '+91 00000 00000' },
  supportEmail: { type: String, default: 'support@a1recharge.com' },
  
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'We are currently under maintenance. Please try again later.' },
  
  minimumRecharge: { type: Number, default: 10 },
  maximumRecharge: { type: Number, default: 10000 },
  
  features: {
    bbps: { type: Boolean, default: true },
    aeps: { type: Boolean, default: false },
    dmt: { type: Boolean, default: false },
    insurance: { type: Boolean, default: false },
    pan: { type: Boolean, default: false }
  },

  banners: [{
    imageUrl: String,
    link: String,
    isActive: { type: Boolean, default: true }
  }],
  
  carouselImages: [{
    imageUrl: String,
    link: String,
    isActive: { type: Boolean, default: true }
  }],

  appVersion: {
    latestVersion: { type: String, default: '1.0.0' },
    minimumSupportedVersion: { type: String, default: '1.0.0' },
    forceUpdate: { type: Boolean, default: false },
    playStoreUrl: { type: String, default: '' }
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);
