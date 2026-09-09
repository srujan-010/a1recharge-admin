const express = require('express');
const router = express.Router();
const { protectAdmin, authorize } = require('../middleware/adminAuth');
const idempotency = require('../middleware/idempotency');
const { uploadPaymentProof } = require('../middleware/manualPaymentUpload');

const {
  getManualPayments,
  getManualPaymentStats,
  getManualPaymentReconciliation,
  getRetailerManualPayments,
  getManualPaymentById,
  createManualPayment,
  markAsReceived,
  verifyPayment,
  rejectPayment,
  cancelPayment,
  creditWalletForPayment,
  reverseWalletCredit,
  uploadProof
} = require('../controllers/admin/manualPaymentController');

// All routes require Admin Authentication
router.use(protectAdmin);

// Dashboard overview & reconciliation
router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getManualPaymentStats);
router.get('/reconciliation', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), getManualPaymentReconciliation);
router.get('/retailer/:userId', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getRetailerManualPayments);

// Main collection & creation
router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getManualPayments)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, createManualPayment);

// Upload proof file
router.post('/upload-proof', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), uploadPaymentProof.single('proof'), uploadProof);

// Individual payment actions
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'), getManualPaymentById);
router.post('/:id/receive', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, markAsReceived);
router.post('/:id/verify', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, verifyPayment);
router.post('/:id/reject', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, rejectPayment);
router.post('/:id/cancel', authorize('SUPER_ADMIN', 'ADMIN', 'FINANCE'), idempotency, cancelPayment);
router.post('/:id/credit-wallet', authorize('SUPER_ADMIN', 'FINANCE'), idempotency, creditWalletForPayment);
router.post('/:id/reverse', authorize('SUPER_ADMIN', 'FINANCE'), idempotency, reverseWalletCredit);

module.exports = router;
