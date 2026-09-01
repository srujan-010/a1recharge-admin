/**
 * Controlled Payment Type Enum Constants
 */
const PAYMENT_TYPES = {
  WALLET: 'WALLET',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CASH: 'CASH',
  CARD: 'CARD',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
};

const VALID_PAYMENT_TYPES = Object.values(PAYMENT_TYPES);

/**
 * Normalizes a single raw payment string to controlled enum value.
 */
function normalizeSingleString(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().toUpperCase();

  // Explicit UPI / Gateway aliases
  if (['RAZORPAY_UPI', 'RAZORPAY', 'UPI', 'BHIM_UPI', 'UPI_QR'].includes(clean)) {
    return PAYMENT_TYPES.UPI;
  }
  // Explicit Wallet aliases
  if (['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT'].includes(clean)) {
    return PAYMENT_TYPES.WALLET;
  }
  // Bank transfer aliases
  if (['BANK_TRANSFER', 'BANK', 'IMPS', 'NEFT', 'RTGS'].includes(clean)) {
    return PAYMENT_TYPES.BANK_TRANSFER;
  }
  // Cash
  if (clean === 'CASH') {
    return PAYMENT_TYPES.CASH;
  }
  // Card
  if (['CARD', 'CREDIT_CARD', 'DEBIT_CARD'].includes(clean)) {
    return PAYMENT_TYPES.CARD;
  }
  // Gateway / Online / Other
  if (['GATEWAY', 'ONLINE', 'OTHER'].includes(clean)) {
    return PAYMENT_TYPES.OTHER;
  }

  // Direct match if valid
  if (VALID_PAYMENT_TYPES.includes(clean)) {
    return clean;
  }

  return null;
}

/**
 * Authoritative Payment Method Normalizer
 * Accepts string or transaction object.
 * Priority order for documents:
 * 1. doc.paymentStatus (authoritative if present and maps to an explicit payment method)
 * 2. doc.paymentMethod / doc.paymentMode
 * 3. doc.razorpayPaymentId / doc.razorpayOrderId / doc.upiDetails (concrete gateway proof)
 * 4. Fallback: UNKNOWN (never guess)
 */
function normalizePaymentType(input) {
  if (!input) return PAYMENT_TYPES.UNKNOWN;

  if (typeof input === 'string') {
    return normalizeSingleString(input) || PAYMENT_TYPES.UNKNOWN;
  }

  if (typeof input === 'object') {
    // 1. paymentStatus (authoritative if present and maps to explicit payment method)
    if (input.paymentStatus) {
      const fromStatus = normalizeSingleString(input.paymentStatus);
      if (fromStatus) return fromStatus;
    }

    // 2. paymentMethod
    if (input.paymentMethod) {
      const fromMethod = normalizeSingleString(input.paymentMethod);
      if (fromMethod) return fromMethod;
    }

    // 3. paymentMode
    if (input.paymentMode) {
      const fromMode = normalizeSingleString(input.paymentMode);
      if (fromMode) return fromMode;
    }

    // 4. Concrete gateway indicators
    if (input.razorpayPaymentId || input.razorpayOrderId || (input.upiDetails && (input.upiDetails.utr || input.upiDetails.gatewayPaymentId))) {
      return PAYMENT_TYPES.UPI;
    }
  }

  return PAYMENT_TYPES.UNKNOWN;
}

/**
 * Helper to retrieve raw payment status string or fallback
 */
function getRawPaymentStatus(doc) {
  if (!doc) return 'UNKNOWN';
  if (typeof doc === 'string') return doc;
  return doc.paymentStatus || doc.paymentMethod || doc.paymentMode || 'UNKNOWN';
}

/**
 * Express middleware or query validator for paymentType parameter
 */
function validatePaymentTypeParam(val) {
  if (!val || val === 'all' || val === 'ALL') return null;
  const normalized = normalizePaymentType(val);
  return normalized;
}

module.exports = {
  PAYMENT_TYPES,
  VALID_PAYMENT_TYPES,
  normalizePaymentType,
  getRawPaymentStatus,
  validatePaymentTypeParam,
};
