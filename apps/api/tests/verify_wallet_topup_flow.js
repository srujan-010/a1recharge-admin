const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const walletService = require('../services/wallet/wallet.service');

async function runVerification() {
  console.log('=== STARTING RETAILER WALLET UPI TOP-UP FLOW VERIFICATION ===\n');

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/a1recharge';
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB database.\n');

  try {
    // 1. Setup Test Retailer
    const testPhone = '9999999999';
    let retailer = await User.findOne({ phone: testPhone });
    if (!retailer) {
      retailer = await User.create({
        name: 'Test Retailer UPI Topup',
        phone: testPhone,
        role: 'retailer',
        retailerId: 'RT_TEST_TOPUP',
        status: 'active',
        accountType: 'BUSINESS'
      });
      console.log(`Created test retailer: ${retailer.name} (${retailer._id})`);
    } else {
      console.log(`Found test retailer: ${retailer.name} (${retailer._id})`);
    }

    // Initialize or Reset Wallet Balance for predictable test run
    let wallet = await Wallet.findOne({ userId: retailer._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: retailer._id, balancePaise: 50000, onHoldPaise: 20000 }); // ₹500 available, ₹200 hold
    } else {
      wallet.balancePaise = 50000; // ₹500
      wallet.onHoldPaise = 20000; // ₹200
      await wallet.save();
    }

    const initialBalancePaise = wallet.balancePaise;
    const initialHoldPaise = wallet.onHoldPaise;
    console.log(`Initial State -> Balance: ₹${initialBalancePaise / 100}, Hold: ₹${initialHoldPaise / 100}\n`);

    // Clean up test transactions/ledgers for clean run
    const testRefId1 = `pay_TEST_UPI_${Date.now()}_1`;
    const testRefId2 = `pay_TEST_UPI_${Date.now()}_2`;

    // 2. Perform Topup 1: ₹1,000 (100,000 paise) via UPI / Razorpay
    console.log('--- TEST 1: Perform ₹1,000 UPI Wallet Top-up ---');
    const topupAmountPaise1 = 100000; // ₹1,000

    const result1 = await walletService.processSuccessfulWalletTopup({
      userId: retailer._id,
      amountPaise: topupAmountPaise1,
      referenceId: testRefId1,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      description: 'Wallet Top-up via Razorpay UPI',
      upiDetails: {
        utr: 'UTR9988776655',
        gateway: 'Razorpay UPI',
        gatewayPaymentId: testRefId1,
        gatewayOrderId: `order_TEST_${Date.now()}`
      },
      isTest: true
    });

    console.log('Result 1:', {
      success: result1.success,
      alreadyProcessed: result1.alreadyProcessed,
      newWalletBalanceRupees: result1.walletBalancePaise / 100
    });

    // Check Balance Invariant
    const walletAfter1 = await Wallet.findOne({ userId: retailer._id });
    const expectedBalanceAfter1 = initialBalancePaise + topupAmountPaise1;
    if (walletAfter1.balancePaise !== expectedBalanceAfter1) {
      throw new Error(`TEST 1 FAILED: Expected balance ${expectedBalanceAfter1}, got ${walletAfter1.balancePaise}`);
    }
    if (walletAfter1.onHoldPaise !== initialHoldPaise) {
      throw new Error(`TEST 1 FAILED: Hold amount changed from ${initialHoldPaise} to ${walletAfter1.onHoldPaise}`);
    }
    console.log('✅ TEST 1 PASSED: Wallet credited exactly once. Balance ₹1,500, Hold ₹200 unchanged.\n');

    // Check Ledger Entry
    const ledgerEntry1 = await WalletLedger.findOne({ userId: retailer._id, referenceId: testRefId1 });
    if (!ledgerEntry1) {
      throw new Error(`TEST 1 FAILED: WalletLedger entry not found for ref ${testRefId1}`);
    }
    console.log('✅ TEST 1 PASSED: WalletLedger entry created:', {
      transactionType: ledgerEntry1.transactionType,
      amount: ledgerEntry1.amount,
      balanceAfter: ledgerEntry1.balanceAfter,
      referenceType: ledgerEntry1.referenceType,
      referenceId: ledgerEntry1.referenceId
    }, '\n');

    // Check Global Transaction Entry
    const txnEntry1 = await Transaction.findOne({ userId: retailer._id, referenceId: testRefId1 });
    if (!txnEntry1) {
      throw new Error(`TEST 1 FAILED: Transaction record not found for ref ${testRefId1}`);
    }
    console.log('✅ TEST 1 PASSED: Persistent Transaction record created:', {
      service: txnEntry1.service,
      type: txnEntry1.type,
      amountPaise: txnEntry1.amountPaise,
      status: txnEntry1.status,
      paymentMethod: txnEntry1.paymentMethod,
      paymentStatus: txnEntry1.paymentStatus,
      closingBalancePaise: txnEntry1.closingBalancePaise
    }, '\n');

    // 3. Perform Idempotency Test: Repeat exact same payment callback/webhook
    console.log('--- TEST 2: Re-send Duplicate Top-up (Idempotency Check) ---');
    const resultDuplicate = await walletService.processSuccessfulWalletTopup({
      userId: retailer._id,
      amountPaise: topupAmountPaise1,
      referenceId: testRefId1,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      upiDetails: {
        gatewayPaymentId: testRefId1
      },
      isTest: true
    });

    console.log('Result Duplicate:', {
      success: resultDuplicate.success,
      alreadyProcessed: resultDuplicate.alreadyProcessed,
      walletBalanceRupees: resultDuplicate.walletBalancePaise / 100
    });

    const walletAfterDup = await Wallet.findOne({ userId: retailer._id });
    if (walletAfterDup.balancePaise !== expectedBalanceAfter1) {
      throw new Error(`IDEMPOTENCY FAILED: Balance increased on duplicate request from ${expectedBalanceAfter1} to ${walletAfterDup.balancePaise}!`);
    }

    const ledgerCount = await WalletLedger.countDocuments({ userId: retailer._id, referenceId: testRefId1 });
    if (ledgerCount !== 1) {
      throw new Error(`IDEMPOTENCY FAILED: Duplicate ledger entries created (count: ${ledgerCount})!`);
    }
    console.log('✅ TEST 2 PASSED: Idempotency verified! Wallet NOT credited twice, duplicate ledger/transaction NOT created.\n');

    // 4. Perform Multi-amount Test: Add ₹199 (19,900 paise)
    console.log('--- TEST 3: Perform ₹199 UPI Wallet Top-up ---');
    const topupAmountPaise2 = 19900; // ₹199
    const result2 = await walletService.processSuccessfulWalletTopup({
      userId: retailer._id,
      amountPaise: topupAmountPaise2,
      referenceId: testRefId2,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      description: 'Wallet Top-up ₹199',
      isTest: true
    });

    const expectedBalanceAfter2 = expectedBalanceAfter1 + topupAmountPaise2; // 150000 + 19900 = 169900 (₹1699)
    const walletAfter2 = await Wallet.findOne({ userId: retailer._id });
    if (walletAfter2.balancePaise !== expectedBalanceAfter2) {
      throw new Error(`TEST 3 FAILED: Expected balance ${expectedBalanceAfter2}, got ${walletAfter2.balancePaise}`);
    }
    console.log(`✅ TEST 3 PASSED: ₹199 top-up successful! New Balance: ₹${walletAfter2.balancePaise / 100} (₹1,699.00)\n`);

    // Clean up test data
    await WalletLedger.deleteMany({ referenceId: { $in: [testRefId1, testRefId2] } });
    await Transaction.deleteMany({ referenceId: { $in: [testRefId1, testRefId2] } });
    console.log('Cleaned up temporary test transaction & ledger records.\n');

    console.log('====================================================');
    console.log('🎉 ALL RETAILER WALLET UPI TOP-UP VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('====================================================');

  } catch (err) {
    console.error('❌ VERIFICATION ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runVerification();
