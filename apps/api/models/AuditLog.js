const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'APPROVE', 'REJECT', 
      'SETTINGS_CHANGE', 'FCM_NOTIFICATION_SENT', 'CREATE_ADMIN', 'UPDATE_ADMIN', 
      'SUSPEND_RETAILER', 'ACCOUNT_UNLOCKED', 'WALLET_ADJUSTMENT', 'UPDATE_SETTINGS', 'TOGGLE_OPERATOR', 
      'UPDATE_PROVIDER', 'REPLY_TICKET', 'PUSH_NOTIFICATION', 'SYSTEM_ACTION', 'RECHARGE_EXECUTED', 'RECHARGE_FAILED',
      'CREATE_WHATSAPP_TEMPLATE', 'UPDATE_WHATSAPP_TEMPLATE', 'DELETE_WHATSAPP_TEMPLATE', 
      'DUPLICATE_WHATSAPP_TEMPLATE', 'SYNC_WHATSAPP_TEMPLATES', 'SEND_WHATSAPP_CAMPAIGN',
      'PLANAPI_REFRESH', 'PLANAPI_AUTO_SYNC', 'PLANAPI_SETTINGS_UPDATED', 'PLANAPI_ALERT_SENT'
    ]
  },
  resource: {
    type: String,
    required: true // e.g., 'RETAILER', 'WALLET', 'APP_SETTINGS', 'COMMISSION_PROFILE'
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId // ID of the entity that was modified
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed // JSON snapshot before change
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed // JSON snapshot after change
  },
  description: {
    type: String // Human readable description e.g., "Updated Support Number"
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Index for fast querying by admin or resource
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
