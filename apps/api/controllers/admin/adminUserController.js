const AdminUser = require('../../models/AdminUser');
const { logAudit } = require('../../utils/auditHelper');
const bcrypt = require('bcryptjs');

// @desc    Get all admin users
// @route   GET /api/admin/users
// @access  Private (SUPER_ADMIN)
const getAdminUsers = async (req, res, next) => {
  try {
    const admins = await AdminUser.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new admin user
// @route   POST /api/admin/users
// @access  Private (SUPER_ADMIN)
const createAdminUser = async (req, res, next) => {
  try {
    const { name, email, password, role, status } = req.body;

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('Admin with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = await AdminUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      status: status || 'ACTIVE',
      createdBy: req.admin._id
    });

    await logAudit(req.admin, 'CREATE_ADMIN', 'ADMIN_USER', {}, { targetEmail: email, role }, req);

    res.status(201).json({
      success: true,
      data: newAdmin
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update admin user status or role
// @route   PUT /api/admin/users/:id
// @access  Private (SUPER_ADMIN)
const updateAdminUser = async (req, res, next) => {
  try {
    const { role, status } = req.body;
    const admin = await AdminUser.findById(req.params.id);

    if (!admin) {
      res.status(404);
      throw new Error('Admin user not found');
    }

    // Prevent self-demotion or self-suspension
    if (admin._id.toString() === req.admin._id.toString() && (status === 'SUSPENDED' || role !== 'SUPER_ADMIN')) {
      res.status(403);
      throw new Error('You cannot demote or suspend your own account.');
    }

    const oldData = { role: admin.role, status: admin.status };
    
    if (role) admin.role = role;
    if (status) admin.status = status;

    await admin.save();

    await logAudit(req.admin, 'UPDATE_ADMIN', 'ADMIN_USER', oldData, { role: admin.role, status: admin.status, targetId: admin._id }, req);

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminUsers,
  createAdminUser,
  updateAdminUser
};
