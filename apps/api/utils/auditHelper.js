const AuditLog = require('../models/AuditLog');

/**
 * Logs administrative actions to the database.
 * 
 * @param {Object} adminUser - The req.admin object
 * @param {String} action - E.g., 'UPDATE_SETTINGS', 'SUSPEND_RETAILER'
 * @param {String} module - E.g., 'SETTINGS', 'RETAILER', 'WALLET'
 * @param {Object} oldValue - JSON object of previous state
 * @param {Object} newValue - JSON object of new state
 * @param {Object} req - The Express request object to extract IP and UserAgent
 */
const logAudit = async (adminUser, action, moduleName, oldValue, newValue, req, resourceId = null) => {
  try {
    if (!adminUser || !adminUser._id) {
      console.warn('[AuditLog] Skipping audit log: adminUser missing');
      return;
    }
    const ipAddress = req ? (req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.connection && req.connection.remoteAddress) || 'Unknown') : 'Unknown';
    const userAgent = req && req.headers ? (req.headers['user-agent'] || 'Unknown') : 'Unknown';

    const resource = moduleName || 'SYSTEM';

    await AuditLog.create({
      adminId: adminUser._id,
      action,
      resource,
      ...(resourceId && { resourceId }),
      oldValue: oldValue ? (typeof oldValue === 'object' ? oldValue : { value: oldValue }) : null,
      newValue: newValue ? (typeof newValue === 'object' ? newValue : { value: newValue }) : null,
      ipAddress,
      userAgent
    });
    console.log(`[AuditLog] ${adminUser.name || adminUser._id} performed ${action} on ${resource}`);
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error.message);
    // Deliberately not throwing so we never crash the main operation
  }
};

module.exports = { logAudit };
