const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');

async function checkOrder() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    console.log('=== CHECKING order_TX6oSPSNIr452S ===\n');

    const ledgers = await WalletLedger.find({ referenceId: 'order_TX6oSPSNIr452S' }).lean();
    console.log('LEDGERS:', ledgers);

    const txns = await Transaction.find({ referenceId: 'order_TX6oSPSNIr452S' }).lean();
    console.log('TRANSACTIONS:', txns);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkOrder();
