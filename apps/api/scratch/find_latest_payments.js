const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function findLatest() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    console.log('=== SEARCHING FOR ALL RECENT PAYMENTS / TRANSACTIONS / LEDGERS IN DB ===\n');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    for (const col of collections) {
      const name = col.name;
      try {
        const recentCount = await db.collection(name).countDocuments({
          $or: [
            { createdAt: { $gte: cutoff } },
            { updatedAt: { $gte: cutoff } },
            { timestamp: { $gte: cutoff } }
          ]
        });

        if (recentCount > 0) {
          console.log(`\n================ Collection: ${name} (${recentCount} recent records) ================`);
          const docs = await db.collection(name).find({
            $or: [
              { createdAt: { $gte: cutoff } },
              { updatedAt: { $gte: cutoff } },
              { timestamp: { $gte: cutoff } }
            ]
          }).sort({ createdAt: -1, updatedAt: -1 }).limit(20).toArray();

          console.dir(docs, { depth: null });
        }
      } catch (err) {
        // ignore schema mismatch errors
      }
    }

  } catch (err) {
    console.error('Error during search:', err);
  } finally {
    await mongoose.disconnect();
  }
}

findLatest();
