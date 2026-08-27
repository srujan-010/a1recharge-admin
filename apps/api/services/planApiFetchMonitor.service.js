const PlanApiSettings = require('../models/PlanApiSettings');
const msg91WhatsAppService = require('./msg91WhatsApp.service');

class PlanApiFetchMonitorService {
  /**
   * Helper to fetch or initialize PlanApiSettings from MongoDB
   */
  async getSettings() {
    let settings = await PlanApiSettings.findOne({ key: 'GLOBAL_PLANAPI_SETTINGS' });
    if (!settings) {
      settings = await PlanApiSettings.create({
        key: 'GLOBAL_PLANAPI_SETTINGS',
        lowRemainingHits: 500,
        alertState: {
          hitAlertSent: false,
          lastHitAlertAt: null,
          lastAlertRemainingHits: null,
        },
      });
    }
    return settings;
  }

  /**
   * Core Monitoring Method: Evaluates remaining fetch quota against threshold (<= 500)
   * Performs atomic state transitions in MongoDB to prevent race conditions and duplicate WhatsApp alerts.
   * 
   * @param {number|string} rawRemainingFetches - Actual remaining fetch count returned by PlansAPI
   */
  async processRemainingFetches(rawRemainingFetches) {
    if (rawRemainingFetches === undefined || rawRemainingFetches === null || rawRemainingFetches === '') {
      return { processed: false, reason: 'INVALID_FETCH_COUNT' };
    }

    const remainingFetches = Number(rawRemainingFetches);
    if (isNaN(remainingFetches)) {
      return { processed: false, reason: 'NAN_FETCH_COUNT' };
    }

    const threshold = parseInt(process.env.PLANSAPI_FETCH_LOW_THRESHOLD || '500', 10);
    const alertPhone = process.env.PLANSAPI_ALERT_PHONE || '9100329521';
    const templateId = process.env.MSG91_PLANSAPI_TEMPLATE_ID || '30045';
    const templateName = process.env.MSG91_PLANSAPI_TEMPLATE_NAME || 'a1_recharge_admin_alert_plansapi';

    // 1. Evaluate NORMAL Status (> 500)
    if (remainingFetches > threshold) {
      console.log(`[PLANSAPI MONITOR] Remaining fetches: ${remainingFetches} | Threshold: ${threshold} | Status: NORMAL`);

      const settings = await this.getSettings();
      if (settings.alertState?.hitAlertSent) {
        // Atomic state recovery reset
        await PlanApiSettings.updateOne(
          { key: 'GLOBAL_PLANAPI_SETTINGS', 'alertState.hitAlertSent': true },
          {
            $set: {
              'alertState.hitAlertSent': false,
              'alertState.lastHitAlertAt': null,
              'alertState.lastAlertRemainingHits': null,
            },
          }
        );
        console.log(`[PLANSAPI MONITOR] Remaining fetches recovered above threshold (${remainingFetches} > ${threshold}). Low-limit alert state reset.`);
      }

      return { processed: true, status: 'NORMAL', remainingFetches };
    }

    // 2. Evaluate LOW Status (<= 500)
    console.log(`[PLANSAPI MONITOR] Remaining fetches: ${remainingFetches} | Threshold: ${threshold} | Status: LOW`);

    // Ensure settings document exists
    await this.getSettings();

    // Atomic State Transition: Try setting hitAlertSent = true ONLY IF currently false/missing!
    const atomicUpdate = await PlanApiSettings.findOneAndUpdate(
      {
        key: 'GLOBAL_PLANAPI_SETTINGS',
        $or: [
          { 'alertState.hitAlertSent': false },
          { 'alertState.hitAlertSent': { $exists: false } },
        ],
      },
      {
        $set: {
          'alertState.hitAlertSent': true,
          'alertState.lastHitAlertAt': new Date(),
          'alertState.lastAlertRemainingHits': remainingFetches,
        },
      },
      { returnDocument: 'after' }
    );

    // If atomicUpdate is null, hitAlertSent was ALREADY true (Duplicate Prevention)
    if (!atomicUpdate) {
      console.log(`[PLANSAPI MONITOR] Remaining fetches: ${remainingFetches} | Alert already sent for current low-limit state.`);
      return { processed: true, status: 'LOW', alertSent: false, reason: 'ALREADY_ALERTED', remainingFetches };
    }

    // State transition detected: Send WhatsApp Alert via MSG91
    console.log(`[PLANSAPI MONITOR] Alert transition detected`);
    console.log(`[PLANSAPI MONITOR] Sending admin WhatsApp alert to ${alertPhone}...`);

    try {
      const msgResult = await msg91WhatsAppService.sendTemplateMessage({
        phone: alertPhone,
        templateName: templateName,
        templateId: templateId,
        variables: {
          '1': String(remainingFetches), // Pass dynamic current remaining fetches count (e.g. "487", "500", "12")
        },
      });

      if (msgResult.success) {
        console.log(`[PLANSAPI MONITOR] WhatsApp alert sent successfully. Remaining fetches: ${remainingFetches}`);
        return { processed: true, status: 'LOW', alertSent: true, remainingFetches, phone: alertPhone };
      } else {
        throw new Error('MSG91 returned non-success response');
      }
    } catch (err) {
      console.error(`[PLANSAPI MONITOR ERROR] WhatsApp alert sending failed: ${err.message}. Rolling back alert state for retry.`);

      // Fail-Safe: Rollback alertState.hitAlertSent to false so next fetch/check retries
      await PlanApiSettings.updateOne(
        { key: 'GLOBAL_PLANAPI_SETTINGS' },
        { $set: { 'alertState.hitAlertSent': false } }
      ).catch(() => {});

      return { processed: true, status: 'LOW', alertSent: false, reason: 'MSG91_FAILED', error: err.message, remainingFetches };
    }
  }

  /**
   * Test Mode Endpoint Method: Send test WhatsApp alert for PlansAPI fetch limit
   */
  async sendTestFetchAlert(testFetchesInput = 487) {
    const alertPhone = process.env.PLANSAPI_ALERT_PHONE || '9100329521';
    const templateId = process.env.MSG91_PLANSAPI_TEMPLATE_ID || '30045';
    const templateName = process.env.MSG91_PLANSAPI_TEMPLATE_NAME || 'a1_recharge_admin_alert_plansapi';

    const testFetchesNum = parseInt(testFetchesInput, 10);
    const varValue = String(isNaN(testFetchesNum) ? 487 : testFetchesNum);

    console.log(`[PLANSAPI TEST MONITOR] Triggering test WhatsApp alert to ${alertPhone} with remaining fetches ${varValue}...`);

    const result = await msg91WhatsAppService.sendTemplateMessage({
      phone: alertPhone,
      templateName: templateName,
      templateId: templateId,
      variables: {
        '1': varValue,
      },
    });

    console.log(`[PLANSAPI TEST MONITOR SUCCESS] Test message dispatched successfully.`);
    return {
      success: true,
      message: `Test WhatsApp PlansAPI fetch limit alert sent to ${alertPhone}`,
      remainingFetchesFormatted: varValue,
      msg91Response: result.data,
    };
  }
}

module.exports = new PlanApiFetchMonitorService();
