const WhatsAppCampaignHistory = require('../models/WhatsAppCampaignHistory');
const fast2smsWhatsAppService = require('../services/fast2smsWhatsApp.service');

class WhatsAppStatusWorker {
  constructor() {
    this.intervalMs = 120000; // 2 minutes
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[WhatsAppWorker] Background Status Poller started (Interval: 120000ms)');

    // Initial check after 10s
    setTimeout(() => this.pollPendingStatuses(), 10000);

    this.timer = setInterval(() => {
      this.pollPendingStatuses().catch(err => {
        console.warn('[WhatsAppWorker] Polling error:', err.message);
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[WhatsAppWorker] Background Status Poller stopped');
  }

  async pollPendingStatuses() {
    try {
      // Find pending campaign logs from the last 24 hours with a valid requestId
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingLogs = await WhatsAppCampaignHistory.find({
        requestId: { $ne: null, $exists: true },
        status: { $in: ['PENDING', 'ACCEPTED', 'QUEUED'] },
        createdAt: { $gte: cutoff },
      }).limit(50);

      if (pendingLogs.length === 0) return;

      console.log(`[WhatsAppWorker] Checking live status for ${pendingLogs.length} pending campaign logs...`);

      for (const log of pendingLogs) {
        try {
          const report = await fast2smsWhatsAppService.getDeliveryReport(log.requestId);
          if (report && (report.success || report.return !== false)) {
            const rawStatus = (report.status || report.data?.status || '').toUpperCase();
            
            let finalStatus = log.status;
            if (rawStatus.includes('DELIVERED') || rawStatus === 'DELIVERED') {
              finalStatus = 'DELIVERED';
            } else if (rawStatus.includes('READ') || rawStatus === 'READ') {
              finalStatus = 'READ';
            } else if (rawStatus.includes('FAILED') || rawStatus === 'FAILED') {
              finalStatus = 'FAILED';
            } else if (rawStatus.includes('ACCEPTED') || rawStatus === 'ACCEPTED') {
              finalStatus = 'ACCEPTED';
            }

            if (finalStatus !== log.status) {
              log.status = finalStatus;
              if (finalStatus === 'DELIVERED' || finalStatus === 'READ') {
                log.sentCount = log.recipientCount;
                log.failedCount = 0;
              } else if (finalStatus === 'FAILED') {
                log.failedCount = log.recipientCount;
                log.errorDetails = report.error || report.message || 'Delivery failed';
              }
              await log.save();
              console.log(`[WhatsAppWorker] Updated request_id=${log.requestId} status to "${finalStatus}"`);
            }
          }
        } catch (err) {
          console.warn(`[WhatsAppWorker] Failed checking request_id=${log.requestId}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[WhatsAppWorker] Worker execution error:', error.message);
    }
  }
}

module.exports = new WhatsAppStatusWorker();
