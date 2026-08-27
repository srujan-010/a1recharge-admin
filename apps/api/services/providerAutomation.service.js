const ProviderAutomationSettings = require('../models/ProviderAutomationSettings');
const ProviderAutomationLog = require('../models/ProviderAutomationLog');
const ProviderFactory = require('./providers/provider.factory');
const fast2smsWhatsAppService = require('./fast2smsWhatsApp.service');

class ProviderAutomationService {
  /**
   * Get or initialize automation settings
   */
  async getSettings() {
    let settings = await ProviderAutomationSettings.findOne({ automationKey: 'a1topup_low_balance' });
    if (!settings) {
      settings = await ProviderAutomationSettings.create({
        automationKey: 'a1topup_low_balance',
        enabled: true,
        providerName: 'A1Topup',
        threshold: 500,
        recipients: ['9100329521', '8275366399'],
        templateName: 'provider_wallet_low_balance',
        messageId: 27147,
        phoneNumberId: '1294250930429862',
      });
    }
    return settings;
  }

  /**
   * Helper to format Date into Asia/Kolkata IST string
   * Example output: "27 Aug 2026, 11:48 PM IST"
   */
  formatISTDate(date = new Date()) {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} IST`;
  }

  /**
   * Core Background Automation: Triggered after every successful global recharge
   * @param {Object} transactionDoc - The successful RechargeTransaction document
   */
  async checkAndTriggerLowBalanceAlert(transactionDoc) {
    const startTime = Date.now();
    const transactionId = transactionDoc.orderId || transactionDoc._id?.toString() || `TXN_${Date.now()}`;

    // 1. Idempotency Check: Prevent duplicate execution for the same transaction ID
    const existingLog = await ProviderAutomationLog.findOne({ transactionId });
    if (existingLog) {
      console.log(`[A1TOPUP LOW BALANCE AUTOMATION] Idempotency guard: transaction ${transactionId} already processed.`);
      return existingLog;
    }

    // 2. Fetch Settings
    const settings = await this.getSettings();
    if (!settings.enabled) {
      console.log('[A1TOPUP LOW BALANCE AUTOMATION] Automation is currently disabled in settings.');
      return await ProviderAutomationLog.create({
        transactionId,
        rechargeOrderId: transactionDoc.orderId,
        rechargeAmount: transactionDoc.amount,
        providerName: settings.providerName,
        overallStatus: 'DISABLED',
        errorDetails: 'Automation disabled in admin settings',
        executionTimeMs: Date.now() - startTime
      });
    }

    // 3. Fetch REAL A1Topup Wallet Balance via Provider Service
    const provider = ProviderFactory.getProvider(settings.providerName || 'A1Topup');
    let balanceResult;
    try {
      balanceResult = await provider.balance();
    } catch (err) {
      console.error('[A1TOPUP LOW BALANCE] Unable to determine provider wallet balance:', err.message);
      
      settings.lastCheckAt = new Date();
      settings.lastStatus = 'UNKNOWN';
      await settings.save().catch(e => console.error(e));

      return await ProviderAutomationLog.create({
        transactionId,
        rechargeOrderId: transactionDoc.orderId,
        rechargeAmount: transactionDoc.amount,
        providerName: settings.providerName,
        overallStatus: 'ERROR_SKIPPED',
        errorDetails: `Balance check failed: ${err.message}`,
        executionTimeMs: Date.now() - startTime
      });
    }

    // 4. Safe Balance Parsing & Validation
    let numericBalance = null;
    if (balanceResult && balanceResult.success && typeof balanceResult.balance === 'number' && !isNaN(balanceResult.balance)) {
      numericBalance = balanceResult.balance;
    } else if (balanceResult && typeof balanceResult.balance === 'string' && !isNaN(Number(balanceResult.balance))) {
      numericBalance = parseFloat(balanceResult.balance);
    }

    if (numericBalance === null || isNaN(numericBalance)) {
      console.error('[A1TOPUP LOW BALANCE] Unable to determine provider wallet balance. Raw response:', balanceResult);
      
      settings.lastCheckAt = new Date();
      settings.lastStatus = 'UNKNOWN';
      await settings.save().catch(e => console.error(e));

      return await ProviderAutomationLog.create({
        transactionId,
        rechargeOrderId: transactionDoc.orderId,
        rechargeAmount: transactionDoc.amount,
        providerName: settings.providerName,
        overallStatus: 'ERROR_SKIPPED',
        errorDetails: 'Invalid balance format returned from provider',
        executionTimeMs: Date.now() - startTime
      });
    }

    // Update Last Check & Last Balance
    settings.lastCheckAt = new Date();
    settings.lastBalance = numericBalance;

    const threshold = settings.threshold || 500;
    const isLowBalance = numericBalance < threshold; // Strictly: balance < 500

    if (!isLowBalance) {
      settings.lastStatus = 'NORMAL';
      await settings.save().catch(e => console.error(e));

      console.log(`====================================================`);
      console.log(`[A1TOPUP LOW BALANCE AUTOMATION]`);
      console.log(`internalTransactionId: ${transactionId}`);
      console.log(`rechargeStatus: SUCCESS`);
      console.log(`rechargeAmount: ₹${transactionDoc.amount}`);
      console.log(`providerBalance: ₹${numericBalance}`);
      console.log(`threshold: ₹${threshold}`);
      console.log(`conditionMatched: false (NORMAL)`);
      console.log(`====================================================`);

      return await ProviderAutomationLog.create({
        transactionId,
        rechargeOrderId: transactionDoc.orderId,
        rechargeAmount: transactionDoc.amount,
        providerName: settings.providerName,
        providerBalance: numericBalance,
        threshold,
        overallStatus: 'NO_ALERT_NEEDED',
        executionTimeMs: Date.now() - startTime
      });
    }

    // 5. LOW BALANCE DETECTED -> DISPATCH WHATSAPP ALERT TO BOTH RECIPIENTS
    settings.lastStatus = 'LOW_BALANCE';
    settings.lastAlertAt = new Date();
    await settings.save().catch(e => console.error(e));

    const detectedAtIST = this.formatISTDate(new Date());
    const formattedBalance = numericBalance.toFixed(2);
    const variablesValues = `${formattedBalance}|${detectedAtIST}`;

    console.log(`====================================================`);
    console.log(`[A1TOPUP LOW BALANCE AUTOMATION]`);
    console.log(`internalTransactionId: ${transactionId}`);
    console.log(`rechargeStatus: SUCCESS`);
    console.log(`rechargeAmount: ₹${transactionDoc.amount}`);
    console.log(`providerBalance: ₹${numericBalance}`);
    console.log(`threshold: ₹${threshold}`);
    console.log(`conditionMatched: true`);
    console.log(`recipients: ${settings.recipients.length}`);
    console.log(`template: ${settings.templateName}`);
    console.log(`====================================================`);

    const recipientsStatus = [];
    let successCount = 0;

    for (const recipientNumber of settings.recipients) {
      const cleanRecipient = String(recipientNumber).replace(/\D/g, '');
      if (!cleanRecipient) continue;

      try {
        const waResponse = await fast2smsWhatsAppService.sendWhatsAppMessage({
          messageId: settings.messageId || 27147,
          phoneNumberId: settings.phoneNumberId || '1294250930429862',
          numbers: cleanRecipient,
          variablesValues,
          source: 'A1TOPUP_LOW_BALANCE_AUTOMATION',
          skipDbLog: false,
        });

        console.log(`[A1TOPUP LOW BALANCE WHATSAPP] recipient: ${cleanRecipient} status: SENT`);
        recipientsStatus.push({
          recipient: cleanRecipient,
          status: 'SENT',
          requestId: waResponse?.request_id || waResponse?.data?.request_id || null,
          sentAt: new Date()
        });
        successCount++;
      } catch (waErr) {
        console.error(`[A1TOPUP LOW BALANCE WHATSAPP] recipient: ${cleanRecipient} status: FAILED reason: ${waErr.message}`);
        recipientsStatus.push({
          recipient: cleanRecipient,
          status: 'FAILED',
          errorDetails: waErr.message,
          sentAt: new Date()
        });
      }
    }

    let overallStatus = 'FAILED';
    if (successCount === settings.recipients.length && settings.recipients.length > 0) {
      overallStatus = 'ALERT_SENT';
    } else if (successCount > 0) {
      overallStatus = 'PARTIAL_SUCCESS';
    }

    const logEntry = await ProviderAutomationLog.create({
      transactionId,
      rechargeOrderId: transactionDoc.orderId,
      rechargeAmount: transactionDoc.amount,
      providerName: settings.providerName,
      providerBalance: numericBalance,
      threshold,
      overallStatus,
      recipientsStatus,
      executionTimeMs: Date.now() - startTime
    });

    return logEntry;
  }
}

module.exports = new ProviderAutomationService();
