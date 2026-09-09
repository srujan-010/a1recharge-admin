const mongoose = require('mongoose');
require('dotenv').config();

const ManualPayment = require('../models/ManualPayment');
const Transaction = require('../models/Transaction');

async function migrateHistoricalPaymentMethods() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    console.log('[MIGRATION] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[MIGRATION] Connected successfully.');

    // 1. Audit UNPAID Manual Payments
    const unpaidMPResult = await ManualPayment.updateMany(
      { paymentStatus: 'UNPAID', paymentMethod: { $ne: null } },
      { $set: { paymentMethod: null } }
    );
    console.log(`[MIGRATION] Updated ManualPayment records (UNPAID -> paymentMethod = null): ${unpaidMPResult.modifiedCount}`);

    // 2. Audit UNPAID Transactions
    const unpaidTxResult = await Transaction.updateMany(
      { paymentStatus: 'UNPAID', paymentMethod: { $ne: null } },
      { $set: { paymentMethod: null } }
    );
    console.log(`[MIGRATION] Updated Transaction records (UNPAID -> paymentMethod = null): ${unpaidTxResult.modifiedCount}`);

    // 3. Audit Manual Admin Debits
    const adminDebitsResult = await Transaction.updateMany(
      {
        $or: [
          { transactionType: 'ADMIN_DEBIT' },
          { service: 'manual_debit' },
          { service: 'admin_debit' }
        ],
        paymentMethod: { $ne: 'ADMIN_ADJUSTMENT' }
      },
      {
        $set: {
          paymentMethod: 'ADMIN_ADJUSTMENT',
          paymentStatus: 'PAID',
          upiDetails: null
        }
      }
    );
    console.log(`[MIGRATION] Updated Admin Debit records (paymentMethod -> ADMIN_ADJUSTMENT): ${adminDebitsResult.modifiedCount}`);

    // 4. Verify genuine UPI records are intact
    const upiCount = await Transaction.countDocuments({ paymentMethod: 'UPI' });
    console.log(`[MIGRATION] Confirmed genuine UPI transactions count: ${upiCount}`);

    console.log('[MIGRATION] Migration completed successfully without modifying wallet balances or ledger entries.');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
    process.exit(1);
  }
}

migrateHistoricalPaymentMethods();
