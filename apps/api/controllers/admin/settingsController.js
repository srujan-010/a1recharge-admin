const AppSettings = require('../../models/AppSettings');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get Global Settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
const getSettings = async (req, res, next) => {
  try {
    let settings = await AppSettings.findOne();
    
    // If no settings document exists, create a default singleton
    if (!settings) {
      settings = await AppSettings.create({});
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Global Settings (Remote Config)
// @route   PUT /api/admin/settings
// @access  Private (Super Admin)
const updateSettings = async (req, res, next) => {
  try {
    const payload = req.body;
    
    // Find and update the singleton, creating it if it somehow doesn't exist
    const settings = await AppSettings.findOneAndUpdate(
      {}, 
      { 
        ...payload,
        updatedBy: req.admin._id 
      },
      { new: true, upsert: true, runValidators: true }
    );

    await logAudit(
      req.admin, 
      `UPDATE_APP_SETTINGS`, 
      'APP_SETTINGS', 
      null, 
      { updatedFields: Object.keys(payload) }, 
      req
    );

    res.status(200).json({
      success: true,
      message: 'Global settings updated successfully. These changes will immediately reflect in the mobile app.',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings
};
