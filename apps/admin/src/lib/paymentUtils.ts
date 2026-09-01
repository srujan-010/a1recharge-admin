export type PaymentMethodType = 'WALLET' | 'UPI' | 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'OTHER' | 'UNKNOWN';

/**
 * Normalizes a raw payment status string to canonical PaymentMethodType
 */
export function normalizeSinglePaymentString(val?: string | null): PaymentMethodType | null {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().toUpperCase();

  // Explicit UPI / Gateway aliases
  if (['RAZORPAY_UPI', 'RAZORPAY', 'UPI', 'BHIM_UPI', 'UPI_QR'].includes(clean)) {
    return 'UPI';
  }
  // Explicit Wallet aliases
  if (['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT'].includes(clean)) {
    return 'WALLET';
  }
  // Bank transfer aliases
  if (['BANK_TRANSFER', 'BANK', 'IMPS', 'NEFT', 'RTGS'].includes(clean)) {
    return 'BANK_TRANSFER';
  }
  // Cash
  if (clean === 'CASH') {
    return 'CASH';
  }
  // Card
  if (['CARD', 'CREDIT_CARD', 'DEBIT_CARD'].includes(clean)) {
    return 'CARD';
  }
  // Gateway / Online / Other
  if (['GATEWAY', 'ONLINE', 'OTHER'].includes(clean)) {
    return 'OTHER';
  }

  if (['WALLET', 'UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER', 'UNKNOWN'].includes(clean)) {
    return clean as PaymentMethodType;
  }

  return null;
}

/**
 * Centralized Frontend Helper for Payment Method Classification.
 * Inspects paymentStatus first (authoritative), then paymentMethod/paymentMode, then gateway attributes.
 */
export function getPaymentMethod(txn?: any): PaymentMethodType {
  if (!txn) return 'UNKNOWN';

  if (typeof txn === 'string') {
    return normalizeSinglePaymentString(txn) || 'UNKNOWN';
  }

  if (typeof txn === 'object') {
    // 1. Check paymentStatus (authoritative)
    if (txn.paymentStatus) {
      const fromStatus = normalizeSinglePaymentString(txn.paymentStatus);
      if (fromStatus) return fromStatus;
    }

    // 2. Check paymentMethod
    if (txn.paymentMethod) {
      const fromMethod = normalizeSinglePaymentString(txn.paymentMethod);
      if (fromMethod) return fromMethod;
    }

    // 3. Check paymentMode
    if (txn.paymentMode) {
      const fromMode = normalizeSinglePaymentString(txn.paymentMode);
      if (fromMode) return fromMode;
    }

    // 4. Concrete gateway indicators
    if (txn.razorpayPaymentId || txn.razorpayOrderId || (txn.upiDetails && (txn.upiDetails.utr || txn.upiDetails.gatewayPaymentId))) {
      return 'UPI';
    }
  }

  return 'UNKNOWN';
}

/**
 * Returns raw payment status string or fallback
 */
export function getPaymentStatus(txn?: any): string {
  if (!txn) return 'UNKNOWN';
  if (typeof txn === 'string') return txn;
  return txn.paymentStatus || txn.paymentMethod || txn.paymentMode || 'UNKNOWN';
}
