const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const walletService = require('../services/wallet/wallet.service');
const { getGlobalTransactions } = require('../controllers/admin/transactionController');
const { getStatement } = require('../controllers/walletController');

async function runTests() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/a1recharge';
  console.log('Connecting to Mongo:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  try {
    console.log('\n====================================================');
    console.log('   RUNNING UNIFIED WALLET TRANSACTION ENGINE TESTS   ');
    console.log('====================================================\n');

    let testUser = await User.findOne({ retailerId: 'TEST_ENGINE_RT' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Engine Test Retailer',
        phone: '8888877777',
        retailerId: 'TEST_ENGINE_RT',
        role: 'retailer',
        accountType: 'BUSINESS',
        status: 'active'
      });
    }

    const userId = testUser._id;

    // Reset test user wallet
    await Wallet.deleteOne({ userId });
    await WalletLedger.deleteMany({ userId });
    await Transaction.deleteMany({ userId });

    const initialWallet = await Wallet.create({ userId, balancePaise: 50000, onHoldPaise: 0 });
    console.log(`[INIT] Test Retailer created. Initial Balance: ₹500.00 (50,000 paise)`);

    // --- TEST 1: Successful UPI Top-Up ---
    console.log('\n--- TEST 1: Successful UPI Wallet Top-up ---');
    const orderId1 = `order_ENGINE_TEST_${Date.now()}_1`;
    const res1 = await walletService.processSuccessfulWalletTopup({
      userId,
      amountPaise: 100000, // ₹1,000.00
      referenceId: orderId1,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      description: 'Wallet Top-up via Razorpay UPI',
      upiDetails: {
        gateway: 'Razorpay UPI',
        gatewayOrderId: orderId1,
        gatewayPaymentId: `pay_${orderId1}`
      }
    });

    if (!res1.success || res1.walletBalancePaise !== 150000) {
      throw new Error(`Test 1 Failed: Expected balance 150000 paise, got ${res1.walletBalancePaise}`);
    }

    const ledger1 = await WalletLedger.findOne({ userId, referenceId: orderId1 });
    if (!ledger1 || ledger1.transactionType !== 'CREDIT' || ledger1.amount !== 1000 || ledger1.balanceAfter !== 1500) {
      throw new Error(`Test 1 Failed: WalletLedger record missing or invalid`);
    }

    const txn1 = await Transaction.findOne({ userId, referenceId: orderId1 });
    if (!txn1 || txn1.service !== 'wallet_topup' || txn1.paymentMethod !== 'UPI' || txn1.status !== 'success') {
      throw new Error(`Test 1 Failed: Transaction record missing or invalid`);
    }

    console.log('✅ TEST 1 PASSED: ₹1,000 Top-up created balance ₹1,500.00, WalletLedger CREDIT, Transaction record.');

    // --- TEST 2: Idempotency Check (Duplicate Call) ---
    console.log('\n--- TEST 2: Idempotency Guard (Duplicate Call) ---');
    const res2 = await walletService.processSuccessfulWalletTopup({
      userId,
      amountPaise: 100000,
      referenceId: orderId1,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      upiDetails: { gatewayOrderId: orderId1 }
    });

    if (!res2.alreadyProcessed || res2.walletBalancePaise !== 150000) {
      throw new Error(`Test 2 Failed: Idempotency failed, balance changed to ${res2.walletBalancePaise}`);
    }

    const ledgerCount1 = await WalletLedger.countDocuments({ userId, referenceId: orderId1 });
    if (ledgerCount1 !== 1) {
      throw new Error(`Test 2 Failed: Duplicate WalletLedger created`);
    }

    console.log('✅ TEST 2 PASSED: Idempotency verified! Wallet balance NOT double-credited.');

    // --- TEST 3: Failed UPI Top-Up Recording ---
    console.log('\n--- TEST 3: Failed UPI Top-up Recording ---');
    const orderIdFail = `order_FAIL_${Date.now()}`;
    const res3 = await walletService.processFailedWalletTopup({
      userId,
      amountPaise: 50000,
      referenceId: orderIdFail,
      paymentMethod: 'UPI',
      paymentStatus: 'FAILED',
      failureReason: 'User cancelled payment',
      description: 'Failed UPI Top-up'
    });

    const currentWallet3 = await Wallet.findOne({ userId });
    if (currentWallet3.balancePaise !== 150000) {
      throw new Error(`Test 3 Failed: Failed payment changed wallet balance!`);
    }

    const txnFail = await Transaction.findOne({ userId, referenceId: orderIdFail });
    if (!txnFail || txnFail.status !== 'failed') {
      throw new Error(`Test 3 Failed: Failed transaction record missing`);
    }

    console.log('✅ TEST 3 PASSED: Failed top-up recorded as status "failed" with ZERO wallet balance change.');

    // --- TEST 4: Pending Top-Up -> Success Update ---
    console.log('\n--- TEST 4: Pending Top-up -> Success Update ---');
    const orderIdPend = `order_PEND_${Date.now()}`;
    await walletService.processPendingWalletTopup({
      userId,
      amountPaise: 20000, // ₹200
      referenceId: orderIdPend,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING'
    });

    const txnPend = await Transaction.findOne({ userId, referenceId: orderIdPend });
    if (!txnPend || txnPend.status !== 'pending') {
      throw new Error(`Test 4 Failed: Pending transaction record missing`);
    }

    // Now update pending order to SUCCESS
    const resPendSuccess = await walletService.processSuccessfulWalletTopup({
      userId,
      amountPaise: 20000,
      referenceId: orderIdPend,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI'
    });

    if (resPendSuccess.walletBalancePaise !== 170000) {
      throw new Error(`Test 4 Failed: Expected balance 170000, got ${resPendSuccess.walletBalancePaise}`);
    }

    const txnUpdated = await Transaction.findOne({ userId, referenceId: orderIdPend });
    if (!txnUpdated || txnUpdated.status !== 'success') {
      throw new Error(`Test 4 Failed: Pending transaction not updated to success`);
    }

    console.log('✅ TEST 4 PASSED: Pending top-up updated to success with single credit (₹1,700.00).');

    // --- TEST 5: Hold Reservation & Commit Debit ---
    console.log('\n--- TEST 5: Hold Reservation & Commit Debit ---');
    await walletService.reserveAmount(userId, 100); // ₹100 hold
    const walletHold = await Wallet.findOne({ userId });
    if (walletHold.onHoldPaise !== 10000 || walletHold.balancePaise !== 170000) {
      throw new Error(`Test 5 Failed: Hold reservation invalid`);
    }

    const commitRes = await walletService.commitReservation(userId, 100, {
      referenceType: 'RECHARGE',
      referenceId: `A1R_TEST_${Date.now()}`,
      description: 'Recharge commit'
    });

    if (commitRes.walletBalancePaise !== 160000 || commitRes.holdAmountPaise !== 0) {
      throw new Error(`Test 5 Failed: Commit reservation invalid balance`);
    }

    console.log('✅ TEST 5 PASSED: Hold reserved, committed net debit ₹100. Balance: ₹1,600.00, Hold: ₹0.00.');

    // --- TEST 6: Hold Release (Zero Balance Effect) ---
    console.log('\n--- TEST 6: Hold Release (Zero Balance Effect) ---');
    await walletService.reserveAmount(userId, 50); // ₹50 hold
    await walletService.releaseHoldWithLedger(userId, 50);

    const walletReleased = await Wallet.findOne({ userId });
    if (walletReleased.onHoldPaise !== 0 || walletReleased.balancePaise !== 160000) {
      throw new Error(`Test 6 Failed: Hold release altered balance`);
    }

    console.log('✅ TEST 6 PASSED: Hold released, onHoldPaise reset to 0, balancePaise unchanged (₹1,600.00).');

    // --- TEST 7: Recharge Refund ---
    console.log('\n--- TEST 7: Recharge Refund ---');
    const refundRes = await walletService.refundRecharge(userId, 100, {
      referenceId: `REFUND_${Date.now()}`,
      description: 'Refund for failed order'
    });

    if (refundRes.walletBalancePaise !== 170000) {
      throw new Error(`Test 7 Failed: Refund balance expected 170000, got ${refundRes.walletBalancePaise}`);
    }

    console.log('✅ TEST 7 PASSED: Recharge refund credited balance to ₹1,700.00 with REFUND ledger.');

    // Clean up test user records
    await Wallet.deleteOne({ userId });
    await WalletLedger.deleteMany({ userId });
    await Transaction.deleteMany({ userId });
    await User.deleteOne({ _id: userId });

    console.log('\n====================================================');
    console.log('🎉 ALL UNIFIED WALLET TRANSACTION ENGINE TESTS PASSED!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
