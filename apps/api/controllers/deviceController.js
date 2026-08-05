const User = require('../models/User');

// @desc    Register or update device FCM token
// @route   POST /api/device/register
// @access  Private
const registerDevice = async (req, res, next) => {
  try {
    const { fcmToken, deviceModel, deviceManufacturer, androidVersion, appVersion } = req.body;

    if (!fcmToken) {
      res.status(400);
      throw new Error('FCM Token is required');
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.fcmToken = fcmToken;
    user.tokenUpdatedAt = new Date();
    
    if (deviceModel) user.deviceModel = deviceModel;
    if (deviceManufacturer) user.deviceManufacturer = deviceManufacturer;
    if (androidVersion) user.androidVersion = androidVersion;
    if (appVersion) user.appVersion = appVersion;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Device registered successfully for push notifications',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerDevice,
};
