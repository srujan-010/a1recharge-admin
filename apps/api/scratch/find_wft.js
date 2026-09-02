const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function findWft() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    console.log('=== SEARCHING walletfundingtransactions COLLECTION ===\n');

    const wfts = await db.collection('walletfundingtransactions').find({}).sort({ createdAt: -1 }).limit(20).toArray();
    console.log(`Found ${wfts.length} WalletFundingTransaction records:`);
    console.dir(wfts, { depth: null });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

findWft();
