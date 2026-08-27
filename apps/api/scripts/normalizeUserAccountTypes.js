const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function normalize() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[NORMALIZE] Connected to MongoDB.');

    const users = await User.find({ role: 'retailer' });
    console.log(`[NORMALIZE] Found ${users.length} retailer accounts.`);

    let updatedCount = 0;
    for (const u of users) {
      let rawType = (u.accountType || '').toString().trim().toUpperCase();
      let normalizedType = rawType;

      if (!['PERSONAL', 'BUSINESS'].includes(rawType)) {
        // Evaluate based on shop/business indicators
        normalizedType = (u.shopName || u.businessType || u.gstNumber) ? 'BUSINESS' : 'PERSONAL';
        console.log(`[NORMALIZE] User ${u.retailerId} (${u.name}) accountType raw '${u.accountType}' -> evaluated to '${normalizedType}'`);
      }

      if (u.accountType !== normalizedType) {
        u.accountType = normalizedType;
        await u.save();
        updatedCount++;
      }
    }

    console.log(`[NORMALIZE] Finished. Updated ${updatedCount} user documents.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[NORMALIZE ERROR]', err);
    process.exit(1);
  }
}

normalize();
