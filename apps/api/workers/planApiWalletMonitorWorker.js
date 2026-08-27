const planApiWalletMonitorService = require('../services/planApiWalletMonitor.service');

const logger = {
  info: (...args) => console.log('[PLANAPI WORKER]', ...args),
  error: (...args) => console.error('[PLANAPI WORKER]', ...args),
};

let fetchIntervalId = null;
let alertTickerId = null;
let lastFiredMinute = '';

/**
 * Helper to get current IST time parts (HH:MM in Asia/Kolkata)
 */
function getISTTimeParts() {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const formatted = new Intl.DateTimeFormat('en-GB', options).format(now);
  const [hours, minutes] = formatted.split(':');
  return { hours, minutes, timeString: `${hours}:${minutes}` };
}

const start = (overrideFetchMs = null) => {
  if (fetchIntervalId) return;

  // Schedule 1: 15-Minute Data Fetching Loop (24/7)
  const fetchMs = overrideFetchMs || (15 * 60 * 1000);
  const runFetch = async () => {
    try {
      await planApiWalletMonitorService.fetchAndStoreData();
    } catch (err) {
      logger.error('15-minute fetch error:', err.message);
    }
  };

  // Initial fetch 10 seconds after server startup
  setTimeout(runFetch, 10000);
  fetchIntervalId = setInterval(runFetch, fetchMs);
  logger.info(`PlanAPI 15-minute data monitor worker started (Interval: ${fetchMs / 1000}s)`);

  // Schedule 2: 1-Minute Clock Ticker for 9:00 AM & 6:00 PM IST Admin Alerts
  const checkAlertSchedule = async () => {
    try {
      const { hours, minutes, timeString } = getISTTimeParts();

      // Guard against firing multiple times within the same minute
      if (lastFiredMinute === timeString) return;

      if (hours === '09' && minutes === '00') {
        lastFiredMinute = timeString;
        logger.info('IST Clock 09:00 AM detected. Triggering Morning Low-Balance Alert check...');
        await planApiWalletMonitorService.checkScheduledAlert('MORNING');
      } else if (hours === '18' && minutes === '00') {
        lastFiredMinute = timeString;
        logger.info('IST Clock 06:00 PM detected. Triggering Evening Low-Balance Alert check...');
        await planApiWalletMonitorService.checkScheduledAlert('EVENING');
      }
    } catch (err) {
      logger.error('Scheduled alert clock ticker error:', err.message);
    }
  };

  // Run ticker check every 30 seconds
  alertTickerId = setInterval(checkAlertSchedule, 30000);
  logger.info('PlanAPI admin alert ticker started (Monitoring IST 09:00 AM & 06:00 PM alert windows)');
};

const stop = () => {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
    fetchIntervalId = null;
  }
  if (alertTickerId) {
    clearInterval(alertTickerId);
    alertTickerId = null;
  }
  logger.info('PlanAPI wallet monitor worker stopped');
};

module.exports = { start, stop };
