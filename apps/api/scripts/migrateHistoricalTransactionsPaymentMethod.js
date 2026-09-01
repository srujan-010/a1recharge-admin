const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const RechargeTransaction = require('../models/RechargeTransaction');
const Transaction = require('../models/Transaction');
const { normalizePaymentType } = require('../utils/paymentHelper');

dotenv.config();

const migrateHistoricalTransactions = async () => {
  try {
    await connectDB();
    console.log('====================================================');
    console.log(' HISTORICAL TRANSACTIONS PAYMENT METHOD MIGRATION');
    console.log('====================================================\n');

    // 1. Process RechargeTransactions
    const recharges = await RechargeTransaction.find({}).lean();
    console.log(`Found ${recharges.length} RechargeTransaction records to inspect...`);

    let rechargeStats = { UPI: 0, WALLET: 0, UNKNOWN: 0, OTHER: 0, total: 0 };
    for (const doc of recharges) {
      const canonicalMethod = normalizePaymentType(doc);
      const rawStatus = doc.paymentStatus || doc.paymentMethod || 'UNKNOWN';

      await RechargeTransaction.updateOne(
        { _id: doc._id },
        {
          $set: {
            paymentMethod: canonicalMethod,
            paymentStatus: rawStatus,
          }
        }
      );

      rechargeStats[canonicalMethod] = (rechargeStats[canonicalMethod] || 0) + 1;
      rechargeStats.total++;
    }

    console.log('\n--- RechargeTransaction Backfill Complete ---');
    console.log(JSON.stringify(rechargeStats, null, 2));

    // 2. Process Global Transactions
    const transactions = await Transaction.find({}).lean();
    console.log(`\nFound ${transactions.length} Transaction records to inspect...`);

    let txnStats = { UPI: 0, WALLET: 0, UNKNOWN: 0, OTHER: 0, total: 0 };
    for (const doc of transactions) {
      const canonicalMethod = normalizePaymentType(doc);
      const rawStatus = doc.paymentStatus || doc.paymentMethod || 'UNKNOWN';

      await Transaction.updateOne(
        { _id: doc._id },
        {
          $set: {
            paymentMethod: canonicalMethod,
            paymentStatus: rawStatus,
          }
        }
      );

      txnStats[canonicalMethod] = (txnStats[canonicalMethod] || 0) + 1;
      txnStats.total++;
    }

    console.log('\n====================================================');
    console.log(' MIGRATION COMPLETED SUCCESSFULLY');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateHistoricalTransactions();
