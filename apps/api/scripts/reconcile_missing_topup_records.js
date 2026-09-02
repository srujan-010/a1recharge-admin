const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function reconcile() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    console.log('=== STARTING RECONCILIATION FOR MISSING TOP-UP RECORDS ===\n');

    const ret28User = await User.findOne({ retailerId: 'RET000028' }).lean();
    if (!ret28User) {
      console.log('Retailer RET000028 not found.');
      return;
    }

    const userId = ret28User._id;
    console.log(`Processing Retailer RET000028 (${ret28User.name}, ${ret28User._id})...`);

    // Check if RET000028 already has a WalletLedger or Transaction record for ₹500
    const existingLedger = await WalletLedger.findOne({
      userId,
      amount: 500,
      referenceType: { $in: ['ADD_MONEY', 'MANUAL', 'WALLET_TOPUP'] }
    });

    const existingTxn = await Transaction.findOne({
      userId,
      service: 'wallet_topup',
      amountPaise: 50000
    });

    const topupTimestamp = new Date('2026-09-02T08:10:00.000Z');
    const refId = 'TOPUP_RET28_500_RECONCILED';

    // 1. Backfill WalletLedger if missing
    if (!existingLedger) {
      const newLedger = await WalletLedger.create({
        userId,
        transactionType: 'CREDIT',
        amount: 500,
        balanceAfter: 690.1,
        referenceType: 'ADD_MONEY',
        referenceId: refId,
        description: 'Wallet Top-up via UPI (Reconciled)',
        createdAt: topupTimestamp,
        updatedAt: topupTimestamp
      });
      console.log('✅ Created missing WalletLedger entry for RET000028:', newLedger._id);
    } else {
      console.log('ℹ️ WalletLedger entry for ₹500 already exists:', existingLedger._id);
    }

    let userAccType = 'BUSINESS';
    if (ret28User.accountType && ['PERSONAL', 'BUSINESS'].includes(ret28User.accountType.toUpperCase())) {
      userAccType = ret28User.accountType.toUpperCase();
    }

    // 2. Backfill Transaction if missing
    if (!existingTxn) {
      const newTxn = await Transaction.create({
        userId,
        accountType: userAccType,
        type: 'credit',
        amountPaise: 50000,
        status: 'success',
        service: 'wallet_topup',
        referenceId: refId,
        description: 'Wallet Top-up via UPI',
        closingBalancePaise: 69010,
        paymentMethod: 'UPI',
        paymentStatus: 'RAZORPAY_UPI',
        upiDetails: {
          utr: 'RECONCILED_UPI',
          gateway: 'Razorpay UPI'
        },
        createdAt: topupTimestamp,
        updatedAt: topupTimestamp
      });
      console.log('✅ Created missing Transaction record for RET000028:', newTxn._id);
    } else {
      console.log('ℹ️ Transaction record for ₹500 already exists:', existingTxn._id);
    }

    console.log('\n🎉 RECONCILIATION COMPLETED SUCCESSFULLY FOR RET000028!');

  } catch (err) {
    console.error('Reconciliation error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

reconcile();
