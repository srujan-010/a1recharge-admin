const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function findWallets() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const wallets = await Wallet.find({}).sort({ updatedAt: -1 }).limit(10).lean();
    console.log('=== LATEST 10 UPDATED WALLETS ===');
    for (const w of wallets) {
      const u = await User.findById(w.userId).select('name phone retailerId accountType status').lean();
      const latestLedger = await WalletLedger.findOne({ userId: w.userId }).sort({ createdAt: -1 }).lean();
      const latestTxn = await Transaction.findOne({ userId: w.userId }).sort({ createdAt: -1 }).lean();
      
      console.log(`\n[${u ? u.retailerId : 'N/A'}] ${u ? u.name : 'Unknown'} (${u ? u.phone : ''})`);
      console.log(`  Wallet Balance: ₹${(w.balancePaise || 0) / 100} | Hold: ₹${(w.onHoldPaise || 0) / 100} | Updated: ${w.updatedAt}`);
      console.log(`  Latest Ledger: ${latestLedger ? `${latestLedger.transactionType} ₹${latestLedger.amount} (${latestLedger.referenceType}) at ${latestLedger.createdAt}` : 'None'}`);
      console.log(`  Latest Txn: ${latestTxn ? `${latestTxn.type} ₹${(latestTxn.amountPaise || 0)/100} (${latestTxn.service}) at ${latestTxn.createdAt}` : 'None'}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

findWallets();
