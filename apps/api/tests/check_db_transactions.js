const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const User = require('../models/User');

async function checkAtlasDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log("Connecting to Atlas URI:", uri ? uri.split('@')[1] : 'NONE');
  await mongoose.connect(uri);
  console.log("=== CHECKING GLOBAL TRANSACTIONS ATLAS DB ===");

  const allTxs = await Transaction.find().populate('userId', 'name retailerId phone').sort({ createdAt: -1 }).limit(20).lean();
  console.log(`Total transactions returned in Atlas DB: ${allTxs.length}`);
  
  allTxs.forEach((t, i) => {
    console.log(`[${i+1}] Date: ${t.createdAt} | Ref: ${t.referenceId} | Status: "${t.status}" | Service: "${t.service}" | Retailer: ${t.userId?.name || 'UNKNOWN'} (${t.userId?.retailerId || 'N/A'}) | Amount: ₹${t.amountPaise/100}`);
  });

  console.log("\n=== CHECKING RECHARGE TRANSACTIONS ATLAS DB ===");
  const allRecharges = await RechargeTransaction.find().populate('userId', 'name retailerId phone').sort({ createdAt: -1 }).limit(20).lean();
  console.log(`Total RechargeTransaction returned in Atlas DB: ${allRecharges.length}`);
  allRecharges.forEach((r, i) => {
    console.log(`[${i+1}] Date: ${r.createdAt} | OrderID: ${r.orderId} | Status: "${r.status}" | Reason: "${r.failureReason || 'N/A'}" | Retailer: ${r.userId?.name || 'UNKNOWN'} (${r.userId?.retailerId || 'N/A'}) | Amount: ₹${r.amount}`);
  });

  await mongoose.disconnect();
}

checkAtlasDB();
