const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT', 'KYC', 'OPERATIONS', 'AUDITOR'],
    default: 'SUPPORT'
  },
  permissions: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  lastLogin: {
    type: Date
  },
  deviceInfo: {
    browser: String,
    os: String,
    ip: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  }
}, {
  timestamps: true
});

// Remove sensitive info from JSON output
adminUserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
