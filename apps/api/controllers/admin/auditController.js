const AuditLog = require('../../models/AuditLog');

// @desc    Get Paginated Audit Logs
// @route   GET /api/admin/audit-logs
// @access  Private (Super Admin Only)
const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const module = req.query.module; // Optional filter

    const query = {};
    if (module && module !== 'ALL') {
      query.module = module;
    }

    const startIndex = (page - 1) * limit;
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate('adminId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
