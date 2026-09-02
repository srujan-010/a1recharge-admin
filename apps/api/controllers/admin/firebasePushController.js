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
    
    // Process Advanced Filters if targeting "MULTIPLE" or "ALL"
    if (recipients === 'ALL' || recipients === 'MULTIPLE') {
      if (filters) {
        if (filters.state) query.state = filters.state;
        if (filters.district) query.city = filters.district;
        if (filters.kycStatus) query.kycStatus = filters.kycStatus;
        if (filters.status) query.status = filters.status;
      }
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      query._id = { $in: recipients };
    } else {
      res.status(400);
      throw new Error('Invalid recipients specified or no registered devices found.');
    }

    const targetUsers = await User.find(query).select('_id name phone retailerId fcmToken');

    if (targetUsers.length === 0) {
      res.status(400);
      throw new Error('No devices found matching the targeting criteria.');
    }

    const app = getApp();
    if (!app) {
      return res.status(400).json({
        success: false,
        total: targetUsers.length,
        sent: 0,
        failed: targetUsers.length,
        message: 'Firebase Admin SDK is not configured. Please supply service-account.json or FIREBASE_SERVICE_ACCOUNT environment variable.',
        data: targetUsers.map(u => ({ userId: u._id, status: 'FAILED', error: 'Firebase Admin SDK not initialized' }))
      });
    }

    const messaging = getMessaging(app);
    const sendResults = [];
    let sentCount = 0;
    let failedCount = 0;
    let deactivatedTokensCount = 0;

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
        sentCount++;
        
        await NotificationHistory.create({
          userId: user._id,
          fcmToken: user.fcmToken,
          title,
          body,
          imageUrl,
          deepLink,
          priority,
          sentBy: req.admin ? req.admin._id : null,
          firebaseMessageId: response,
          status: 'DELIVERED',
        });
        
        sendResults.push({ userId: user._id, status: 'SENT', messageId: response });
      } catch (err) {
        failedCount++;
        const isInvalidToken = (
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-argument' ||
          (err.message && (
            err.message.includes('not-registered') ||
            err.message.includes('not found') ||
            err.message.includes('INVALID_ARGUMENT') ||
            err.message.includes('UNREGISTERED') ||
            err.message.includes('not a valid FCM') ||
            err.message.includes('invalid')
          ))
        );

        let safeError = err.message || 'Firebase delivery error';

        if (isInvalidToken) {
          safeError = 'FCM token invalid or unregistered (automatically deactivated)';
          try {
            await User.updateOne({ _id: user._id }, { $set: { fcmToken: null } });
            deactivatedTokensCount++;
          } catch (dbErr) {
            console.error(`[FCM] Failed to deactivate stale token for user ${user._id}:`, dbErr.message);
          }
        }

        await NotificationHistory.create({
          userId: user._id,
          fcmToken: user.fcmToken,
          title,
          body,
          imageUrl,
          deepLink,
          priority,
          sentBy: req.admin ? req.admin._id : null,
          status: 'FAILED',
          errorDetails: safeError,
        });
        
        sendResults.push({ userId: user._id, status: 'FAILED', error: safeError });
      }
    }

    console.log(`[FCM Push Summary] Total: ${targetUsers.length} | Sent: ${sentCount} | Failed: ${failedCount} | Deactivated Tokens: ${deactivatedTokensCount}`);

    await logAudit(
      req.admin, 
      'FCM_NOTIFICATION_SENT', 
      'PUSH_NOTIFICATION', 
      null, 
      { title, total: targetUsers.length, sent: sentCount, failed: failedCount }, 
      req,
      targetUsers.length === 1 ? targetUsers[0]._id : null
    );

    const isSuccess = sentCount > 0;
    const responseMessage = isSuccess
      ? `Push notification processed (${sentCount} sent, ${failedCount} failed).`
      : 'All push notifications failed.';

    return res.status(200).json({
      success: isSuccess,
      total: targetUsers.length,
      sent: sentCount,
      failed: failedCount,
      message: responseMessage,
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
