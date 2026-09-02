const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');

async function inspectRet28() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const userId = new mongoose.Types.ObjectId('6a93b602ade9d8b97f64b3a9');

    const user = await User.findById(userId).lean();
    console.log('USER DETAILS:', user);

    const wallet = await Wallet.findOne({ userId }).lean();
    console.log('\nWALLET DETAILS:', wallet);

    const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: -1 }).lean();
    console.log(`\nLEDGERS COUNT (${ledgers.length}):`, ledgers);

    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 }).lean();
    console.log(`\nTRANSACTIONS COUNT (${transactions.length}):`, transactions);

    const recharges = await RechargeTransaction.find({ userId }).sort({ createdAt: -1 }).lean();
    console.log(`\nRECHARGE TRANSACTIONS COUNT (${recharges.length}):`, recharges);

    // Let's also check if there are any orphaned topups or payments across the system for phone 7588661343 or name shriniwas
    console.log('\n--- CHECKING ALL COLLECTIONS FOR PHONE 7588661343 ---');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const name = col.name;
      try {
        const count = await db.collection(name).countDocuments({
          $or: [
            { userId: userId },
            { phone: '7588661343' },
            { mobileNumber: '7588661343' },
            { retailerId: 'RET000028' }
          ]
        });
        if (count > 0) {
          console.log(`Collection ${name}: ${count} matching docs`);
          const docs = await db.collection(name).find({
            $or: [
              { userId: userId },
              { phone: '7588661343' },
              { mobileNumber: '7588661343' },
              { retailerId: 'RET000028' }
            ]
          }).toArray();
          console.dir(docs, { depth: null });
        }
      } catch (e) {
        // ignore query errors for incompatible schemas
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectRet28();
