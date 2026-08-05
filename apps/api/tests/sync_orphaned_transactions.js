const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const User = require('../models/User');

async function syncOrphanedTransactions() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/a1recharge');
  console.log("=== CHECKING FOR UNMUTED RECHARGE TRANSACTIONS ===");

  const recharges = await RechargeTransaction.find().lean();
  console.log(`Total RechargeTransaction documents: ${recharges.length}`);

  let createdCount = 0;
  for (const r of recharges) {
    const existing = await Transaction.findOne({ referenceId: r.orderId });
    if (!existing) {
      console.log(`Found orphaned RechargeTransaction: OrderID: ${r.orderId} | Status: ${r.status}`);
      
      const mappedStatus = r.status.toLowerCase() === 'refunded' ? 'reversed' : r.status.toLowerCase();

      await Transaction.create({
        userId: r.userId,
        type: 'debit',
        amountPaise: r.amount * 100,
        status: mappedStatus,
        service: 'mobile_recharge',
        referenceId: r.orderId,
        description: `Recharge for ${r.mobileNumber}`,
        recipientName: r.mobileNumber,
        mobileNumber: r.mobileNumber,
        failureReason: r.failureReason || null,
        apiReference: r.providerTransactionId || null,
        paymentMethod: 'wallet',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
      createdCount++;
    }
  }

  console.log(`Synced ${createdCount} missing transactions into Transaction collection!`);
  await mongoose.disconnect();
}

syncOrphanedTransactions();
