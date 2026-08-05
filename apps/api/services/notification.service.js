const Notification = require('../models/Notification');
const NotificationHistory = require('../models/NotificationHistory');
const User = require('../models/User');
const PushNotificationTemplate = require('../models/PushNotificationTemplate');
const TemplateRenderer = require('./templateRenderer.service');
const { getApp } = require('../config/firebase');
const { getMessaging } = require('firebase-admin/messaging');

class NotificationService {
  /**
   * Helper to fetch template by name/category and replace {{variables}} dynamically using TemplateRenderer.
   * Increments template.usageCount automatically.
   */
  async _getTemplateContent(templateName, category, variables = {}, fallbackTitle = '', fallbackBody = '') {
    let title = fallbackTitle;
    let body = fallbackBody;
    let bannerImage = null;
    let deepLink = null;
    let priority = 'normal';
    let ttl = 2419200;

    try {
      let template = null;
      if (templateName) {
        template = await PushNotificationTemplate.findOne({ name: templateName, isDeleted: false });
      }
      if (!template && category) {
        template = await PushNotificationTemplate.findOne({ category: category.toUpperCase(), isDeleted: false });
      }

      if (template) {
        title = template.title;
        body = template.body;
        bannerImage = template.bannerImage;
        if (template.deepLink) deepLink = template.deepLink;
        priority = template.priority || 'normal';
        ttl = template.ttl || 2419200;

        // Increment usage count
        PushNotificationTemplate.updateOne({ _id: template._id }, { $inc: { usageCount: 1 } }).exec().catch(() => {});
      }
    } catch (err) {
      console.warn(`[NotificationEngine] Template lookup warning for "${templateName}":`, err.message);
    }

    // Render title and body using TemplateRenderer
    const renderedTitle = TemplateRenderer.render(title, variables);
    const renderedBody = TemplateRenderer.render(body, variables);

    return {
      title: renderedTitle,
      body: renderedBody,
      bannerImage,
      deepLink,
      priority,
      ttl
    };
  }

  /**
   * Internal unified dispatch logic (One Event -> Three Outputs)
   * 1. Checks user notification preferences & master toggle
   * 2. Renders final title & body with user context using TemplateRenderer
   * 3. Creates In-App Notification record in DB
   * 4. Sends Firebase Push via FCM (if fcmToken exists)
   * 5. Logs NotificationHistory record in DB
   */
  async _dispatch({
    userId,
    title,
    body,
    category = 'INFO',
    source = 'SYSTEM',
    preferenceKey = null,
    deepLink = null,
    data = {},
    priority = 'normal',
    imageUrl = null,
    sentBy = null
  }) {
    // Run asynchronously so caller execution is never blocked or delayed
    setImmediate(async () => {
      try {
        if (!userId) return;

        const user = await User.findById(userId).select('fcmToken notificationEnabled notificationPreferences name phone retailerId email');
        if (!user) return;

        // 1. Check Preferences (Security notifications CANNOT be disabled)
        if (preferenceKey !== 'securityNotifications') {
          if (user.notificationEnabled === false) {
            console.log(`[NotificationEngine] Suppressed "${title}" for user ${userId} (master notificationEnabled=false)`);
            return;
          }
          if (preferenceKey && user.notificationPreferences && user.notificationPreferences[preferenceKey] === false) {
            console.log(`[NotificationEngine] Suppressed "${title}" for user ${userId} (preference: ${preferenceKey}=false)`);
            return;
          }
        }

        // Build User Context & Final Template Render Guard
        const userContext = {
          name: user.name,
          retailer: user.name,
          retailerId: user.retailerId || '',
          mobile: user.phone || '',
          phone: user.phone || '',
          email: user.email || '',
          ...data
        };

        const finalTitle = TemplateRenderer.render(title, userContext);
        const finalBody = TemplateRenderer.render(body, userContext);

        const action = deepLink || null;
        const actionData = { ...data, deepLink: deepLink || '' };

        // 2. Create In-App Notification
        await Notification.create({
          userId: user._id,
          title: finalTitle,
          message: finalBody,
          type: 'BOTH',
          category: category.toUpperCase(),
          priority: priority.toUpperCase(),
          action,
          actionData
        });

        // 3. Send Firebase Push Notification if FCM token exists
        let fcmStatus = 'SKIPPED';
        let fcmError = null;
        let firebaseMsgId = null;

        if (user.fcmToken) {
          try {
            const app = getApp();
            if (app) {
              const messaging = getMessaging(app);
              const messagePayload = {
                token: user.fcmToken,
                notification: {
                  title: finalTitle,
                  body: finalBody,
                  ...(imageUrl && { imageUrl }),
                },
                data: {
                  category,
                  source,
                  ...(action && { route: action }),
                  ...Object.keys(data).reduce((acc, k) => {
                    acc[k] = String(data[k]);
                    return acc;
                  }, {})
                },
                android: {
                  priority: priority === 'high' ? 'high' : 'normal',
                }
              };

              firebaseMsgId = await messaging.send(messagePayload);
              fcmStatus = 'DELIVERED';
            } else {
              fcmStatus = 'FAILED';
              fcmError = 'Firebase Admin App not initialized';
            }
          } catch (pushErr) {
            fcmStatus = 'FAILED';
            fcmError = pushErr.message;
            console.warn(`[NotificationEngine] Push failed for user ${userId}: ${pushErr.message}`);

            if (pushErr.code === 'messaging/registration-token-not-registered') {
              await User.findByIdAndUpdate(userId, { fcmToken: null });
            }
          }
        }

        // 4. Log Notification History
        await NotificationHistory.create({
          userId: user._id,
          fcmToken: user.fcmToken || null,
          title: finalTitle,
          body: finalBody,
          imageUrl,
          deepLink: action,
          priority,
          source,
          isAutomatic: !sentBy,
          sentBy: sentBy || null,
          firebaseMessageId: firebaseMsgId,
          status: fcmStatus,
          errorDetails: fcmError
        });

      } catch (err) {
        console.error('[NotificationEngine Error] Uncaught error in async notification dispatch:', err.message);
      }
    });
  }

