const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function verifyRetailers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const retailers = await User.find({ role: 'retailer' }).sort({ createdAt: -1 }).lean();

    console.log('\n========================================');
    console.log('      RETAILER ACCOUNT TYPE AUDIT       ');
    console.log('========================================');

    retailers.forEach(r => {
      console.log(`[RETAILER ACCOUNT TYPE]`);
      console.log(`retailerId  : ${r.retailerId}`);
      console.log(`name        : ${r.name}`);
      console.log(`shopName    : ${r.shopName || 'N/A'}`);
      console.log(`accountType : ${r.accountType}`);
      console.log('----------------------------------------');
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

verifyRetailers();
