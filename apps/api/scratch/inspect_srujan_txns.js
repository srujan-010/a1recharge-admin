const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function inspect() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const userId = new mongoose.Types.ObjectId('6a8c29b65578db4ad2b54247');

    console.log('=== SRUJAN AKULA LEDGER ENTRIES ===');
    const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: -1 }).lean();
    console.dir(ledgers, { depth: null });

    console.log('\n=== SRUJAN AKULA TRANSACTIONS ===');
    const txns = await Transaction.find({ userId }).sort({ createdAt: -1 }).lean();
    console.dir(txns, { depth: null });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
