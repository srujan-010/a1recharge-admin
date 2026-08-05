const PlanApiService = require('../services/planapi.service');

const logger = {
  info: (...args) => console.log('[PlanApiWorker]', ...args),
  error: (...args) => console.error('[PlanApiWorker]', ...args),
};

let intervalId = null;

const start = (overrideMs = null) => {
  if (intervalId) return;

  const runSync = async () => {
    try {
      logger.info('[PlanApiWorker] Running automated PlanAPI balance & hit sync...');
      await PlanApiService.syncData('AUTOMATIC');
    } catch (err) {
      logger.error('[PlanApiWorker] Automated PlanAPI sync error:', err);
    }
  };

  // Run initial sync after 10 seconds of startup
  setTimeout(runSync, 10000);

  // Interval sync: 15 minutes by default (15 * 60 * 1000 = 900,000 ms)
  const syncInterval = overrideMs || (15 * 60 * 1000);
  intervalId = setInterval(runSync, syncInterval);
  logger.info(`[PlanApiWorker] PlanAPI sync worker started (Interval: ${syncInterval / 1000}s)`);
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[PlanApiWorker] PlanAPI sync worker stopped');
  }
};

module.exports = { start, stop };