  // ─── HIGH-LEVEL BUSINESS EVENT TRIGGERS (TEMPLATE INTEGRATED) ──────────────────

  async sendRechargeSuccess({ userId, transactionId, orderId, service, operator, amount, number }) {
    const tpl = await this._getTemplateContent(
      'Recharge Successful',
      'RECHARGE',
      { amount, mobile: number, operator, transactionId: orderId || transactionId },
      'Recharge Successful 🎉',
      `Your recharge of ₹${amount} for ${number} (${operator}) was successful. Ref: ${orderId || transactionId}.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'SUCCESS',
      source: 'RECHARGE',
      preferenceKey: 'rechargeNotifications',
      deepLink: tpl.deepLink || `transactions/details/${transactionId || orderId}`,
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { transactionId: transactionId || orderId, orderId: orderId || transactionId, service, operator, amount, number }
    });
  }

  async sendRechargeFailed({ userId, transactionId, operator, amount, reason, number }) {
    const tpl = await this._getTemplateContent(
      'Recharge Failed',
      'RECHARGE',
      { amount, mobile: number || '', operator, reason: reason || 'Provider error', transactionId },
      'Recharge Failed ❌',
      `Recharge of ₹${amount} for ${operator} failed. Reason: ${reason || 'Provider error'}. Any debited amount has been refunded.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'ERROR',
      source: 'RECHARGE',
      preferenceKey: 'rechargeNotifications',
      deepLink: tpl.deepLink || `transactions/details/${transactionId}`,
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { transactionId, operator, amount, reason }
    });
  }

  async sendRechargePending({ userId, transactionId, operator, amount, number }) {
    const tpl = await this._getTemplateContent(
      'Recharge Pending',
      'RECHARGE',
      { amount, mobile: number || '', operator, transactionId },
      'Recharge Processing ⏳',
      `Your recharge of ₹${amount} for ${number || operator} is processing. Status will update shortly.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'WARNING',
      source: 'RECHARGE',
      preferenceKey: 'rechargeNotifications',
      deepLink: tpl.deepLink || `transactions/details/${transactionId}`,
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { transactionId, operator, amount, number }
    });
  }

  async sendWalletCredited({ userId, amount, newBalance, reason, referenceId }) {
    const tpl = await this._getTemplateContent(
      'Wallet Credited',
      'WALLET',
      { amount, newBalance, reason: reason || 'Deposit' },
      'Wallet Credited 💳',
      `₹${amount} has been credited to your wallet. New Balance: ₹${newBalance}.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'SUCCESS',
      source: 'WALLET',
      preferenceKey: 'walletNotifications',
      deepLink: tpl.deepLink || 'wallet/history',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { amount, newBalance, reason, referenceId }
    });
  }

  async sendWalletDebited({ userId, amount, newBalance, reason, referenceId }) {
    const tpl = await this._getTemplateContent(
      'Wallet Debited',
      'WALLET',
      { amount, newBalance, reason: reason || 'Service' },
      'Wallet Debited 💸',
      `₹${amount} has been debited from your wallet. New Balance: ₹${newBalance}.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'INFO',
      source: 'WALLET',
      preferenceKey: 'walletNotifications',
      deepLink: tpl.deepLink || 'wallet/history',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { amount, newBalance, reason, referenceId }
    });
  }

  async sendLowBalance({ userId, currentBalance, threshold = 400 }) {
    const tpl = await this._getTemplateContent(
      'Low Wallet Balance',
      'SYSTEM',
      { currentBalance, threshold },
      'Low Balance Warning ⚠️',
      `Your wallet balance is low (₹${currentBalance}). Please topup to continue uninterrupted recharges.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'WARNING',
      source: 'SYSTEM',
      preferenceKey: 'walletNotifications',
      deepLink: tpl.deepLink || 'wallet/topup',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { currentBalance, threshold }
    });
  }

  async sendKycApproved({ userId }) {
    const tpl = await this._getTemplateContent(
      'KYC Approved',
      'KYC',
      {},
      'KYC Approved ✅',
      'Congratulations! Your KYC verification has been approved. You now have full platform access.'
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'SUCCESS',
      source: 'KYC',
      preferenceKey: 'kycNotifications',
      deepLink: tpl.deepLink || 'profile/kyc',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { kycStatus: 'APPROVED' }
    });
  }

  async sendKycRejected({ userId, reason }) {
    const tpl = await this._getTemplateContent(
      'KYC Rejected',
      'KYC',
      { reason: reason || 'Document mismatch' },
      'KYC Rejected ❌',
      `Your KYC application was not approved: ${reason || 'Please re-upload valid documents'}.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'ERROR',
      source: 'KYC',
      preferenceKey: 'kycNotifications',
      deepLink: tpl.deepLink || 'profile/kyc',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { kycStatus: 'REJECTED', reason }
    });
  }

  async sendCommissionCredited({ userId, amount, newBalance }) {
    const tpl = await this._getTemplateContent(
      'Commission Credited',
      'WALLET',
      { amount, newBalance },
      'Commission Credited 🎁',
      `Instant commission of ₹${amount} credited to your wallet. New Balance: ₹${newBalance}.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'SUCCESS',
      source: 'WALLET',
      preferenceKey: 'walletNotifications',
      deepLink: tpl.deepLink || 'wallet/history',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { amount, newBalance, type: 'COMMISSION' }
    });
  }

  async sendSecurityAlert({ userId, alertType, details }) {
    const tpl = await this._getTemplateContent(
      'Password Changed',
      'SECURITY',
      { alertType, details },
      'Security Alert 🔒',
      `Security Alert: ${details || 'Unusual activity detected on your account.'}`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'WARNING',
      source: 'SECURITY',
      preferenceKey: 'securityNotifications',
      deepLink: tpl.deepLink || 'security',
      priority: 'high',
      imageUrl: tpl.bannerImage,
      data: { alertType, details }
    });
  }

  async sendLoginAlert({ userId, ip, device }) {
    const tpl = await this._getTemplateContent(
      'Login Alert',
      'SECURITY',
      { ip: ip || 'Unknown', device: device || 'Device' },
      'New Login Detected 📲',
      `New login to your A1 Recharge account from ${device || 'a new device'} (IP: ${ip || 'Unknown'}).`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'INFO',
      source: 'SECURITY',
      preferenceKey: 'securityNotifications',
      deepLink: tpl.deepLink || 'security',
      priority: 'high',
      imageUrl: tpl.bannerImage,
      data: { ip, device }
    });
  }

  async sendPasswordChanged({ userId, type = 'MPIN' }) {
    const now = new Date();
    const tpl = await this._getTemplateContent(
      'Password Changed',
      'SECURITY',
      { type, date: now.toLocaleDateString(), time: now.toLocaleTimeString() },
      'Security Alert 🔒',
      `Your account ${type} was updated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}. If this wasn't you, contact support immediately.`
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'WARNING',
      source: 'SECURITY',
      preferenceKey: 'securityNotifications',
      deepLink: tpl.deepLink || 'security',
      priority: 'high',
      imageUrl: tpl.bannerImage,
      data: { type, timestamp: now.toISOString() }
    });
  }

  async sendAccountBlocked({ userId, reason }) {
    await this._dispatch({
      userId,
      title: 'Account Suspended 🚫',
      body: `Your A1 Recharge account has been suspended: ${reason || 'Contact Admin'}.`,
      category: 'ERROR',
      source: 'ADMIN',
      preferenceKey: 'securityNotifications',
      deepLink: 'support',
      priority: 'high',
      data: { status: 'BLOCKED', reason }
    });
  }

  async sendAccountActivated({ userId }) {
    await this._dispatch({
      userId,
      title: 'Account Activated ✅',
      body: 'Your A1 Recharge account is active. You can resume transactions.',
      category: 'SUCCESS',
      source: 'ADMIN',
      preferenceKey: 'securityNotifications',
      deepLink: 'dashboard',
      priority: 'high',
      data: { status: 'ACTIVE' }
    });
  }

  async sendWelcomeNotification({ userId }) {
    const tpl = await this._getTemplateContent(
      'Welcome Retailer',
      'SYSTEM',
      {},
      'Welcome to A1 Recharge 🚀',
      'Hello {{name}}, welcome onboard! Start offering recharges & earn highest market commissions instantly.'
    );

    await this._dispatch({
      userId,
      title: tpl.title,
      body: tpl.body,
      category: 'SUCCESS',
      source: 'SYSTEM',
      preferenceKey: 'systemNotifications',
      deepLink: tpl.deepLink || '/',
      priority: tpl.priority,
      imageUrl: tpl.bannerImage,
      data: { type: 'WELCOME_RETAILER' }
    });
  }

  async sendAdminAnnouncement({ userId, title, body, imageUrl, deepLink, sentBy }) {
    const tpl = await this._getTemplateContent(
      'Admin Announcement',
      'ANNOUNCEMENT',
      { body },
      title || 'Important Announcement 📢',
      body
    );

    await this._dispatch({
      userId,
      title: title || tpl.title,
      body: body || tpl.body,
      category: 'INFO',
      source: 'ADMIN',
      preferenceKey: 'systemNotifications',
      deepLink: deepLink || tpl.deepLink,
      priority: tpl.priority,
      sentBy,
      data: { type: 'ANNOUNCEMENT' }
    });
  }

  async sendWhatsAppNotification({ userId, templateName, variablesValues = [], mediaUrl = null }) {
    try {
      const fast2smsWhatsAppService = require('./fast2smsWhatsApp.service');
      const WhatsAppTemplate = require('../models/WhatsAppTemplate');

      const user = await User.findById(userId).select('phone name');
      if (!user || !user.phone) return;

      const tpl = await WhatsAppTemplate.findOne({ templateName, isDeleted: false });
      if (!tpl) return;

      const formattedVars = Array.isArray(variablesValues) ? variablesValues.join('|') : String(variablesValues || '');

      await fast2smsWhatsAppService.sendWhatsAppMessage({
        messageId: tpl.messageId,
        phoneNumberId: tpl.phoneNumberId || '1294250930429862',
        numbers: [user.phone],
        variablesValues: formattedVars,
        mediaUrl
      }).catch(err => {
        console.warn(`[NotificationEngine] WhatsApp dispatch warning for user ${userId}:`, err.message);
      });
    } catch (err) {
      console.warn('[NotificationEngine] sendWhatsAppNotification error:', err.message);
    }
  }
}

module.exports = new NotificationService();
