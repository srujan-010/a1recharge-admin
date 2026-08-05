const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.admin = await AdminUser.findById(decoded.id).select('-password');
      
      if (!req.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
      }

      if (req.admin.status !== 'ACTIVE') {
        return res.status(401).json({ success: false, message: 'Account is suspended or inactive' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.admin || (!roles.includes(req.admin.role) && req.admin.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: `User role ${req.admin?.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protectAdmin, authorize };
