const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

/**
 * Generic, data-driven, idempotent migration for Retailer Account Types.
 * Strictly uses persisted MongoDB business onboarding fields (shopName, businessType, gstNumber)
 * without hardcoded user IDs or names.
 */
async function migrateAccountTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MIGRATION] Connected to MongoDB...');

    const retailers = await User.find({ role: 'retailer' });
    console.log(`[MIGRATION] Auditing ${retailers.length} retailer accounts...`);

    let updatedCount = 0;

    for (const r of retailers) {
      const hasBusinessProfile = Boolean(
        (r.shopName && r.shopName.trim() !== '') ||
        (r.businessType && r.businessType.trim() !== '') ||
        (r.gstNumber && r.gstNumber.trim() !== '')
      );

      const targetType = hasBusinessProfile ? 'BUSINESS' : 'PERSONAL';

      const isLegacyOrInvalid = !r.accountType || !['PERSONAL', 'BUSINESS'].includes(r.accountType);
      const isMisclassifiedPersonal = r.accountType === 'PERSONAL' && hasBusinessProfile;

      if (isLegacyOrInvalid || isMisclassifiedPersonal || r.accountType !== targetType) {
        const oldType = r.accountType;
        r.accountType = targetType;
        await r.save();
        updatedCount++;
        console.log(`[MIGRATED] Retailer ${r.retailerId} (${r.name}) | Shop: ${r.shopName || 'N/A'} | ${oldType} -> ${targetType}`);
      } else {
        console.log(`[UNCHANGED] Retailer ${r.retailerId} (${r.name}) | Shop: ${r.shopName || 'N/A'} | accountType: ${r.accountType}`);
      }
    }

    console.log(`[MIGRATION] Migration finished. ${updatedCount} records updated.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('[MIGRATION_ERROR] Failed:', err);
    process.exit(1);
  }
}

migrateAccountTypes();
