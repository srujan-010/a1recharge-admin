const PushNotificationTemplate = require('../models/PushNotificationTemplate');

const extractVariables = (title, body) => {
  const text = `${title || ''} ${body || ''}`;
  const matches = text.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || [];
  return [...new Set(matches.map(m => m.replace(/{{\s*|\s*}}/g, '')))];
};

const SYSTEM_TEMPLATES = [
  {
    name: 'Recharge Successful',
    category: 'RECHARGE',
    title: 'Recharge Successful 🎉',
    body: 'Your recharge of ₹{{amount}} for {{mobile}} ({{operator}}) was successful. Ref: {{transactionId}}.',
    deepLink: '/history',
    priority: 'high',
    tags: ['recharge', 'success', 'automated'],
    isSystemTemplate: true,
  },
  {
    name: 'Recharge Failed',
    category: 'RECHARGE',
    title: 'Recharge Failed ❌',
    body: 'Recharge of ₹{{amount}} for {{mobile}} failed due to provider error. Any debited amount has been refunded.',
    deepLink: '/history',
    priority: 'high',
    tags: ['recharge', 'failed', 'refund'],
    isSystemTemplate: true,
  },
  {
    name: 'Recharge Pending',
    category: 'RECHARGE',
    title: 'Recharge Processing ⏳',
    body: 'Your recharge of ₹{{amount}} for {{mobile}} is processing. Status will update shortly.',
    deepLink: '/history',
    priority: 'normal',
    tags: ['recharge', 'pending'],
    isSystemTemplate: true,
  },
  {
    name: 'Wallet Credited',
    category: 'WALLET',
    title: 'Wallet Credited 💳',
    body: '₹{{amount}} has been credited to your wallet. New Balance: ₹{{newBalance}}.',
    deepLink: '/wallet',
    priority: 'high',
    tags: ['wallet', 'credit'],
    isSystemTemplate: true,
  },
  {
    name: 'Wallet Debited',
    category: 'WALLET',
    title: 'Wallet Debited 💸',
    body: '₹{{amount}} has been debited for {{reason}}. New Balance: ₹{{newBalance}}.',
    deepLink: '/wallet',
    priority: 'normal',
    tags: ['wallet', 'debit'],
    isSystemTemplate: true,
  },
  {
    name: 'Commission Credited',
    category: 'WALLET',
    title: 'Commission Credited 🎁',
    body: 'Instant commission of ₹{{amount}} credited to your wallet. New Balance: ₹{{newBalance}}.',
    deepLink: '/wallet',
    priority: 'high',
    tags: ['commission', 'wallet', 'bonus'],
    isSystemTemplate: true,
  },
  {
    name: 'Low Wallet Balance',
    category: 'SYSTEM',
    title: 'Low Balance Warning ⚠️',
    body: 'Your wallet balance is low (₹{{currentBalance}}). Please topup to continue uninterrupted recharges.',
    deepLink: '/wallet',
    priority: 'high',
    tags: ['wallet', 'low_balance', 'alert'],
    isSystemTemplate: true,
  },
  {
    name: 'KYC Approved',
    category: 'KYC',
    title: 'KYC Approved ✅',
    body: 'Congratulations {{name}}! Your KYC verification has been approved. You now have full platform access.',
    deepLink: '/kyc',
    priority: 'high',
    tags: ['kyc', 'approved'],
    isSystemTemplate: true,
  },
  {
    name: 'KYC Rejected',
    category: 'KYC',
    title: 'KYC Rejected ❌',
    body: 'Your KYC application was not approved: {{reason}}. Please resubmit correct documents.',
    deepLink: '/kyc',
    priority: 'high',
    tags: ['kyc', 'rejected'],
    isSystemTemplate: true,
  },
  {
    name: 'Password Changed',
    category: 'SECURITY',
    title: 'Security Alert 🔒',
    body: 'Your account PIN/Password was updated on {{date}} at {{time}}. If this wasn\'t you, contact support immediately.',
    deepLink: '/support',
    priority: 'high',
    tags: ['security', 'password', 'mpin'],
    isSystemTemplate: true,
  },
  {
    name: 'Login Alert',
    category: 'SECURITY',
    title: 'New Login Detected 📲',
    body: 'New login to your A1 Recharge account from {{device}} (IP: {{ip}}).',
    deepLink: '/support',
    priority: 'high',
    tags: ['security', 'login'],
    isSystemTemplate: true,
  },
  {
    name: 'Admin Announcement',
    category: 'ANNOUNCEMENT',
    title: 'Important Announcement 📢',
    body: '{{body}}',
    deepLink: '/',
    priority: 'high',
    tags: ['announcement', 'admin'],
    isSystemTemplate: true,
  },
  {
    name: 'Festival Offer',
    category: 'FESTIVAL',
    title: '🎉 Special Festival Cashback Offer!',
    body: 'Get up to ₹{{amount}} cashback on all DTH & Mobile recharges today! Terms apply.',
    deepLink: '/wallet',
    priority: 'high',
    tags: ['festival', 'offer', 'cashback'],
    isSystemTemplate: true,
  },
  {
    name: 'Welcome Retailer',
    category: 'SYSTEM',
    title: 'Welcome to A1 Recharge 🚀',
    body: 'Hello {{name}}, welcome onboard! Start offering recharges & earn highest market commissions instantly.',
    deepLink: '/',
    priority: 'high',
    tags: ['welcome', 'onboarding'],
    isSystemTemplate: true,
  },
];

async function seedPushTemplates() {
  try {
    for (const tpl of SYSTEM_TEMPLATES) {
      const vars = extractVariables(tpl.title, tpl.body);
      await PushNotificationTemplate.findOneAndUpdate(
        { name: tpl.name, isSystemTemplate: true },
        {
          ...tpl,
          variables: vars,
          isDeleted: false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed] System Push Notification Templates verified/seeded successfully (14 templates).');
  } catch (error) {
    console.error('[Seed Error] Failed to seed Push Notification Templates:', error.message);
  }
}

module.exports = seedPushTemplates;
