const AdminUser = require('../models/AdminUser');

/**
 * Middleware to authorize access based on user roles
 * @param  {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Ensure protectAdmin ran first
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user's role is in allowed roles
      // SUPER_ADMIN has access to everything
      const { role } = req.admin;

      if (role === 'SUPER_ADMIN' || allowedRoles.includes(role)) {
        return next();
      }

      // Role not authorized
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required one of: ${allowedRoles.join(', ')}`
      });

    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

module.exports = authorize;