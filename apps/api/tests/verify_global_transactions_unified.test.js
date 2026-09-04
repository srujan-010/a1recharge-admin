const mongoose = require('mongoose');
const unifiedTransactionService = require('../services/transaction/unifiedTransaction.service');
const { manualCreditDebit } = require('../controllers/admin/walletController');
const walletService = require('../services/wallet/wallet.service');
const Transaction = require('../models/Transaction');
const WalletLedger = require('../models/WalletLedger');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge';

async function runTests() {
  console.log('================================================================');
  console.log('STARTING VERIFICATION: AUTHORITATIVE GLOBAL TRANSACTIONS SUITE');
  console.log('================================================================');

  await mongoose.connect(MONGODB_URI);

  // Setup Test Retailer & Admin
  const testPhone = '9999999991';
  const testRetailerId = 'RET_TEST_UNIFIED';
  let testRetailer = await User.findOne({ phone: testPhone });
  if (!testRetailer) {
    testRetailer = await User.create({
      name: 'Test Retailer Unified',
      phone: testPhone,
      retailerId: testRetailerId,
      role: 'retailer',
      accountType: 'BUSINESS',
      isTest: true
    });
  }

  const testAdmin = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Super Admin Tester',
    email: 'superadmin@test.com',
    role: 'SUPER_ADMIN'
  };

  // Clean up any old test data for this test user
  await Wallet.deleteOne({ userId: testRetailer._id });
  await WalletLedger.deleteMany({ userId: testRetailer._id });
  await Transaction.deleteMany({ userId: testRetailer._id });

  // Initialize wallet with 0
  let wallet = await Wallet.create({
    userId: testRetailer._id,
    balancePaise: 0,
    onHoldPaise: 0
  });

  const testResults = [];

  const recordResult = (num, name, passed, details = '') => {
    testResults.push({ num, name, passed, details });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Successful UPI Wallet Top-up
    // -------------------------------------------------------------
    const topupRef = `TOPUP_UPI_${Date.now()}`;
    const razorpayPayId = `pay_TEST_${Date.now()}`;
    const razorpayOrdId = `order_TEST_${Date.now()}`;

    const topupRes = await walletService.processSuccessfulWalletTopup({
      userId: testRetailer._id,
      amountPaise: 100000, // ₹1,000.00
      referenceId: topupRef,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      description: 'Wallet Top-up via Razorpay UPI',
      upiDetails: {
        gatewayPaymentId: razorpayPayId,
        gatewayOrderId: razorpayOrdId,
        gateway: 'Razorpay UPI',
        utr: 'UTR12345678'
      },
      isTest: true
    });

    const q1 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t1 = q1.data.find(t => t.referenceId === topupRef);
    const pass1 = t1 && t1.transactionType === 'WALLET_TOPUP_UPI' && t1.amountPaise === 100000 && t1.type === 'credit' && t1.paymentMethod === 'UPI' && t1.source === 'RAZORPAY';
    recordResult(1, 'Successful UPI wallet top-up appears in Global Transactions', pass1, `Type: ${t1?.transactionType}, Source: ${t1?.source}`);

    // -------------------------------------------------------------
    // Test 2: Admin Wallet Credit
    // -------------------------------------------------------------
    const creditRef = `ADM_CRED_${Date.now()}`;
    const creditReason = 'Bonus credit for festival campaign';

    const mockCreditReq = {
      body: { type: 'credit', amountPaise: 50000, reason: creditReason, referenceId: creditRef },
      params: { userId: testRetailer._id.toString() },
      admin: testAdmin,
      headers: {}
    };

    let creditJson = null;
    const mockCreditRes = {
      status: (code) => mockCreditRes,
      json: (data) => { creditJson = data; }
    };

    await manualCreditDebit(mockCreditReq, mockCreditRes, (err) => { if (err) throw err; });

    const q2 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t2 = q2.data.find(t => t.referenceId === creditRef);
    const pass2 = t2 && t2.transactionType === 'ADMIN_CREDIT' && t2.amountPaise === 50000 && t2.type === 'credit' && t2.source === 'ADMIN' && t2.paymentMethod === 'ADMIN' && t2.performedBy === testAdmin.name && t2.reason === creditReason;
    recordResult(2, 'Admin wallet credit appears in Global Transactions', pass2, `Type: ${t2?.transactionType}, Admin: ${t2?.performedBy}, Reason: ${t2?.reason}`);

    // -------------------------------------------------------------
    // Test 3: Admin Wallet Debit
    // -------------------------------------------------------------
    const debitRef = `ADM_DEB_${Date.now()}`;
    const debitReason = 'Duplicate wallet credit correction';

    const mockDebitReq = {
      body: { type: 'debit', amountPaise: 7645, reason: debitReason, referenceId: debitRef }, // ₹76.45
      params: { userId: testRetailer._id.toString() },
      admin: testAdmin,
      headers: {}
    };

    let debitJson = null;
    const mockDebitRes = {
      status: (code) => mockDebitRes,
      json: (data) => { debitJson = data; }
    };

    await manualCreditDebit(mockDebitReq, mockDebitRes, (err) => { if (err) throw err; });

    const q3 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t3 = q3.data.find(t => t.referenceId === debitRef);
    const pass3 = t3 && t3.transactionType === 'ADMIN_DEBIT' && t3.amountPaise === 7645 && t3.type === 'debit' && t3.source === 'ADMIN' && t3.paymentMethod === 'ADMIN' && t3.performedBy === testAdmin.name && t3.reason === debitReason;
    recordResult(3, 'Admin wallet debit appears in Global Transactions', pass3, `Type: ${t3?.transactionType}, Amount: -₹${t3?.amountRupees}`);

    // -------------------------------------------------------------
    // Test 4: Mobile Recharge appears in Global Transactions
    // -------------------------------------------------------------
    const rechargeRef = `A1R_TEST_${Date.now()}`;
    const targetMobile = '9405884829';

    await Transaction.create({
      userId: testRetailer._id,
      accountType: 'BUSINESS',
      type: 'debit',
      amountPaise: 22900,
      status: 'success',
      service: 'BSNL TOPUP',
      referenceId: rechargeRef,
      description: `Recharge for ${targetMobile} - BSNL TOPUP`,
      mobileNumber: targetMobile,
      operatorName: 'BSNL TOPUP',
      apiReference: 'PRV_BSNL_998877',
      commissionEarnedPaise: 458,
      closingBalancePaise: 120000,
      paymentMethod: 'WALLET',
      source: 'WALLET',
      isTest: true
    });

    const q4 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t4 = q4.data.find(t => t.referenceId === rechargeRef);
    const pass4 = t4 && t4.transactionType === 'MOBILE_RECHARGE' && t4.mobileNumber === targetMobile && t4.operatorName === 'BSNL TOPUP' && t4.amountPaise === 22900;
    recordResult(4, 'Mobile recharge appears in Global Transactions', pass4, `Target: ${t4?.mobileNumber}, Operator: ${t4?.operatorName}`);

    // -------------------------------------------------------------
    // Test 5: DTH Recharge appears in Global Transactions
    // -------------------------------------------------------------
    const dthRef = `A1R_DTH_${Date.now()}`;
    await Transaction.create({
      userId: testRetailer._id,
      accountType: 'BUSINESS',
      type: 'debit',
      amountPaise: 35000,
      status: 'success',
      service: 'TATA SKY',
      referenceId: dthRef,
      description: 'Tata Sky DTH Recharge',
      mobileNumber: '1029384756',
      operatorName: 'TATA SKY',
      commissionEarnedPaise: 700,
      closingBalancePaise: 85000,
      paymentMethod: 'WALLET',
      source: 'WALLET',
      isTest: true
    });

    const q5 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t5 = q5.data.find(t => t.referenceId === dthRef);
    const pass5 = t5 && t5.transactionType === 'DTH_RECHARGE' && t5.amountPaise === 35000;
    recordResult(5, 'DTH recharge appears in Global Transactions', pass5, `Type: ${t5?.transactionType}`);

    // -------------------------------------------------------------
    // Test 6: Refund appears in Global Transactions
    // -------------------------------------------------------------
    const refundRef = `REFUND_${Date.now()}`;
    await Transaction.create({
      userId: testRetailer._id,
      accountType: 'BUSINESS',
      type: 'credit',
      amountPaise: 22900,
      status: 'refunded',
      service: 'refund',
      referenceId: refundRef,
      description: 'Refund for failed recharge',
      paymentMethod: 'WALLET',
      source: 'SYSTEM',
      isTest: true
    });

    const q6 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t6 = q6.data.find(t => t.referenceId === refundRef);
    const pass6 = t6 && t6.transactionType === 'REFUND' && t6.status === 'refunded';
    recordResult(6, 'Refund appears in Global Transactions', pass6, `Type: ${t6?.transactionType}, Status: ${t6?.status}`);

    // -------------------------------------------------------------
    // Test 7: Commission appears in Global Transactions
    // -------------------------------------------------------------
    const commRef = `COMM_${Date.now()}`;
    await Transaction.create({
      userId: testRetailer._id,
      accountType: 'BUSINESS',
      type: 'credit',
      amountPaise: 1500,
      status: 'success',
      service: 'commission',
      referenceId: commRef,
      description: 'Retailer commission payout',
      paymentMethod: 'WALLET',
      source: 'SYSTEM',
      isTest: true
    });

    const q7 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t7 = q7.data.find(t => t.referenceId === commRef);
    const pass7 = t7 && t7.transactionType === 'COMMISSION_CREDIT';
    recordResult(7, 'Commission appears in Global Transactions', pass7, `Type: ${t7?.transactionType}`);

    // -------------------------------------------------------------
    // Test 8: Hold and hold-release events represented correctly
    // -------------------------------------------------------------
    const holdReleaseRef = `HOLD_REL_${Date.now()}`;
    await Transaction.create({
      userId: testRetailer._id,
      accountType: 'BUSINESS',
      type: 'credit',
      amountPaise: 5000,
      status: 'released',
      service: 'wallet_hold_release',
      referenceId: holdReleaseRef,
      description: 'Release of pending transaction hold',
      paymentMethod: 'WALLET',
      source: 'SYSTEM',
      isTest: true
    });

    const q8 = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      showTest: true
    });

    const t8 = q8.data.find(t => t.referenceId === holdReleaseRef);
    const pass8 = t8 && t8.transactionType === 'WALLET_HOLD_RELEASE';
    recordResult(8, 'Hold and hold-release events are represented correctly', pass8, `Type: ${t8?.transactionType}`);

    // -------------------------------------------------------------
    // Test 9: Duplicate Razorpay callback creates only one wallet top-up transaction (Idempotency)
    // -------------------------------------------------------------
    const dupRes = await walletService.processSuccessfulWalletTopup({
      userId: testRetailer._id,
      amountPaise: 100000,
      referenceId: topupRef, // EXACT same reference
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      isTest: true
    });

    const topupCount = await Transaction.countDocuments({ userId: testRetailer._id, referenceId: topupRef });
    const ledgerCount = await WalletLedger.countDocuments({ userId: testRetailer._id, referenceId: topupRef });
    const pass9 = dupRes.alreadyProcessed === true && topupCount === 1 && ledgerCount === 1;
    recordResult(9, 'Duplicate Razorpay callback creates only one wallet top-up transaction', pass9, `Topup count: ${topupCount}, Ledger count: ${ledgerCount}`);

    // -------------------------------------------------------------
    // Test 10: Admin retry creates only one adjustment (Idempotency)
    // -------------------------------------------------------------
    let retryJson = null;
    const mockRetryRes = {
      status: (code) => mockRetryRes,
      json: (data) => { retryJson = data; }
    };

    // Retry credit with exact same referenceId
    await manualCreditDebit(mockCreditReq, mockRetryRes, (err) => { if (err) throw err; });

    const adminCreditTxnCount = await Transaction.countDocuments({ userId: testRetailer._id, referenceId: creditRef });
    const adminCreditLedgerCount = await WalletLedger.countDocuments({ userId: testRetailer._id, referenceId: creditRef });
    const pass10 = retryJson?.isDuplicate === true && adminCreditTxnCount === 1 && adminCreditLedgerCount === 1;
    recordResult(10, 'Admin retry creates only one adjustment', pass10, `isDuplicate: ${retryJson?.isDuplicate}`);

    // -------------------------------------------------------------
    // Test 11: Admin debit remains ADMIN_DEBIT
    // -------------------------------------------------------------
    const pass11 = t3.transactionType === 'ADMIN_DEBIT' && t3.type === 'debit';
    recordResult(11, 'Admin debit remains ADMIN_DEBIT', pass11, `transactionType: ${t3.transactionType}`);

    // -------------------------------------------------------------
    // Test 12: Admin credit remains ADMIN_CREDIT
    // -------------------------------------------------------------
    const pass12 = t2.transactionType === 'ADMIN_CREDIT' && t2.type === 'credit';
    recordResult(12, 'Admin credit remains ADMIN_CREDIT', pass12, `transactionType: ${t2.transactionType}`);

    // -------------------------------------------------------------
    // Test 13: Admin reason is displayed
    // -------------------------------------------------------------
    const pass13 = t2.reason === creditReason && t3.reason === debitReason;
    recordResult(13, 'Admin reason is displayed', pass13, `Credit Reason: "${t2.reason}", Debit Reason: "${t3.reason}"`);

    // -------------------------------------------------------------
    // Test 14: Admin identity is displayed (not System)
    // -------------------------------------------------------------
    const pass14 = t2.performedBy === testAdmin.name && t2.source === 'ADMIN' && t3.performedBy === testAdmin.name && t3.source === 'ADMIN';
    recordResult(14, 'Admin identity is displayed (not System)', pass14, `PerformedBy: ${t2.performedBy}, Source: ${t2.source}`);

    // -------------------------------------------------------------
    // Test 15: Wallet transaction does not require recharge-specific fields
    // -------------------------------------------------------------
    const pass15 = t2.mobileNumber === null && t2.operatorName === null && t2.apiReference === null && t2.amountPaise === 50000;
    recordResult(15, 'Wallet transaction does not require recharge-specific fields', pass15, 'Recharge fields are null without breaking row');

    // -------------------------------------------------------------
    // Test 16: Global "All" filter returns every transaction type
    // -------------------------------------------------------------
    const allQuery = await unifiedTransactionService.getUnifiedGlobalTransactions({
      retailerId: testRetailer.retailerId,
      transactionType: 'all',
      status: 'all',
      showTest: true
    });

    const typesFound = new Set(allQuery.data.map(t => t.transactionType));
    const pass16 = typesFound.has('WALLET_TOPUP_UPI') && typesFound.has('ADMIN_CREDIT') && typesFound.has('ADMIN_DEBIT') && typesFound.has('MOBILE_RECHARGE') && typesFound.has('DTH_RECHARGE') && typesFound.has('REFUND') && typesFound.has('COMMISSION_CREDIT') && typesFound.has('WALLET_HOLD_RELEASE');
    recordResult(16, 'Global "All" filter returns every transaction type', pass16, `Distinct types found: ${Array.from(typesFound).join(', ')}`);

    // -------------------------------------------------------------
    // Test 17: Search finds wallet transactions by reference / payment ID / reason / admin
    // -------------------------------------------------------------
    const searchByPayId = await unifiedTransactionService.getUnifiedGlobalTransactions({ search: razorpayPayId, showTest: true });
    const searchByReason = await unifiedTransactionService.getUnifiedGlobalTransactions({ search: 'Duplicate wallet credit', showTest: true });
    const searchByAdmin = await unifiedTransactionService.getUnifiedGlobalTransactions({ search: 'Super Admin Tester', showTest: true });
    const searchByRef = await unifiedTransactionService.getUnifiedGlobalTransactions({ search: rechargeRef, showTest: true });

    const pass17 = searchByPayId.pagination.total >= 1 && searchByReason.pagination.total >= 1 && searchByAdmin.pagination.total >= 1 && searchByRef.pagination.total >= 1;
    recordResult(17, 'Search finds transactions by reference/payment ID/reason/admin', pass17, `PayId found: ${searchByPayId.pagination.total}, Reason found: ${searchByReason.pagination.total}, Admin found: ${searchByAdmin.pagination.total}`);

    // -------------------------------------------------------------
    // Test 18: All financial amounts remain integer paise
    // -------------------------------------------------------------
    const allAmountsAreIntegers = allQuery.data.every(t => Number.isInteger(t.amountPaise) && (t.closingBalancePaise === null || Number.isInteger(t.closingBalancePaise)));
    recordResult(18, 'All financial amounts remain integer paise', allAmountsAreIntegers, `Verified across ${allQuery.data.length} transactions`);

    // -------------------------------------------------------------
    // Test 19: Retailer wallet statement returns identical transactions
    // -------------------------------------------------------------
    const statement = await unifiedTransactionService.getUnifiedGlobalTransactions({
      userId: testRetailer._id,
      showTest: true
    });
    const pass19 = statement.pagination.total === allQuery.pagination.total;
    recordResult(19, 'Retailer wallet statement matches Global Transactions', pass19, `Total records in statement: ${statement.pagination.total}`);

  } catch (err) {
    console.error('ERROR DURING TESTS:', err);
  } finally {
    // Clean up test data
    console.log('Cleaning up test data...');
    await Wallet.deleteOne({ userId: testRetailer._id });
    await WalletLedger.deleteMany({ userId: testRetailer._id });
    await Transaction.deleteMany({ userId: testRetailer._id });
    await User.deleteOne({ _id: testRetailer._id });
    await mongoose.disconnect();

    const passedCount = testResults.filter(r => r.passed).length;
    const failedCount = testResults.filter(r => !r.passed).length;
    console.log('================================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${testResults.length}`);
    console.log('================================================================');

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runTests().catch(console.error);
