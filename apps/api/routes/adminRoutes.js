const express = require('express');
const router = express.Router();
const { loginAdmin } = require('../controllers/adminController');
const { getDashboardStats, getRevenueTrend, getLiveFeed } = require('../controllers/admin/dashboardController');
const { 
  getRetailers, 
  getRetailerById, 
  updateRetailerStatus, 
  updateRetailerAccountType, 
  unlockRetailerAccount,
  updateRetailerProfile,
  deleteRetailer,
  resetRetailerSecurity,
  revokeRetailerSessions,
  releaseRetailerHold
} = require('../controllers/admin/retailerController');
const { getGlobalLedger, manualCreditDebit } = require('../controllers/admin/walletController');
const { getDashboardStats: getProviderWalletStats, getTransactions: getProviderWalletTransactions, getFast2SMSWallet } = require('../controllers/admin/providerWalletController');
const { getGlobalTransactions } = require('../controllers/admin/transactionController');
const { getCommissions, createCommission, updateCommission } = require('../controllers/admin/commissionController');
const { getOperators, updateOperator } = require('../controllers/admin/operatorController');
const { getProviders, refreshProviderBalance, getProviderBalance, triggerTestFast2SMSAlert } = require('../controllers/admin/providerController');
const { getKycList, updateKycStatus } = require('../controllers/admin/kycController');
const { 
  getExecutiveDashboardReport,
  getDailyReport,
  getOperatorReport,
  getCommissionReport,
  generateLedgerReport,
  getPaymentOverviewReport,
  getTopRetailersReport
} = require('../controllers/admin/reportController');
const { sendGlobalNotification, getRecentBroadcasts, sendDirectSMS } = require('../controllers/admin/notificationController');
const { getSettings, updateSettings } = require('../controllers/admin/settingsController');
const { getTickets, replyToTicket, resolveTicket } = require('../controllers/admin/supportController');
const { getAuditLogs } = require('../controllers/admin/auditController');
const { getAdminUsers, createAdminUser, updateAdminUser } = require('../controllers/admin/adminUserController');
const { getDistributors } = require('../controllers/admin/distributorController');
const { protectAdmin, authorize } = require('../middleware/adminAuth');
const idempotency = require('../middleware/idempotency');

router.post('/login', loginAdmin);

// Settings routes
router.route('/settings')
  .get(protectAdmin, getSettings)
  .put(protectAdmin, authorize('SUPER_ADMIN'), idempotency, updateSettings);

// Dashboard routes
router.get('/dashboard/stats', protectAdmin, getDashboardStats);
router.get('/dashboard/trend', protectAdmin, getRevenueTrend);
router.get('/dashboard/live', protectAdmin, getLiveFeed);

// Retailer routes (Requires SUPER_ADMIN or SUPPORT/ADMIN)
router.get('/retailers', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getRetailers);
router.route('/retailers/:id')
  .get(protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getRetailerById)
  .put(protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateRetailerProfile)
  .delete(protectAdmin, authorize('SUPER_ADMIN'), deleteRetailer);

router.put('/retailers/:id/status', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateRetailerStatus);
router.put('/retailers/:id/account-type', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateRetailerAccountType);
router.post('/retailers/:id/unlock', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, unlockRetailerAccount);
router.post('/retailers/:id/reset-security', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, resetRetailerSecurity);
router.post('/retailers/:id/revoke-sessions', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, revokeRetailerSessions);
router.post('/retailers/:id/release-hold', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, releaseRetailerHold);
router.post('/notifications/send-sms', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, sendDirectSMS);

// Distributor routes
router.get('/distributors', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getDistributors);

// Admin Users routes
router.route('/users')
  .get(protectAdmin, authorize('SUPER_ADMIN'), getAdminUsers)
  .post(protectAdmin, authorize('SUPER_ADMIN'), idempotency, createAdminUser);
router.put('/users/:id', protectAdmin, authorize('SUPER_ADMIN'), updateAdminUser);

// Wallet Management routes
router.get('/wallets/ledger', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'SUPPORT'), getGlobalLedger);
router.post('/wallets/:userId/adjust', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), idempotency, manualCreditDebit);

