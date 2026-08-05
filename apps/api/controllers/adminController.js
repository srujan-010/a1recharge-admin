const AdminUser = require('../models/AdminUser');
const AppSettings = require('../models/AppSettings');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Auth admin & get token
// @route   POST /api/admin/login
// @access  Public
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await AdminUser.findOne({ email });

    if (admin && admin.status === 'ACTIVE' && (await bcrypt.compare(password, admin.password))) {
      
      // Update last login
      admin.lastLogin = new Date();
      admin.deviceInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };
      await admin.save();

      // Log action
      await AuditLog.create({
        adminId: admin._id,
        action: 'LOGIN',
        resource: 'AUTH',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: 'Admin logged in'
      });

      res.json({
        success: true,
        token: generateToken(admin._id),
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get App Settings
// @route   GET /api/admin/settings
// @access  Private
exports.getSettings = async (req, res) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update App Settings
// @route   PUT /api/admin/settings
// @access  Private (SUPER_ADMIN, ADMIN)
exports.updateSettings = async (req, res) => {
  try {
    let settings = await AppSettings.findOne();
    
    if (!settings) {
      settings = await AppSettings.create(req.body);
    } else {
      const oldSettings = settings.toObject();
      settings = await AppSettings.findOneAndUpdate({}, req.body, { new: true, runValidators: true });
      
      await AuditLog.create({
        adminId: req.admin._id,
        action: 'SETTINGS_CHANGE',
        resource: 'APP_SETTINGS',
        resourceId: settings._id,
        oldValue: oldSettings,
        newValue: settings.toObject(),
        description: 'Updated application settings',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
