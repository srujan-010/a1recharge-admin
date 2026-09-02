const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function checkDetails() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    const userId = new mongoose.Types.ObjectId('6a8c29b65578db4ad2b54247');

    const user = await User.findById(userId).lean();
    const wallet = await Wallet.findOne({ userId }).lean();
    const wfts = await db.collection('walletfundingtransactions').find({ userId }).sort({ createdAt: -1 }).toArray();
    const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: -1 }).lean();
    const txns = await Transaction.find({ userId }).sort({ createdAt: -1 }).lean();

    console.log('=== USER ===', user.name, user.phone, user.retailerId);
    console.log('=== WALLET ===', wallet);

    console.log('\n=== WALLET FUNDING TRANSACTIONS ===');
    console.dir(wfts, { depth: null });

    console.log('\n=== LEDGERS ===');
    console.dir(ledgers, { depth: null });

    console.log('\n=== TRANSACTIONS ===');
    console.dir(txns, { depth: null });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkDetails();