// Provider Wallet routes
router.get('/provider-wallet/dashboard', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), getProviderWalletStats);
router.get('/provider-wallet/transactions', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), getProviderWalletTransactions);
router.get('/providers/fast2sms/wallet', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), getFast2SMSWallet);
router.get('/provider-wallet/fast2sms', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), getFast2SMSWallet);
router.post('/providers/fast2sms/test-low-balance-alert', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), triggerTestFast2SMSAlert);

// Transaction routes
router.get('/transactions', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getGlobalTransactions);

// Recharge Operations (New)
const { getRecharges, getRechargeDetails, performAction } = require('../controllers/admin/rechargeOperationsController');
router.get('/recharges', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getRecharges);
router.get('/recharges/:orderId/details', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getRechargeDetails);
router.post('/recharges/:orderId/action', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, performAction);

// Commission routes
router.get('/commissions', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'SUPPORT'), getCommissions);
router.post('/commissions', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), idempotency, createCommission);
router.put('/commissions/:id', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), updateCommission);

// Operator Management routes
router.get('/operators', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getOperators);
router.put('/operators/:id', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateOperator);

// Provider Management routes
router.get('/provider/balance', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'SUPPORT'), getProviderBalance);
router.get('/providers', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'SUPPORT'), getProviders);
router.post('/providers/:id/refresh-balance', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE'), idempotency, refreshProviderBalance);

// KYC Management routes
router.get('/kyc', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getKycList);
router.put('/kyc/:id/status', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateKycStatus);

// Report routes
router.get('/reports/dashboard', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getExecutiveDashboardReport);
router.get('/reports/daily', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getDailyReport);
router.get('/reports/operators', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getOperatorReport);
router.get('/reports/commissions', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getCommissionReport);
router.get('/reports/ledger', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), generateLedgerReport);
router.get('/reports/payment-overview', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getPaymentOverviewReport);
router.get('/reports/top-retailers', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getTopRetailersReport);
router.get('/analytics/top-retailers', protectAdmin, authorize('SUPER_ADMIN', 'FINANCE', 'ADMIN'), getTopRetailersReport);

// Internal Notification routes
router.post('/notifications/broadcast', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, sendGlobalNotification);
router.get('/notifications/broadcasts', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getRecentBroadcasts);

// FCM Push Notification routes
const { 
  sendFCMNotification, 
  testFCMNotification, 
  getPushNotificationHistory, 
  getDeviceTokens, 
  deleteDeviceToken 
} = require('../controllers/admin/firebasePushController');

const {
  getTemplates,
  getCategories,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleFavorite,
  duplicateTemplate
} = require('../controllers/admin/pushTemplateController');

router.post('/push-notifications/send', protectAdmin, authorize('SUPER_ADMIN'), idempotency, sendFCMNotification);
router.post('/push-notifications/test', protectAdmin, authorize('SUPER_ADMIN'), testFCMNotification);
router.get('/push-notifications/history', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getPushNotificationHistory);
router.get('/push-notifications/device-tokens', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getDeviceTokens);
router.delete('/push-notifications/device-tokens/:id', protectAdmin, authorize('SUPER_ADMIN'), deleteDeviceToken);

// Push Notification Template routes
router.get('/push-notifications/templates', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getTemplates);
router.get('/push-notifications/templates/categories', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getCategories);
router.get('/push-notifications/templates/:id', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getTemplateById);
router.post('/push-notifications/templates', protectAdmin, authorize('SUPER_ADMIN'), idempotency, createTemplate);
router.put('/push-notifications/templates/:id', protectAdmin, authorize('SUPER_ADMIN'), updateTemplate);
router.delete('/push-notifications/templates/:id', protectAdmin, authorize('SUPER_ADMIN'), deleteTemplate);
router.post('/push-notifications/templates/:id/favorite', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), toggleFavorite);
router.post('/push-notifications/templates/:id/duplicate', protectAdmin, authorize('SUPER_ADMIN'), duplicateTemplate);

