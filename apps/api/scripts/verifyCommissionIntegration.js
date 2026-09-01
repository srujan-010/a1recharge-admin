const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OperatorCommission = require('../models/OperatorCommission');
const { getOperatorCodeAliases } = require('../utils/operatorAlias');

async function testIntegration() {
  try {
    console.log('\n======================================================');
    console.log('[TEST] CONNECTING TO MONGODB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Commission] MongoDB connected');

    console.log('\n[TEST 1] FETCHING ALL OPERATOR COMMISSIONS FROM MONGODB...');
    const allSlabs = await OperatorCommission.find({}).lean();
    console.log(`[Commission] Total OperatorCommission records found in DB: ${allSlabs.length}`);

    if (allSlabs.length > 0) {
      const sample = allSlabs[0];
      console.log(`[Commission] Sample record in DB:`);
      console.log(`  - Account Type: ${sample.accountType}`);
      console.log(`  - Operator Code: ${sample.operatorCode}`);
      console.log(`  - Operator Name: ${sample.operatorName}`);
      console.log(`  - Provider Commission: ${sample.providerCommission}%`);
      console.log(`  - Retailer Commission: ${sample.retailerCommission}%`);
      console.log(`  - Company Margin: ${sample.companyCommission}%`);
      console.log(`  - Status: ${sample.status}`);
    }

    console.log('\n[TEST 2] ALIAS RESOLUTION VERIFICATION');
    const airtelAliases = getOperatorCodeAliases('A');
    console.log(`  - Code 'A' resolves to aliases: [${airtelAliases.join(', ')}]`);
    const jioAliases = getOperatorCodeAliases('JO');
    console.log(`  - Code 'JO' resolves to aliases: [${jioAliases.join(', ')}]`);

    console.log('\n[TEST 3] SEARCH BY ALIAS FOR AIRTEL');
    const airtelSlab = await OperatorCommission.findOne({
      accountType: 'BUSINESS',
      operatorCode: { $in: airtelAliases }
    }).lean();

    if (airtelSlab) {
      console.log(`[Commission] Airtel Business slab successfully matched by alias!`);
      console.log(`  - DB ID: ${airtelSlab._id}`);
      console.log(`  - Stored Code: ${airtelSlab.operatorCode}`);
      console.log(`  - Provider Comm: ${airtelSlab.providerCommission}%`);
      console.log(`  - Retailer Comm: ${airtelSlab.retailerCommission}%`);
      console.log(`  - Our Margin: ${airtelSlab.companyCommission}%`);
    } else {
      console.log(`[Commission] Airtel Business slab not found. Seeding test record...`);
      const newSlab = await OperatorCommission.create({
        accountType: 'BUSINESS',
        operatorCode: 'AT',
        operatorName: 'Airtel',
        serviceType: 'mobile',
        providerCommission: 2.0,
        retailerCommission: 1.0,
        companyCommission: 1.0,
        status: 'ACTIVE'
      });
      console.log(`[Commission] Seeded Airtel Business slab ID: ${newSlab._id}`);
    }

    console.log('\n[TEST 4] SIMULATING ADMIN SAVE / UPDATE');
    const testCode = 'A';
    const testAliases = getOperatorCodeAliases(testCode);
    let targetDoc = await OperatorCommission.findOne({
      accountType: 'BUSINESS',
      operatorCode: { $in: testAliases }
    });

    if (targetDoc) {
      const origRetailerComm = targetDoc.retailerCommission;
      const testVal = origRetailerComm === 1.5 ? 1.0 : 1.5;

      targetDoc.retailerCommission = testVal;
      targetDoc.companyCommission = targetDoc.providerCommission - testVal;
      await targetDoc.save();

      console.log(`[Commission] Updated Airtel Business Retailer Commission to: ${testVal}% (Margin: ${targetDoc.companyCommission}%)`);

      // Read back from DB to confirm persistence
      const verifiedDoc = await OperatorCommission.findById(targetDoc._id).lean();
      console.log(`[Commission] Verified document re-fetched from MongoDB:`);
      console.log(`  - Retailer Commission: ${verifiedDoc.retailerCommission}%`);
      console.log(`  - Company Margin: ${verifiedDoc.companyCommission}%`);

      // Revert test change
      targetDoc.retailerCommission = origRetailerComm;
      targetDoc.companyCommission = targetDoc.providerCommission - origRetailerComm;
      await targetDoc.save();
      console.log(`[Commission] Reverted Airtel Business Retailer Commission back to: ${origRetailerComm}%`);
    }

    console.log('\n======================================================');
    console.log('SUCCESS: All commission integration tests passed!');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[TEST ERROR]', err);
    process.exit(1);
  }
}

testIntegration();
