const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');

async function inspectSrujan() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const userId = new mongoose.Types.ObjectId('6a8c29b65578db4ad2b54247');

    const wallet = await Wallet.findOne({ userId }).lean();
    console.log('=== SRUJAN AKULA WALLET ===', wallet);

    console.log('\n=== SRUJAN AKULA LEDGER ENTRIES (ALL) ===');
    const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: -1 }).lean();
    console.dir(ledgers, { depth: null });

    console.log('\n=== SRUJAN AKULA TRANSACTIONS (ALL) ===');
    const txns = await Transaction.find({ userId }).sort({ createdAt: -1 }).lean();
    console.dir(txns, { depth: null });

    console.log('\n=== SRUJAN AKULA RECHARGE TRANSACTIONS (ALL) ===');
    const recharges = await RechargeTransaction.find({ userId }).sort({ createdAt: -1 }).lean();
    console.dir(recharges, { depth: null });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectSrujan();
