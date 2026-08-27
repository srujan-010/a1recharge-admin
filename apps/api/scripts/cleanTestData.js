const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Kyc = require('../models/Kyc');
const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const CommissionHistory = require('../models/CommissionHistory');
const AuditLog = require('../models/AuditLog');
const TransactionActionLog = require('../models/TransactionActionLog');
const Notification = require('../models/Notification');
const NotificationHistory = require('../models/NotificationHistory');
const SupportTicket = require('../models/SupportTicket');

async function cleanTestData() {
  try {
    console.log('[CLEANUP] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[CLEANUP] Connected to MongoDB database successfully.');

    // 1. Identify Test Retailer Users
    const testUsers = await User.find({
      $or: [
        { name: { $regex: /test/i } },
        { email: { $regex: /test/i } },
        { retailerId: { $regex: /^RET98888|^RET123456|^TEST/i } },
        { phone: { $in: ['9888877777', '9999999999', '9999000000'] } },
        { isTest: true }
      ]
    }).lean();

    const testUserIds = testUsers.map(u => u._id);
    console.log(`[CLEANUP] Found ${testUsers.length} test retailer accounts to delete.`);

    // 2. Identify Test Recharge Transactions
    const testRecharges = await RechargeTransaction.find({
      $or: [
        { userId: { $in: testUserIds } },
        { mobileNumber: { $in: ['9876543210', '9999999999', '9999000000', '1234567890', '0000000000'] } },
        { orderId: { $regex: /^TEST_/i } },
        { remarks: { $regex: /test|demo|mock/i } },
        { isTest: true }
      ]
    }).lean();

    const testRechargeIds = testRecharges.map(r => r._id);
    console.log(`[CLEANUP] Found ${testRecharges.length} test recharge records to delete.`);

    // 3. Identify Test Financial Transactions (`Transaction`)
    const testTransactions = await Transaction.find({
      $or: [
        { userId: { $in: testUserIds } },
        { description: { $regex: /test|demo/i } },
        { mobileNumber: { $in: ['9876543210', '9999999999', '9999000000'] } }
      ]
    }).lean();
    const testTxnIds = testTransactions.map(t => t._id);
    console.log(`[CLEANUP] Found ${testTransactions.length} test general financial transactions to delete.`);

    // 4. Perform Deletions
    const delWallets = await Wallet.deleteMany({ userId: { $in: testUserIds } });
    const delLedgers = await WalletLedger.deleteMany({ userId: { $in: testUserIds } });
    const delKycs = await Kyc.deleteMany({ userId: { $in: testUserIds } });
    const delBanks = await Bank.deleteMany({ userId: { $in: testUserIds } });
    const delComms = await CommissionHistory.deleteMany({ userId: { $in: testUserIds } });
    const delNotifs = await Notification.deleteMany({ userId: { $in: testUserIds } });
    const delNotifHist = await NotificationHistory.deleteMany({ userId: { $in: testUserIds } });
    const delTickets = await SupportTicket.deleteMany({ userId: { $in: testUserIds } });
    const delAudit = await AuditLog.deleteMany({
      $or: [
        { userId: { $in: testUserIds } },
        { targetUserId: { $in: testUserIds } }
      ]
    });

    const delTxns = await Transaction.deleteMany({ _id: { $in: testTxnIds } });
    const delRecharges = await RechargeTransaction.deleteMany({ _id: { $in: testRechargeIds } });
    const delUsers = await User.deleteMany({ _id: { $in: testUserIds } });

    console.log('\n======================================================');
    console.log('DATABASE CLEANUP EXECUTION SUMMARY');
    console.log('======================================================');
    console.log(`- Deleted User accounts: ${delUsers.deletedCount}`);
    console.log(`- Deleted Wallets: ${delWallets.deletedCount}`);
    console.log(`- Deleted WalletLedgers: ${delLedgers.deletedCount}`);
    console.log(`- Deleted KYCs: ${delKycs.deletedCount}`);
    console.log(`- Deleted Bank accounts: ${delBanks.deletedCount}`);
    console.log(`- Deleted Financial Transactions: ${delTxns.deletedCount}`);
    console.log(`- Deleted Recharge Transactions: ${delRecharges.deletedCount}`);
    console.log(`- Deleted Commission Histories: ${delComms.deletedCount}`);
    console.log(`- Deleted Audit Logs: ${delAudit.deletedCount}`);
    console.log(`- Deleted Notifications: ${delNotifs.deletedCount + delNotifHist.deletedCount}`);
    console.log(`- Deleted Support Tickets: ${delTickets.deletedCount}`);

    // 5. Verification of Remaining Data
    const remainingUsers = await User.countDocuments({});
    const remainingRecharges = await RechargeTransaction.countDocuments({});
    const remainingTxns = await Transaction.countDocuments({});
    const remainingWallets = await Wallet.countDocuments({});

    console.log('\n======================================================');
    console.log('REMAINING GENUINE DATABASE METRICS');
    console.log('======================================================');
    console.log(`- Remaining Retailers/Users: ${remainingUsers}`);
    console.log(`- Remaining Recharge Transactions: ${remainingRecharges}`);
    console.log(`- Remaining Financial Transactions: ${remainingTxns}`);
    console.log(`- Remaining Retailer Wallets: ${remainingWallets}`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    console.log('[CLEANUP] Database cleanup complete successfully.');
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
    process.exit(1);
  }
}

cleanTestData();
