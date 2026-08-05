const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

async function verifyExclusion() {
  await mongoose.connect(process.env.MONGODB_URI);
  const RechargeTransaction = require('./models/RechargeTransaction');
  
  // Ensure we have the TEST-12345 transaction from earlier
  const testTx = await RechargeTransaction.findOne({ orderId: 'TEST-12345' });
  if (testTx) {
    console.log(`Found test transaction: ${testTx.orderId} (Amount: ${testTx.amount})`);
  } else {
    console.log("No test transaction found. Insert one first.");
    process.exit(1);
  }

  // Fetch the Dashboard Stats via the Controller logic
  // The logic now filters out { orderId: { $not: /^TEST/i } }
  // We'll mimic the exact pipeline
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rawMatches = await RechargeTransaction.aggregate([
    { 
      $match: { 
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'SUCCESS',
        isTest: { $ne: true },
        orderId: { $not: /^TEST/i }
      } 
    }
  ]);
  console.log("Raw aggregate matches:", rawMatches.map(t => t.orderId));

  const aggregationResult = await RechargeTransaction.aggregate([
    { 
      $match: { 
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'SUCCESS',
        isTest: { $ne: true },
        orderId: { $not: /^TEST/i }
      } 
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: '$amount' }
      }
    }
  ]);

  const totalVolume = aggregationResult.length > 0 ? aggregationResult[0].totalVolume : 0;
  
  console.log(`\nVolume excluding test tx: ₹${totalVolume}`);
  if (totalVolume === 0) {
    console.log("VERIFICATION SUCCESS: Test transaction was successfully excluded from the volume.");
  } else {
    console.log("VERIFICATION FAILED: Volume should be 0 (excluding the test tx).");
  }

  // Also query the ledger
  const testLedgerQuery = await RechargeTransaction.find({
    status: 'SUCCESS',
    orderId: 'TEST-12345'
  });
  console.log(`\nLedger raw query finds: ${testLedgerQuery.length} docs`);

  const excludedLedgerQuery = await RechargeTransaction.find({
    status: 'SUCCESS',
    isTest: { $ne: true },
    orderId: { $not: /^TEST/i }
  });
  const excluded = excludedLedgerQuery.some(tx => tx.orderId === 'TEST-12345');
  console.log(`Filtered ledger query includes TEST-12345? ${excluded}`);

  if (!excluded) {
    console.log("VERIFICATION SUCCESS: Test transaction successfully excluded from default ledger view.");
  } else {
    console.log("VERIFICATION FAILED: Test transaction leaked into default view.");
  }

  process.exit(0);
}

verifyExclusion().catch(console.error);
