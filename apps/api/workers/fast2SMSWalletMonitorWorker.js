const fast2SMSWalletMonitorService = require('../services/fast2SMSWalletMonitor.service');

const logger = {
  info: (...args) => console.log('[FAST2SMS MONITOR]', ...args),
  error: (...args) => console.error('[FAST2SMS MONITOR]', ...args),
};

let intervalId = null;

const start = (overrideMinutes = null) => {
  if (intervalId) return;

  const intervalMinutes = overrideMinutes || parseInt(process.env.FAST2SMS_CHECK_INTERVAL_MINUTES || '10', 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  const runCheck = async () => {
    try {
      await fast2SMSWalletMonitorService.checkBalanceAndAlert();
    } catch (err) {
      logger.error('Monitor worker execution error:', err.message);
    }
  };

  // Run initial check 20 seconds after server startup
  setTimeout(runCheck, 20000);

  // Interval execution (e.g. every 10 minutes)
  intervalId = setInterval(runCheck, intervalMs);
  logger.info(`Fast2SMS wallet balance monitor worker started (Check interval: ${intervalMinutes} minutes)`);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Fast2SMS wallet balance monitor worker stopped');
  }
};

module.exports = { start, stop };
