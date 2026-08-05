const Notification = require('../../models/Notification');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Send Internal Notification (Global Broadcast)
// @route   POST /api/admin/notifications/broadcast
// @access  Private (Admin)
const sendGlobalNotification = async (req, res, next) => {
  try {
    const { title, message, category, action } = req.body;

    if (!title || !message) {
      res.status(400);
      throw new Error('Title and message are required.');
    }

    const notification = await Notification.create({
      userId: null, // null denotes a global broadcast
      type: 'IN_APP',
      title,
      message,
      category: category || 'INFO',
      priority: 'HIGH',
      action: action || null
    });

    await logAudit(
      req.admin, 
      `INTERNAL_BROADCAST_SENT`, 
      'INTERNAL_NOTIFICATION', 
      null, 
      { title, category }, 
      req
    );

    res.status(201).json({
      success: true,
      message: 'Internal notification broadcast sent successfully.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Recent Internal Broadcasts
// @route   GET /api/admin/notifications/broadcasts
// @access  Private (Admin)
const getRecentBroadcasts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const broadcasts = await Notification.find({ userId: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: broadcasts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendGlobalNotification,
  getRecentBroadcasts
};
