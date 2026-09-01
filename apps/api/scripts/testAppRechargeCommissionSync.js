const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mainAppMongoose = require(path.join(__dirname, '../../../../A1 Recharge/backend/node_modules/mongoose'));
const appCommissionService = require(path.join(__dirname, '../../../../A1 Recharge/backend/services/commission/commission.service.js'));
const OperatorCommission = require('../models/OperatorCommission');

async function testSync() {
  try {
    console.log('\n======================================================');
    console.log('[TEST] VERIFYING RECHARGE SYNC WITH MAIN APP');
    console.log('======================================================');

    await mongoose.connect(process.env.MONGODB_URI);
    await mainAppMongoose.connect(process.env.MONGODB_URI);
    console.log('[Commission] MongoDB connected for both instances');

    // 1. Fetch current commission slab for Airtel Business directly from MongoDB
    const opDoc = await OperatorCommission.findOne({
      accountType: 'BUSINESS',
      operatorCode: { $in: ['A', 'AT', 'AIRTEL'] }
    });

    console.log('\n[STEP 1] INITIAL DB STATE FOR AIRTEL BUSINESS:');
    console.log(`  - DB ID: ${opDoc._id}`);
    console.log(`  - Stored Code: ${opDoc.operatorCode}`);
    console.log(`  - Provider Comm: ${opDoc.providerCommission}%`);
    console.log(`  - Retailer Comm: ${opDoc.retailerCommission}%`);

    // 2. Perform recharge calculation via main A1 Recharge app commission service
    let appCalc = await appCommissionService.calculateCommission('AT', 100, 'Airtel', 'mobile', {
      orderId: 'TEST_ORD_1',
      retailerId: 'TEST_RET_1',
      accountType: 'BUSINESS'
    });

    console.log('\n[STEP 2] MAIN APP COMMISSION CALCULATION RESULT (FOR ₹100 RECHARGE):');
    console.log(`  - Record ID: ${appCalc.commissionRecordId}`);
    console.log(`  - Provider Comm %: ${appCalc.providerCommissionPercentage}%`);
    console.log(`  - Retailer Comm %: ${appCalc.retailerCommissionPercentage}%`);
    console.log(`  - Retailer Comm Amount: ₹${appCalc.retailerCommissionAmount}`);
    console.log(`  - Company Profit Amount: ₹${appCalc.companyProfitAmount}`);

    // Verify record ID match
    if (String(opDoc._id) === String(appCalc.commissionRecordId)) {
      console.log('\n✅ VERIFIED: Main App Commission Service uses the EXACT SAME MongoDB document!');
    } else {
      console.error('\n❌ ERROR: Record ID mismatch between DB and Main App!');
      process.exit(1);
    }

    await mongoose.disconnect();
    await mainAppMongoose.disconnect();
    console.log('\n======================================================');
    console.log('SUCCESS: Main App and Admin share 100% same commission source!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('[SYNC TEST ERROR]', err);
    process.exit(1);
  }
}

testSync();
