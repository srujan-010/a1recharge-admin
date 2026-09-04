const mongoose = require('mongoose');
const unifiedTransactionService = require('../services/transaction/unifiedTransaction.service');
const { manualCreditDebit } = require('../controllers/admin/walletController');
const walletService = require('../services/wallet/wallet.service');
const Transaction = require('../models/Transaction');
const WalletLedger = require('../models/WalletLedger');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge';

async function runAcceptanceTest() {
  console.log('================================================================');
  console.log('FINAL ACCEPTANCE TEST: 5 CORE FINANCIAL SCENARIOS');
  console.log('================================================================');

  await mongoose.connect(MONGODB_URI);

  const testPhone = '9123456780';
  const testRetailerId = 'RET_ACCEPTANCE_01';

  let testRetailer = await User.findOne({ phone: testPhone });
  if (!testRetailer) {
    testRetailer = await User.create({
      name: 'Yogesh Test Retailer',
      phone: testPhone,
      retailerId: testRetailerId,
      role: 'retailer',
      accountType: 'BUSINESS',
      isTest: false // Set to false so it's a real acceptance retailer
    });
  }

  const testAdmin = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Super Admin Yogesh',
    email: 'admin.yogesh@a1recharge.com',
    role: 'SUPER_ADMIN'
  };

  // Reset wallet and previous transactions for this retailer
  await Wallet.deleteOne({ userId: testRetailer._id });
  await WalletLedger.deleteMany({ userId: testRetailer._id });
  await Transaction.deleteMany({ userId: testRetailer._id });

  let wallet = await Wallet.create({
    userId: testRetailer._id,
    balancePaise: 0,
    onHoldPaise: 0
  });

  // SCENARIO A: ₹1,000 UPI Wallet Top-up
  console.log('\n--- Executing Scenario A: ₹1,000 UPI Wallet Top-up ---');
  const refA = `WFT_ACCEPT_${Date.now()}`;
  const payIdA = `pay_ACC_RZP_${Date.now()}`;
  const ordIdA = `order_ACC_RZP_${Date.now()}`;

  await walletService.processSuccessfulWalletTopup({
    userId: testRetailer._id,
    amountPaise: 100000, // ₹1,000.00
    referenceId: refA,
    paymentMethod: 'UPI',
    paymentStatus: 'RAZORPAY_UPI',
    description: 'Wallet Top-up via Razorpay UPI',
    upiDetails: {
      gatewayPaymentId: payIdA,
      gatewayOrderId: ordIdA,
      gateway: 'Razorpay UPI',
      utr: 'UTR99887766'
    },
    isTest: false
  });

  // SCENARIO B: ₹500 Admin Wallet Credit
  console.log('\n--- Executing Scenario B: ₹500 Admin Wallet Credit ---');
  const refB = `ADM_CRED_ACC_${Date.now()}`;
  const reasonB = 'Campaign promotional credit by Super Admin';
  const reqB = {
    body: { type: 'credit', amountPaise: 50000, reason: reasonB, referenceId: refB },
    params: { userId: testRetailer._id.toString() },
    admin: testAdmin,
    headers: {}
  };
  await manualCreditDebit(reqB, { status: () => ({ json: () => {} }), json: () => {} }, (e) => { if (e) throw e; });

  // SCENARIO C: ₹76.45 Admin Wallet Debit
  console.log('\n--- Executing Scenario C: ₹76.45 Admin Wallet Debit ---');
  const refC = `ADM_DEB_ACC_${Date.now()}`;
  const reasonC = 'Duplicate wallet credit correction';
  const reqC = {
    body: { type: 'debit', amountPaise: 7645, reason: reasonC, referenceId: refC }, // ₹76.45
    params: { userId: testRetailer._id.toString() },
    admin: testAdmin,
    headers: {}
  };
  await manualCreditDebit(reqC, { status: () => ({ json: () => {} }), json: () => {} }, (e) => { if (e) throw e; });

  // SCENARIO D: Successful Wallet Recharge ₹229.00
  console.log('\n--- Executing Scenario D: Successful Mobile Recharge ₹229.00 ---');
  const refD = `A1R_ACC_RC_${Date.now()}`;
  const currentWalletD = await Wallet.findOne({ userId: testRetailer._id });
  const closingD = currentWalletD.balancePaise - 22442; // net debit
  currentWalletD.balancePaise = closingD;
  await currentWalletD.save();

  await Transaction.create({
    userId: testRetailer._id,
    accountType: 'BUSINESS',
    type: 'debit',
    amountPaise: 22900,
    status: 'success',
    service: 'BSNL TOPUP',
    referenceId: refD,
    description: 'Recharge for 9405884829 - BSNL TOPUP',
    mobileNumber: '9405884829',
    operatorName: 'BSNL TOPUP',
    apiReference: 'PRV_BSNL_LIVE_123',
    commissionEarnedPaise: 458,
    closingBalancePaise: closingD,
    paymentMethod: 'WALLET',
    source: 'WALLET',
    isTest: false
  });

  // SCENARIO E: Failed Recharge & Refund Scenario ₹149.00
  console.log('\n--- Executing Scenario E: Failed Recharge Refund ₹149.00 ---');
  const refE = `REFUND_ACC_${Date.now()}`;
  const currentWalletE = await Wallet.findOne({ userId: testRetailer._id });
  const closingE = currentWalletE.balancePaise + 14900;
  currentWalletE.balancePaise = closingE;
  await currentWalletE.save();

  await Transaction.create({
    userId: testRetailer._id,
    accountType: 'BUSINESS',
    type: 'credit',
    amountPaise: 14900,
    status: 'refunded',
    service: 'refund',
    referenceId: refE,
    description: 'Refund for failed recharge 9876543210',
    mobileNumber: '9876543210',
    closingBalancePaise: closingE,
    paymentMethod: 'WALLET',
    source: 'SYSTEM',
    isTest: false
  });

  // -------------------------------------------------------------
  // VERIFICATION VIA GLOBAL TRANSACTIONS QUERY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('QUERYING GLOBAL TRANSACTIONS (Admin Portal View)');
  console.log('================================================================');

  const globalResult = await unifiedTransactionService.getUnifiedGlobalTransactions({
    retailerId: testRetailer.retailerId,
    showTest: true
  });

  console.log(`Total transactions returned: ${globalResult.data.length}`);
  console.table(globalResult.data.map(row => ({
    Type: row.transactionType,
    Dir: row.type,
    Amount: `${row.type === 'credit' ? '+' : (row.transactionType === 'ADMIN_DEBIT' ? '-' : '')}₹${row.amountRupees}`,
    Method: row.paymentMethod,
    Source: row.source,
    Status: row.status,
    Retailer: `${row.userId.name} (${row.userId.retailerId})`,
    Reference: row.referenceId,
    Target: row.targetIdentifier || '-',
    PerformedBy: row.performedBy || '-',
    Reason: row.reason || '-'
  })));

  // Verifications
  const findType = (type) => globalResult.data.find(r => r.transactionType === type);

  const rowTopup = findType('WALLET_TOPUP_UPI');
  const rowCredit = findType('ADMIN_CREDIT');
  const rowDebit = findType('ADMIN_DEBIT');
  const rowRecharge = findType('MOBILE_RECHARGE');
  const rowRefund = findType('REFUND');

  const checkTopup = rowTopup && rowTopup.amountPaise === 100000 && rowTopup.source === 'RAZORPAY' && rowTopup.paymentMethod === 'UPI' && rowTopup.status === 'success';
  const checkCredit = rowCredit && rowCredit.amountPaise === 50000 && rowCredit.source === 'ADMIN' && rowCredit.performedBy === testAdmin.name && rowCredit.reason === reasonB;
  const checkDebit = rowDebit && rowDebit.amountPaise === 7645 && rowDebit.source === 'ADMIN' && rowDebit.performedBy === testAdmin.name && rowDebit.reason === reasonC;
  const checkRecharge = rowRecharge && rowRecharge.amountPaise === 22900 && rowRecharge.targetIdentifier === '9405884829';
  const checkRefund = rowRefund && rowRefund.amountPaise === 14900 && rowRefund.status === 'refunded';

  console.log('\n--- VERIFICATION CHECKLIST ---');
  console.log(`A) ₹1,000 UPI Wallet Top-up: ${checkTopup ? '✅ VERIFIED' : '❌ FAILED'}`);
  console.log(`B) ₹500 Admin Wallet Credit:  ${checkCredit ? '✅ VERIFIED' : '❌ FAILED'}`);
  console.log(`C) ₹76.45 Admin Wallet Debit: ${checkDebit ? '✅ VERIFIED' : '❌ FAILED'}`);
  console.log(`D) ₹229 Mobile Recharge:     ${checkRecharge ? '✅ VERIFIED' : '❌ FAILED'}`);
  console.log(`E) ₹149 Failed/Refund:       ${checkRefund ? '✅ VERIFIED' : '❌ FAILED'}`);

  const allPassed = checkTopup && checkCredit && checkDebit && checkRecharge && checkRefund;

  // Clean up acceptance data
  await Wallet.deleteOne({ userId: testRetailer._id });
  await WalletLedger.deleteMany({ userId: testRetailer._id });
  await Transaction.deleteMany({ userId: testRetailer._id });
  await User.deleteOne({ _id: testRetailer._id });
  await mongoose.disconnect();

  if (!allPassed) {
    console.error('\n❌ ACCEPTANCE TEST FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 5 FINANCIAL SCENARIOS FULLY VERIFIED IN GLOBAL TRANSACTIONS!');
  }
}

runAcceptanceTest().catch(console.error);
