const providerAutomationService = require('../services/providerAutomation.service');

const logger = {
  info: (...args) => console.log('[A1TOPUP MONITOR WORKER]', ...args),
  error: (...args) => console.error('[A1TOPUP MONITOR WORKER ERROR]', ...args),
};

let intervalId = null;

/**
 * Start the 5-minute A1Topup Wallet Balance Monitor Worker
 * Executes independently of any frontend or browser activity.
 */
const start = (overrideMinutes = null) => {
  if (intervalId) {
    logger.info('Worker is already running. Skipping duplicate startup.');
    return;
  }

  const intervalMinutes = overrideMinutes || parseInt(process.env.A1TOPUP_WALLET_CHECK_INTERVAL_MINUTES || '5', 10);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  const runCheck = async () => {
    try {
      await providerAutomationService.checkBalanceAndAlert({
        triggerType: 'SCHEDULED_CHECK',
      });
    } catch (err) {
      logger.error('Scheduled balance check execution error:', err.message);
    }
  };

  // Initial check 15 seconds after server boot to allow DB connection to stabilize
  setTimeout(runCheck, 15000);

  // Periodic interval execution (every 5 minutes by default)
  intervalId = setInterval(runCheck, intervalMs);
  logger.info(`A1Topup low-wallet balance monitor started (Interval: ${intervalMinutes} minutes)`);
};

/**
 * Stop the worker gracefully
 */
const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('A1Topup low-wallet balance monitor stopped');
  }
};

module.exports = { start, stop };
