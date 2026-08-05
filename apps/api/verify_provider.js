const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const RechargeTransaction = require('./models/RechargeTransaction');
  const OperatorCommission = require('./models/OperatorCommission');
  const User = require('./models/User');

  // 1. Setup mock data
  const retailer = await User.findOne({ role: 'retailer' });
  const operatorCode = 'test-op-1';
  
  // Ensure operator commission is 3.3%
  await OperatorCommission.updateOne(
    { operatorCode }, 
    { $set: { operatorCode, operatorName: 'Test Operator', providerCommission: 3.3, retailerCommission: 1.0 } },
    { upsert: true }
  );

  // Insert a test transaction for today
  await RechargeTransaction.create({
    userId: retailer._id,
    mobileNumber: '9999999999',
    operatorCode: operatorCode,
    operatorName: 'Test Operator',
    circleCode: 'TN',
    amount: 235,
    status: 'SUCCESS',
    orderId: 'TEST-12345'
  });

  console.log("Mock data inserted.");

  // 2. Fetch the Provider Wallet Stats (simulating the controller logic)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const aggregationResult = await RechargeTransaction.aggregate([
    { 
      $match: { 
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'SUCCESS',
        orderId: 'TEST-12345'
      } 
    },
    {
      $lookup: {
        from: 'operatorcommissions',
        localField: 'operatorCode',
        foreignField: 'operatorCode',
        as: 'operatorInfo'
      }
    },
    {
      $unwind: {
        path: '$operatorInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        amount: 1,
        providerCommissionAmount: {
          $ifNull: [
            { $multiply: ['$amount', { $divide: ['$operatorInfo.providerCommission', 100] }] },
            0
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: '$amount' },
        totalProviderCommission: { $sum: '$providerCommissionAmount' }
      }
    }
  ]);

  const volume = aggregationResult.length > 0 ? aggregationResult[0].totalVolume : 0;
  const comm = aggregationResult.length > 0 ? aggregationResult[0].totalProviderCommission : 0;

  console.log(`Recharge Amount: ₹${volume}`);
  console.log(`Calculated Commission: ₹${comm.toFixed(2)} (Expected ₹7.76)`);

  if (Math.abs(comm - 7.755) < 0.01) {
    console.log("VERIFICATION SUCCESS: Commission calculation matches expectations.");
  } else {
    console.log("VERIFICATION FAILED: Commission is incorrect.");
  }

  process.exit(0);
}

verify().catch(console.error);
