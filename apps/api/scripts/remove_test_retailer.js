const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const ManualPayment = require('../models/ManualPayment');
const AuditLog = require('../models/AuditLog');

const removeTestRetailer = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    // Find test retailer(s) by name or phone or retailerId
    const testRetailers = await User.find({
      $or: [
        { name: { $regex: /Acceptance Retailer Test/i } },
        { phone: '9998887770' },
        { retailerId: 'RET999888' }
      ]
    });

    console.log(`Found ${testRetailers.length} test retailer record(s).`);

    const retailerIds = testRetailers.map(r => r._id);

    if (retailerIds.length > 0) {
      // Delete associated Transactions
      const txRes = await Transaction.deleteMany({
        $or: [
          { userId: { $in: retailerIds } },
          { performedBy: { $regex: /Acceptance Retailer Test/i } }
        ]
      });
      console.log(`Deleted ${txRes.deletedCount} Transaction(s).`);

      // Delete associated WalletLedger
      const wlRes = await WalletLedger.deleteMany({ userId: { $in: retailerIds } });
      console.log(`Deleted ${wlRes.deletedCount} WalletLedger record(s).`);

      // Delete associated ManualPayments
      const mpRes = await ManualPayment.deleteMany({
        $or: [
          { retailerId: { $in: retailerIds } },
          { retailerName: { $regex: /Acceptance Retailer Test/i } }
        ]
      });
      console.log(`Deleted ${mpRes.deletedCount} ManualPayment record(s).`);

      // Delete associated Wallets
      const wRes = await Wallet.deleteMany({ userId: { $in: retailerIds } });
      console.log(`Deleted ${wRes.deletedCount} Wallet record(s).`);

      // Delete associated AuditLogs
      const alRes = await AuditLog.deleteMany({
        $or: [
          { 'metadata.userId': { $in: retailerIds } },
          { 'metadata.retailerId': { $in: retailerIds } }
        ]
      });
      console.log(`Deleted ${alRes.deletedCount} AuditLog record(s).`);

      // Delete User record(s)
      const uRes = await User.deleteMany({ _id: { $in: retailerIds } });
      console.log(`Deleted ${uRes.deletedCount} User record(s).`);
    } else {
      // Also cleanup any orphaned manual payments or transactions matching name
      const orphanedMp = await ManualPayment.deleteMany({ retailerName: { $regex: /Acceptance Retailer Test/i } });
      console.log(`Deleted ${orphanedMp.deletedCount} orphaned ManualPayment record(s).`);
    }

    console.log('SUCCESS: Acceptance Retailer Test and all associated transactions removed completely!');
    process.exit(0);
  } catch (error) {
    console.error('Error removing test retailer:', error);
    process.exit(1);
  }
};

removeTestRetailer();
