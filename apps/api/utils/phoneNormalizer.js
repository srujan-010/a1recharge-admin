/**
 * Utility to normalize and validate Indian mobile numbers for Fast2SMS WhatsApp API
 */
function normalizeIndianPhone(inputPhone) {
  if (!inputPhone) return null;

  // 1. Remove non-numeric characters (spaces, hyphens, plus signs, brackets)
  let cleaned = String(inputPhone).replace(/\D/g, '');

  if (!cleaned) return null;

  // 2. Handle country code variations
  if (cleaned.length === 10) {
    // Standard 10-digit mobile number starting with 6, 7, 8, or 9
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return `91${cleaned}`;
    }
    return null;
  }

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // 12-digit number starting with 91 followed by 10 digits
    const actual10 = cleaned.substring(2);
    if (/^[6-9]\d{9}$/.test(actual10)) {
      return cleaned;
    }
    return null;
  }

  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    // 11-digit number starting with 0
    const actual10 = cleaned.substring(1);
    if (/^[6-9]\d{9}$/.test(actual10)) {
      return `91${actual10}`;
    }
    return null;
  }

  return null;
}

/**
 * Filter, normalize, and deduplicate an array of phone numbers or retailer documents
 */
function processRecipientNumbers(usersOrNumbers) {
  let totalCount = 0;
  let skippedNoPhone = 0;
  let skippedInvalid = 0;
  const eligibleNumbersSet = new Set();
  const previewList = [];

  if (!Array.isArray(usersOrNumbers)) {
    return {
      totalCount: 0,
      eligibleCount: 0,
      skippedNoPhone: 0,
      skippedInvalid: 0,
      eligibleNumbers: [],
      previewList: [],
    };
  }

  totalCount = usersOrNumbers.length;

  for (const item of usersOrNumbers) {
    const rawPhone = typeof item === 'string' ? item : (item.phone || item.mobile || item.contactNumber || null);
    const retailerId = typeof item === 'object' ? item.retailerId || 'N/A' : 'N/A';
    const name = typeof item === 'object' ? item.name || 'Retailer' : 'Retailer';

    if (!rawPhone) {
      skippedNoPhone++;
      if (typeof item === 'object') {
        previewList.push({ retailerId, name, phone: 'Missing', normalizedPhone: null, isEligible: false, reason: 'No mobile number' });
      }
      continue;
    }

    const normalized = normalizeIndianPhone(rawPhone);
    if (!normalized) {
      skippedInvalid++;
      if (typeof item === 'object') {
        previewList.push({ retailerId, name, phone: String(rawPhone), normalizedPhone: null, isEligible: false, reason: 'Invalid format' });
      }
      continue;
    }

    eligibleNumbersSet.add(normalized);
    if (typeof item === 'object') {
      previewList.push({ retailerId, name, phone: String(rawPhone), normalizedPhone: normalized, isEligible: true, reason: 'Eligible' });
    }
  }

  const eligibleNumbers = Array.from(eligibleNumbersSet);

  return {
    totalCount,
    eligibleCount: eligibleNumbers.length,
    skippedNoPhone,
    skippedInvalid,
    eligibleNumbers,
    previewList,
  };
}

module.exports = {
  normalizeIndianPhone,
  processRecipientNumbers,
};
