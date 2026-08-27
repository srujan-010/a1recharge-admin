const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    retailerId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['retailer', 'distributor', 'admin'],
      default: 'retailer',
    },
    accountType: {
      type: String,
      enum: ['PERSONAL', 'BUSINESS'],
      default: 'PERSONAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'blocked'],
      default: 'active',
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', null],
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    // Shop / business details
    shopName: {
      type: String,
      trim: true,
      default: null,
    },
    shopAddress: {
      type: String,
      trim: true,
      default: null,
    },
    city: {
      type: String,
      trim: true,
      default: null,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },
    pincode: {
      type: String,
      trim: true,
      default: null,
    },
    aadhaarNumber: {
      type: String,
      trim: true,
      default: null,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    mpinHash: {
      type: String,
      required: false,
    },
    mpinCreatedAt: {
      type: Date,
    },
    mpinUpdatedAt: {
      type: Date,
    },
    failedMpinAttempts: {
      type: Number,
      default: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastMpinAttempt: {
      type: Date,
    },
    lockUntil: {
      type: Date,
    },
    lockReason: {
      type: String,
      default: null,
    },
    lockTime: {
      type: Date,
      default: null,
    },
    kycStatus: {
      type: String,
      enum: ['notStarted', 'pending', 'verified', 'rejected'],
      default: 'notStarted',
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      default: null,
    },
    lastLogin: {
      type: Date,
    },
    recentContacts: [
      {
        phone: { type: String, required: true },
        operatorId: { type: String, required: true },
        circle: { type: String, required: true },
        contactName: { type: String, default: null },
        lastRechargeDate: { type: Date, required: true },
        lastRechargeAmountPaise: { type: Number, required: true },
        rechargeCount: { type: Number, default: 1 },
      }
    ],
    // Push Notification & Device Fields
    fcmToken: {
      type: String,
      default: null,
    },
    tokenUpdatedAt: {
      type: Date,
      default: null,
    },
    deviceModel: {
      type: String,
      default: null,
    },
    deviceManufacturer: {
      type: String,
      default: null,
    },
    androidVersion: {
      type: String,
      default: null,
    },
    appVersion: {
      type: String,
      default: null,
    },
    notificationEnabled: {
      type: Boolean,
      default: true,
    },
    notificationPreferences: {
      rechargeNotifications: { type: Boolean, default: true },
      walletNotifications: { type: Boolean, default: true },
      promotionalNotifications: { type: Boolean, default: true },
      kycNotifications: { type: Boolean, default: true },
      systemNotifications: { type: Boolean, default: true },
      securityNotifications: { type: Boolean, default: true },
    },
    lastNotificationReceived: {
      type: Date,
      default: null,
    },
    lastNotificationOpened: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Method to verify MPIN
userSchema.methods.matchMpin = async function (enteredMpin) {
  // Check if account is locked
  if (this.lockUntil && this.lockUntil > Date.now()) {
    throw new Error('Account locked due to too many failed attempts. Try again later.');
  }

  let isMatch = false;
  if (!this.mpinHash) {
    throw new Error('MPIN not configured for this user');
  } else {
    isMatch = await bcrypt.compare(enteredMpin, this.mpinHash);
  }

  if (isMatch) {
    // Reset failed attempts on success
    this.failedMpinAttempts = 0;
    this.failedLoginAttempts = 0;
    this.lockUntil = undefined;
    this.lockReason = undefined;
    this.lockTime = undefined;
    await this.save();
    return true;
  } else {
    // Increment failed attempts
    this.failedMpinAttempts += 1;
    this.lastMpinAttempt = Date.now();
    
    // Lock for 15 minutes if 5 failed attempts
    if (this.failedMpinAttempts >= 5) {
      this.lockUntil = Date.now() + 15 * 60 * 1000;
      this.lockReason = 'Too many failed MPIN attempts';
      this.lockTime = new Date();
    }
    await this.save();
    return false;
  }
};

// Safe client-facing representation (no hashes, masked PII).
userSchema.methods.toSafeJSON = function toSafeJSON() {
  const mask = (v) => {
    if (!v) return null;
    return v.length > 4 ? `XXXX${v.slice(-4)}` : v;
  };
  const isLocked = !!(this.lockUntil && new Date(this.lockUntil) > new Date());
  return {
    id: this._id,
    retailerId: this.retailerId,
    name: this.name,
    phone: this.phone,
    email: this.email,
    dob: this.dob,
    gender: this.gender,
    avatarUrl: this.avatarUrl,
    shopName: this.shopName,
    shopAddress: this.shopAddress,
    city: this.city,
    state: this.state,
    pincode: this.pincode,
    aadhaarNumber: mask(this.aadhaarNumber),
    panNumber: mask(this.panNumber),
    gstNumber: this.gstNumber ? mask(this.gstNumber) : null,
    kycStatus: this.kycStatus,
    accountType: (this.accountType && ['PERSONAL', 'BUSINESS'].includes(this.accountType.toUpperCase()))
      ? this.accountType.toUpperCase()
      : ((this.shopName || this.businessType || this.gstNumber) ? 'BUSINESS' : 'PERSONAL'),
    isOnboarded: this.isOnboarded,
    isVerified: this.isVerified,
    hasMpin: !!this.mpinHash,
    commissionProfileId: this.commissionProfileId,
    recentContacts: this.recentContacts || [],
    createdAt: this.createdAt,
    // Device info
    fcmToken: this.fcmToken,
    tokenUpdatedAt: this.tokenUpdatedAt,
    deviceModel: this.deviceModel,
    deviceManufacturer: this.deviceManufacturer,
    androidVersion: this.androidVersion,
    appVersion: this.appVersion,
    notificationEnabled: this.notificationEnabled,
    // Lock Info
    isLocked,
    lockUntil: this.lockUntil || null,
    lockReason: this.lockReason || (isLocked ? 'Too many failed OTP attempts' : null),
    lockTime: this.lockTime || null,
    failedMpinAttempts: this.failedMpinAttempts || 0,
    failedLoginAttempts: this.failedLoginAttempts || 0,
  };
};

const User = mongoose.model('User', userSchema);
module.exports = User;
