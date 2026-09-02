const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function check() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const userId = new mongoose.Types.ObjectId('6a93b602ade9d8b97f64b3a9');

    const wallet = await Wallet.findOne({ userId }).lean();
    const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: 1 }).lean();
    const txns = await Transaction.find({ userId }).sort({ createdAt: 1 }).lean();

    console.log('=== RET000028 WALLET ===');
    console.log(wallet);

    console.log('\n=== RET000028 LEDGER ENTRIES ===');
    console.dir(ledgers, { depth: null });

    console.log('\n=== RET000028 TRANSACTION RECORDS ===');
    console.dir(txns, { depth: null });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
