const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function searchRecent() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Check last 2 hours
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    console.log('Searching for any documents created/updated since:', cutoff.toISOString());

    for (const col of collections) {
      const name = col.name;
      const count = await db.collection(name).countDocuments({
        $or: [
          { createdAt: { $gte: cutoff } },
          { updatedAt: { $gte: cutoff } }
        ]
      });

      if (count > 0) {
        console.log(`\n=== COLLECTION: ${name} (${count} docs) ===`);
        const docs = await db.collection(name).find({
          $or: [
            { createdAt: { $gte: cutoff } },
            { updatedAt: { $gte: cutoff } }
          ]
        }).sort({ createdAt: -1, updatedAt: -1 }).toArray();

        docs.forEach((doc, idx) => {
          console.log(`\n--- ${name} Doc #${idx + 1} ---`);
          console.dir(doc, { depth: null });
        });
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

searchRecent();
