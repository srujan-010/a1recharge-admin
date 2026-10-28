const providerAutomationService = require('../services/providerAutomation.service');

const logger = {
  info: (...args) => console.log('[A1TOPUP RECONCILIATION WORKER]', ...args),
  error: (...args) => console.error('[A1TOPUP RECONCILIATION WORKER ERROR]', ...args),
};

let intervalId = null;

/**
 * Start the 15-minute A1Topup Wallet Reconciliation Fallback Worker.
 * Event-driven recharges handle real-time balance checks;
 * this fallback reconciliation catches manual adjustments, bank deductions, or missed events.
 * Uses distributed locking to ensure only one instance executes across multi-instance clusters.
 */
const start = (overrideMinutes = null) => {
  if (intervalId) {
    logger.info('Reconciliation worker is already running. Skipping duplicate startup.');
    return;
  }

  const reconcileMinutes = overrideMinutes || parseInt(
    process.env.PROVIDER_WALLET_BALANCE_RECONCILE_MINUTES ||
    process.env.A1TOPUP_WALLET_CHECK_INTERVAL_MINUTES ||
    '15',
    10
  );
  const intervalMs = Math.max(1, reconcileMinutes) * 60 * 1000;

  const runReconciliation = async () => {
    try {
      await providerAutomationService.runReconciliation();
    } catch (err) {
      logger.error('Fallback reconciliation execution error:', err.message);
    }
  };

  // Initial check 15 seconds after server boot to allow MongoDB connection to stabilize
  setTimeout(runReconciliation, 15000);

  // Periodic interval execution (default every 15 minutes)
  intervalId = setInterval(runReconciliation, intervalMs);
  logger.info(`A1Topup wallet fallback reconciliation worker started (Interval: ${reconcileMinutes} minutes)`);
};

/**
 * Stop the worker gracefully
 */
const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('A1Topup wallet fallback reconciliation worker stopped');
  }
};

module.exports = { start, stop };
