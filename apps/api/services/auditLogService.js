const { logger } = require('../utils/logger');

// Create an audit log entry
async function createAuditLog(entry) {
  try {
    const auditEntry = {
      action: entry.action,
      timestamp: new Date(entry.timestamp || Date.now()),
      userId: entry.userId,
      details: entry.details,
      affectedEntity: entry.affectedEntity,
      affectedEntityId: entry.affectedEntityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress || entry.ip || 'unknown',
      userAgent: entry.userAgent || entry.user_agent || 'unknown',
    };

    // TODO: Save to MongoDB or log to file
    logger.info('AUDIT_LOG', auditEntry);
    return auditEntry;
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    throw error;
  }
}

module.exports = { createAuditLog };