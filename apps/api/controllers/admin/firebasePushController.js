const NotificationHistory = require('../../models/NotificationHistory');
const User = require('../../models/User');
const { logAudit } = require('../../utils/auditHelper');
const { getApp } = require('../../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');

// @desc    Send FCM Push Notification with Advanced Targeting
// @route   POST /api/admin/push-notifications/send
// @access  Private (Admin)
const sendFCMNotification = async (req, res, next) => {
  try {
    const { recipients, title, body, imageUrl, deepLink, priority = 'normal', filters } = req.body;
    
    if (!title || !body || !recipients) {
      res.status(400);
      throw new Error('Title, body, and recipients are required.');
    }

    let query = { fcmToken: { $ne: null } };
    
    // Process Advanced Filters if targeting "Multiple" or "All"
    if (recipients === 'ALL' || recipients === 'MULTIPLE') {
      if (filters) {
        if (filters.state) query.state = filters.state;
        if (filters.district) query.city = filters.district; // assuming district maps to city or we have a district field
        if (filters.kycStatus) query.kycStatus = filters.kycStatus;
        if (filters.status) query.status = filters.status;
      }
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      query._id = { $in: recipients };
    } else {
      res.status(400);
      throw new Error('Invalid recipients specified or no registered devices found.');
    }

    const targetUsers = await User.find(query);

    if (targetUsers.length === 0) {
      res.status(400);
      throw new Error('No devices found matching the targeting criteria.');
    }

    const messaging = getMessaging(getApp());
    const sendResults = [];

    for (const user of targetUsers) {
      const messagePayload = {
        token: user.fcmToken,
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
        },
        data: {
          ...(deepLink && { route: deepLink }),
        },
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
        }
      };

      try {
        const response = await messaging.send(messagePayload);
        
        await NotificationHistory.create({
          userId: user._id,
          fcmToken: user.fcmToken,
          title,
          body,
          imageUrl,
          deepLink,
          priority,
          sentBy: req.admin._id,
          firebaseMessageId: response,
          status: 'DELIVERED',
        });
        
        sendResults.push({ userId: user._id, status: 'DELIVERED', messageId: response });
      } catch (err) {
        await NotificationHistory.create({
          userId: user._id,
          fcmToken: user.fcmToken,
          title,
          body,
          imageUrl,
          deepLink,
          priority,
          sentBy: req.admin._id,
          status: 'FAILED',
          errorDetails: err.message,
        });
        
        // Mark inactive if token is unregistered
        if (err.code === 'messaging/registration-token-not-registered') {
          user.fcmToken = null;
          await user.save();
        }
        
        sendResults.push({ userId: user._id, status: 'FAILED', error: err.message });
      }
    }

    await logAudit(
      req.admin, 
      'FCM_NOTIFICATION_SENT', 
      'PUSH_NOTIFICATION', 
      null, 
      { title, targetCount: targetUsers.length }, 
      req,
      targetUsers.length === 1 ? targetUsers[0]._id : null
    );

    res.status(200).json({
      success: true,
      message: `Push notification processed for ${targetUsers.length} devices.`,
      data: sendResults,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test FCM Push Notification
// @route   POST /api/admin/push-notifications/test
// @access  Private (Admin)
const testFCMNotification = async (req, res, next) => {
  try {
    const { fcmToken, title, body } = req.body;
    
    if (!fcmToken || !title || !body) {
      res.status(400);
      throw new Error('fcmToken, title, and body are required.');
    }

    const messaging = getMessaging(getApp());
    const messagePayload = {
      token: fcmToken,
      notification: { title, body },
      android: { priority: 'high' }
    };

    const response = await messaging.send(messagePayload);

    res.status(200).json({
      success: true,
      message: 'Test push sent successfully',
      firebaseResponse: response,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to send test push notification',
      error: error.message,
      code: error.code
    });
  }
};

// @desc    Get FCM Notification History
// @route   GET /api/admin/push-notifications/history
// @access  Private (Admin)
const getPushNotificationHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { source, isAutomatic, search } = req.query;

    const query = {};
    if (source && source !== 'all') {
      query.source = source.toUpperCase();
    }
    if (isAutomatic !== undefined && isAutomatic !== '') {
      query.isAutomatic = isAutomatic === 'true';
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
      ];
    }

    const history = await NotificationHistory.find(query)
      .populate('userId', 'name phone retailerId')
      .populate('sentBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const formattedHistory = history.map(item => ({
      ...item,
      sentByName: item.isAutomatic ? 'System (Automated)' : (item.sentBy ? item.sentBy.name : 'Admin')
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Registered Devices
// @route   GET /api/admin/push-notifications/device-tokens
// @access  Private (Admin)
const getDeviceTokens = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const users = await User.find({ fcmToken: { $ne: null } })
      .select('name phone retailerId fcmToken deviceModel deviceManufacturer androidVersion appVersion tokenUpdatedAt lastLogin kycStatus status')
      .sort({ tokenUpdatedAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Device Token
// @route   DELETE /api/admin/push-notifications/device-tokens/:id
// @access  Private (Admin)
const deleteDeviceToken = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    
    user.fcmToken = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Device token removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendFCMNotification,
  testFCMNotification,
  getPushNotificationHistory,
  getDeviceTokens,
  deleteDeviceToken
};
