const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function verifyStep13() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('==============================================');
    console.log('          STEP 13 ACCEPTANCE VERIFICATION      ');
    console.log('==============================================');

    // 1. Direct query for RET000013 (Srujan Akula)
    const srujan = await User.findOne({ retailerId: 'RET000013' }).lean();
    console.log(`\n[1] RET000013 (Srujan Akula) Direct MongoDB Record:`);
    console.log(`    retailerId  : ${srujan.retailerId}`);
    console.log(`    name        : ${srujan.name}`);
    console.log(`    shopName    : ${srujan.shopName}`);
    console.log(`    accountType : ${srujan.accountType}`);

    if (srujan.accountType === 'BUSINESS') {
      console.log(`    STATUS: PASS (accountType is BUSINESS)`);
    } else {
      console.error(`    STATUS: FAIL (accountType is ${srujan.accountType})`);
    }

    // 2. Direct query for RET000014 (pravin)
    const pravin = await User.findOne({ retailerId: 'RET000014' }).lean();
    console.log(`\n[2] RET000014 (Pravin traders) Direct MongoDB Record:`);
    console.log(`    retailerId  : ${pravin.retailerId}`);
    console.log(`    name        : ${pravin.name}`);
    console.log(`    shopName    : ${pravin.shopName}`);
    console.log(`    accountType : ${pravin.accountType}`);

    if (pravin.accountType === 'BUSINESS') {
      console.log(`    STATUS: PASS (accountType is BUSINESS)`);
    } else {
      console.error(`    STATUS: FAIL (accountType is ${pravin.accountType})`);
    }

    // 3. Query with accountType=BUSINESS filter
    const businessUsers = await User.find({ role: 'retailer', accountType: 'BUSINESS' }).lean();
    console.log(`\n[3] BUSINESS Filter Query Results (${businessUsers.length} retailers):`);
    businessUsers.forEach(u => console.log(`    - ${u.retailerId} | ${u.name} | ${u.shopName} | ${u.accountType}`));
    const srujanInBusiness = businessUsers.some(u => u.retailerId === 'RET000013');
    console.log(`    Srujan Akula in BUSINESS filter: ${srujanInBusiness ? 'YES (PASS)' : 'NO (FAIL)'}`);

    // 4. Query with accountType=PERSONAL filter
    const personalUsers = await User.find({ role: 'retailer', accountType: 'PERSONAL' }).lean();
    console.log(`\n[4] PERSONAL Filter Query Results (${personalUsers.length} retailers):`);
    personalUsers.forEach(u => console.log(`    - ${u.retailerId} | ${u.name} | ${u.shopName} | ${u.accountType}`));
    const srujanInPersonal = personalUsers.some(u => u.retailerId === 'RET000013');
    console.log(`    Srujan Akula in PERSONAL filter: ${!srujanInPersonal ? 'NO (PASS - correctly excluded)' : 'YES (FAIL)'}`);

    console.log('\n==============================================');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  }
}

verifyStep13();
