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
 * Normalizes any payment type input string to an authoritative controlled enum value.
 * Historical or unproven payment methods return 'UNKNOWN'.
 */
function normalizePaymentType(val) {
  if (!val || typeof val !== 'string') return PAYMENT_TYPES.UNKNOWN;
  
  const clean = val.trim().toUpperCase();
  
  // Direct match
  if (VALID_PAYMENT_TYPES.includes(clean)) {
    return clean;
  }

  // Alias mappings
  if (clean === 'WALLET' || clean === 'WALLETS') return PAYMENT_TYPES.WALLET;
  if (clean === 'UPI' || clean === 'BHIM_UPI' || clean === 'UPI_QR') return PAYMENT_TYPES.UPI;
  if (clean === 'BANK_TRANSFER' || clean === 'BANK' || clean === 'IMPS' || clean === 'NEFT' || clean === 'RTGS') return PAYMENT_TYPES.BANK_TRANSFER;
  if (clean === 'CASH') return PAYMENT_TYPES.CASH;
  if (clean === 'CARD' || clean === 'CREDIT_CARD' || clean === 'DEBIT_CARD') return PAYMENT_TYPES.CARD;
  if (clean === 'GATEWAY' || clean === 'ONLINE' || clean === 'OTHER') return PAYMENT_TYPES.OTHER;

  return PAYMENT_TYPES.UNKNOWN;
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
  validatePaymentTypeParam,
};
