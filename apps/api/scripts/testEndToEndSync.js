const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mainAppMongoose = require(path.join(__dirname, '../../../../A1 Recharge/backend/node_modules/mongoose'));
const appCommissionService = require(path.join(__dirname, '../../../../A1 Recharge/backend/services/commission/commission.service.js'));
const { updateCommission } = require('../controllers/admin/commissionController');
const OperatorCommission = require('../models/OperatorCommission');

async function testEndToEnd() {
  try {
    console.log('\n======================================================');
    console.log('[TEST] END-TO-END ADMIN UPDATE -> APP RECHARGE SYNC');
    console.log('======================================================');

    await mongoose.connect(process.env.MONGODB_URI);
    await mainAppMongoose.connect(process.env.MONGODB_URI);
    console.log('[Commission] MongoDB connected for both instances');

    // 1. Initial State Check
    const initialDoc = await OperatorCommission.findOne({
      accountType: 'BUSINESS',
      operatorCode: { $in: ['A', 'AT', 'AIRTEL'] }
    });
    console.log(`\n[BEFORE UPDATE] Stored Retailer Commission: ${initialDoc.retailerCommission}%`);

    // 2. Perform Admin Update via Admin Controller function
    const mockReq = {
      params: { id: 'A' },
      body: {
        accountType: 'BUSINESS',
        providerCommission: 2.5,
        retailerCommission: 1.5,
        operatorName: 'Airtel'
      },
      admin: { _id: 'test_admin', role: 'SUPER_ADMIN' }
    };

    let updatedResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          updatedResult = data;
        }
      })
    };

    await updateCommission(mockReq, mockRes, (err) => { if (err) throw err; });

    console.log(`\n[ADMIN API UPDATED] Admin API returned success: ${updatedResult.success}`);
    console.log(`  - Updated Provider Comm: ${updatedResult.data.providerCommission}%`);
    console.log(`  - Updated Retailer Comm: ${updatedResult.data.retailerCommission}%`);
    console.log(`  - Updated Company Margin: ${updatedResult.data.companyCommission}%`);

    // 3. Perform Main App Recharge Calculation
    const appCalc = await appCommissionService.calculateCommission('AT', 100, 'Airtel', 'mobile', {
      orderId: 'TEST_SYNC_999',
      retailerId: 'TEST_RET_999',
      accountType: 'BUSINESS'
    });

    console.log(`\n[MAIN APP RECHARGE CALCULATION RESULT]`);
    console.log(`  - Record ID used: ${appCalc.commissionRecordId}`);
    console.log(`  - Provider Comm % used: ${appCalc.providerCommissionPercentage}%`);
    console.log(`  - Retailer Comm % used: ${appCalc.retailerCommissionPercentage}%`);
    console.log(`  - Retailer Comm Amount for ₹100: ₹${appCalc.retailerCommissionAmount}`);

    if (appCalc.retailerCommissionPercentage === 1.5) {
      console.log('\n✅ SUCCESS: Main App immediately picked up updated 1.5% Retailer Commission from MongoDB!');
    } else {
      console.error(`\n❌ ERROR: Main App calculated with ${appCalc.retailerCommissionPercentage}% instead of 1.5%!`);
      process.exit(1);
    }

    // 4. Revert to original values (0.8% provider, 0.4% retailer)
    mockReq.body.providerCommission = 0.8;
    mockReq.body.retailerCommission = 0.4;
    await updateCommission(mockReq, mockRes, (err) => { if (err) throw err; });
    console.log(`\n[REVERTED] Reset Airtel Business commission back to Provider 0.8% / Retailer 0.4%`);

    await mongoose.disconnect();
    await mainAppMongoose.disconnect();
    console.log('\n======================================================');
    console.log('END-TO-END VERIFICATION FULLY PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('[END-TO-END ERROR]', err);
    process.exit(1);
  }
}

testEndToEnd();