// WhatsApp Business routes
const {
  getWabaStatus,
  getTemplates: getWhatsAppTemplates,
  createTemplate: createWhatsAppTemplate,
  updateTemplate: updateWhatsAppTemplate,
  deleteTemplate: deleteWhatsAppTemplate,
  duplicateTemplate: duplicateWhatsAppTemplate,
  syncTemplates: syncWhatsAppTemplates,
  sendCampaign: sendWhatsAppCampaign,
  getCampaignHistory: getWhatsAppHistory,
  getAnalytics: getWhatsAppAnalytics,
  getDeliveryReport: getWhatsAppDeliveryReport,
  getLogs: getWhatsAppLogs,
  getSummary: getWhatsAppSummary,
  getRecipientStats: getWhatsAppRecipientStats,
  getFast2SMSWalletTransactions,
  getFast2SMSWalletStats,
  getLogsSummary: getWhatsAppLogsSummary,
} = require('../controllers/admin/whatsappController');

router.get('/whatsapp/status', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWabaStatus);
router.get('/whatsapp/templates', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppTemplates);
router.post('/whatsapp/templates', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, createWhatsAppTemplate);
router.put('/whatsapp/templates/:id', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateWhatsAppTemplate);
router.delete('/whatsapp/templates/:id', protectAdmin, authorize('SUPER_ADMIN'), deleteWhatsAppTemplate);
router.post('/whatsapp/templates/:id/duplicate', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), duplicateWhatsAppTemplate);
router.post('/whatsapp/templates/sync', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), syncWhatsAppTemplates);
router.post('/whatsapp/send', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, sendWhatsAppCampaign);
router.get('/whatsapp/history', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppHistory);
router.get('/whatsapp/analytics', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppAnalytics);
router.get('/whatsapp/delivery-report/:requestId', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppDeliveryReport);
router.get('/whatsapp/logs', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppLogs);
router.get('/whatsapp/logs-summary', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppLogsSummary);
router.get('/whatsapp/summary', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppSummary);
router.get('/whatsapp/recipients-stats', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getWhatsAppRecipientStats);
router.get('/whatsapp/fast2sms-wallet-transactions', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getFast2SMSWalletTransactions);
router.get('/whatsapp/fast2sms-wallet-stats', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getFast2SMSWalletStats);

// Support Ticketing routes
router.get('/support/tickets', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), getTickets);
router.post('/support/tickets/:id/reply', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), idempotency, replyToTicket);
router.put('/support/tickets/:id/resolve', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), resolveTicket);

// Security & Audit routes
router.get('/audit-logs', protectAdmin, authorize('SUPER_ADMIN'), getAuditLogs);

// PlanAPI Routes
const {
  getDashboardData: getPlanApiDashboardData,
  triggerRefresh: triggerPlanApiRefresh,
  getSyncLogs: getPlanApiSyncLogs,
  exportSyncLogs: exportPlanApiSyncLogs,
  getSettings: getPlanApiSettings,
  updateSettings: updatePlanApiSettings,
  triggerTestLowBalanceAlert,
  triggerTestFetchLimitAlert,
  getIntegrationsStatus,
} = require('../controllers/admin/planApiController');

router.get('/planapi/dashboard', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getPlanApiDashboardData);
router.post('/planapi/refresh', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), triggerPlanApiRefresh);
router.get('/planapi/logs', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getPlanApiSyncLogs);
router.get('/planapi/export', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), exportPlanApiSyncLogs);
router.get('/planapi/settings', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), getPlanApiSettings);
router.put('/planapi/settings', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), idempotency, updatePlanApiSettings);
router.post('/planapi/test-low-balance-alert', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), triggerTestLowBalanceAlert);
router.post('/planapi/test-fetch-limit-alert', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), triggerTestFetchLimitAlert);
router.get('/integrations/planapi/status', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getIntegrationsStatus);

// Provider Low Balance Automation Routes
const {
  getSettings: getProviderAutomationSettings,
  updateSettings: updateProviderAutomationSettings,
  getLogs: getProviderAutomationLogs,
  sendTestAlert: sendProviderAutomationTestAlert,
} = require('../controllers/admin/providerAutomationController');

router.get('/provider-automations/settings', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getProviderAutomationSettings);
router.put('/provider-automations/settings', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), updateProviderAutomationSettings);
router.get('/provider-automations/logs', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getProviderAutomationLogs);
router.post('/provider-automations/test', protectAdmin, authorize('SUPER_ADMIN', 'ADMIN'), sendProviderAutomationTestAlert);

module.exports = router;
