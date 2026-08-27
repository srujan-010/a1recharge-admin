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

// @desc    Send Direct SMS Notification to Retailer
// @route   POST /api/admin/notifications/send-sms
// @access  Private (Admin)
const sendDirectSMS = async (req, res, next) => {
  try {
    const { userId, phone, message } = req.body;

    if (!message || (!phone && !userId)) {
      res.status(400);
      throw new Error('Message and recipient phone or userId are required.');
    }

    let targetPhone = phone;
    let targetUserId = userId || null;

    if (!targetPhone && userId) {
      const User = require('../../models/User');
      const user = await User.findById(userId).lean();
      if (user) targetPhone = user.phone;
    }

    if (!targetPhone) {
      res.status(400);
      throw new Error('Valid recipient phone number is required.');
    }

    const notification = await Notification.create({
      userId: targetUserId,
      type: 'SMS',
      title: 'Direct Admin SMS',
      message,
      category: 'INFO',
      priority: 'HIGH',
    });

    await logAudit(
      req.admin,
      'DIRECT_SMS_SENT',
      'SMS_NOTIFICATION',
      targetUserId,
      { phone: targetPhone, message: message.substring(0, 50) },
      req,
      targetUserId
    );

    res.status(200).json({
      success: true,
      message: `Direct SMS sent successfully to ${targetPhone}.`,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendGlobalNotification,
  getRecentBroadcasts,
  sendDirectSMS,
};
