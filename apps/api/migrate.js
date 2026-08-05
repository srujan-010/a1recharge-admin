const mongoose = require('mongoose');
const OperatorCommission = require('../../apps/api/models/OperatorCommission');
const ProviderOperator = require('../../apps/api/models/ProviderOperator');

// Hardcoded slabs from legacy commissionController.js
const slabs = [
  // Mobile
  { id: 'SLAB001', serviceType: 'mobile', operatorName: 'Airtel', commissionType: 'percentage', commissionValue: 1.00, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB002', serviceType: 'mobile', operatorName: 'Jio', commissionType: 'percentage', commissionValue: 0.80, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB003', serviceType: 'mobile', operatorName: 'Vi', commissionType: 'percentage', commissionValue: 2.70, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB004', serviceType: 'mobile', operatorName: 'BSNL', commissionType: 'percentage', commissionValue: 2.00, effectiveFrom: new Date().toISOString() },
  // DTH
  { id: 'SLAB005', serviceType: 'dth', operatorName: 'Tata Play', commissionType: 'percentage', commissionValue: 3.20, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB006', serviceType: 'dth', operatorName: 'Dish TV', commissionType: 'percentage', commissionValue: 3.25, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB007', serviceType: 'dth', operatorName: 'Sun Direct', commissionType: 'percentage', commissionValue: 3.25, effectiveFrom: new Date().toISOString() },
  // Electricity
  { id: 'SLAB008', serviceType: 'bbps', operatorName: 'TSSPDCL', commissionType: 'percentage', commissionValue: 0.40, effectiveFrom: new Date().toISOString() },
  { id: 'SLAB009', serviceType: 'bbps', operatorName: 'TGSPDCL', commissionType: 'percentage', commissionValue: 0.40, effectiveFrom: new Date().toISOString() },
];

async function migrate() {
  try {
    await mongoose.connect('mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge');
    console.log('Connected to MongoDB');

    for (const slab of slabs) {
      // Find the corresponding ProviderOperator to get the exact code
      // Try to find exact match
      const regex = new RegExp(`^${slab.operatorName}$`, 'i');
      const providerOp = await ProviderOperator.findOne({ name: regex });
      
      let operatorCode = slab.operatorName.toUpperCase(); // Fallback code
      if (providerOp) {
        operatorCode = providerOp.code;
      }

      // Upsert into OperatorCommission
      await OperatorCommission.findOneAndUpdate(
        { operatorCode },
        {
          operatorName: providerOp ? providerOp.name : slab.operatorName,
          providerCommission: slab.commissionValue, // using this as provider commission for now
          retailerCommission: slab.commissionValue, // assuming full pass-through for the legacy mock data
          companyCommission: 0,
          status: 'ACTIVE'
        },
        { upsert: true, new: true }
      );
      console.log(`Migrated ${slab.operatorName} (Code: ${operatorCode}) -> ${slab.commissionValue}%`);
    }

    console.log('Migration Complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
