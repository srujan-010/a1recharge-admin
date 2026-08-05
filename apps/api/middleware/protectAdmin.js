const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

/**
 * Middleware to protect admin routes with JWT authentication
 * @returns {Function} Express middleware
 */
const protectAdmin = async (req, res, next) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Extract token from header
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token format'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find admin user by ID
    const admin = await AdminUser.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin user'
      });
    }

    // Check if account is active
    if (admin.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Admin account is ${admin.status.toLowerCase()}`
      });
    }

    // Attach admin to request object
    req.admin = admin;
    next();

  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = protectAdmin;