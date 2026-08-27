const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Kyc = require('../models/Kyc');
const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const CommissionHistory = require('../models/CommissionHistory');

async function removeTestRetailers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[CLEANUP] Connected to MongoDB...');

    // Identify test retailers
    const testQuery = {
      $or: [
        { name: { $regex: /test/i } },
        { email: { $regex: /test/i } },
        { retailerId: { $regex: /^RET98888|^RET123456|^TEST/i } },
        { phone: { $in: ['9888877777', '9999999999', '9999000000'] } },
        { isTest: true }
      ]
    };

    const testUsers = await User.find(testQuery);
    console.log(`[CLEANUP] Found ${testUsers.length} test retailer user accounts:`);

    testUsers.forEach(u => {
      console.log(`  -> ID: ${u.retailerId} | Name: ${u.name} | Phone: ${u.phone} | Email: ${u.email || 'N/A'}`);
    });

    if (testUsers.length === 0) {
      console.log('[CLEANUP] No test retailers found to delete.');
      await mongoose.disconnect();
      return;
    }

    const testUserIds = testUsers.map(u => u._id);

    // Delete associated data across all collections
    const delWallets = await Wallet.deleteMany({ userId: { $in: testUserIds } });
    const delLedgers = await WalletLedger.deleteMany({ userId: { $in: testUserIds } });
    const delKycs = await Kyc.deleteMany({ userId: { $in: testUserIds } });
    const delBanks = await Bank.deleteMany({ userId: { $in: testUserIds } });
    const delTxns = await Transaction.deleteMany({ userId: { $in: testUserIds } });
    const delRecharges = await RechargeTransaction.deleteMany({ userId: { $in: testUserIds } });
    const delComms = await CommissionHistory.deleteMany({ userId: { $in: testUserIds } });

    // Delete users
    const delUsers = await User.deleteMany({ _id: { $in: testUserIds } });

    console.log('\n[CLEANUP SUMMARY]');
    console.log(`- Deleted User accounts: ${delUsers.deletedCount}`);
    console.log(`- Deleted Wallets: ${delWallets.deletedCount}`);
    console.log(`- Deleted Ledger entries: ${delLedgers.deletedCount}`);
    console.log(`- Deleted KYC records: ${delKycs.deletedCount}`);
    console.log(`- Deleted Bank records: ${delBanks.deletedCount}`);
    console.log(`- Deleted Transactions: ${delTxns.deletedCount}`);
    console.log(`- Deleted Recharge transactions: ${delRecharges.deletedCount}`);
    console.log(`- Deleted Commission histories: ${delComms.deletedCount}`);

    console.log('[CLEANUP] Test retailers successfully and completely removed.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
    process.exit(1);
  }
}

removeTestRetailers();
