const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const ProviderOperator = require('../models/ProviderOperator');
const ProviderCircle = require('../models/ProviderCircle');
const walletService = require('../services/wallet/wallet.service');

async function testFailedRechargeLifecycle() {
  console.log("=================================================");
  console.log("STARTING FAILED RECHARGE LIFECYCLE TEST");
  console.log("=================================================");

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // 1. Find or create a test retailer
    let user = await User.findOne({ role: 'retailer' });
    if (!user) {
      user = await User.create({
        retailerId: 'TEST_RT_001',
        name: 'Test Retailer',
        phone: '9999988888',
        role: 'retailer',
        status: 'active'
      });
    }

    // Ensure wallet balance is sufficient
    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: user._id, balancePaise: 100000 }); // ₹1000
    } else if (wallet.balancePaise < 5000) {
      wallet.balancePaise = 100000;
      await wallet.save();
    }

    const initialAvailable = wallet.balancePaise - (wallet.onHoldPaise || 0);
    console.log(`Initial Wallet Balance: ₹${wallet.balancePaise / 100} | Hold: ₹${(wallet.onHoldPaise || 0) / 100}`);

    // 2. Prepare recharge test request parameters (₹26)
    const amount = 26;
    const mobileNumber = '9876543210';
    const orderId = `A1RTEST${Date.now()}`;

    // Find operator
    let operator = await ProviderOperator.findOne({ provider: 'A1Topup' });
    if (!operator) {
      operator = await ProviderOperator.create({
        code: 'RC',
        name: 'Jio',
        serviceType: 'Mobile',
        provider: 'A1Topup',
        status: true
      });
    }

    let circle = await ProviderCircle.findOne({ provider: 'A1Topup' });
    if (!circle) {
      circle = await ProviderCircle.create({
        code: '4',
        name: 'Maharashtra',
        state: 'Maharashtra',
        provider: 'A1Topup',
        status: true
      });
    }

    // Step A: Create transaction documents upfront
    console.log("\n-> Step A: Creating Transaction Documents (PENDING)...");
    const rechargeTx = await RechargeTransaction.create({
      orderId,
      userId: user._id,
      providerName: 'A1Topup',
      mobileNumber,
      amount,
      operatorCode: operator.code,
      circleCode: circle.code,
      status: 'PENDING',
      reservedAmount: amount,
    });

    const globalTx = await Transaction.create({
      userId: user._id,
      type: 'debit',
      amountPaise: amount * 100,
      status: 'pending',
      service: 'mobile_recharge',
      referenceId: orderId,
      description: `Recharge for ${mobileNumber} - ${operator.name}`,
      recipientName: mobileNumber,
      mobileNumber: mobileNumber,
      operatorName: operator.name,
      paymentMethod: 'wallet',
    });

    console.log(`[✔] Created RechargeTransaction (ID: ${rechargeTx._id}) & Transaction (ID: ${globalTx._id})`);

    // Step B: Reserve Wallet
    console.log("\n-> Step B: Reserving Wallet Amount...");
    await walletService.reserveAmount(user._id, amount);
    let walletAfterReserve = await Wallet.findOne({ userId: user._id });
    console.log(`[✔] Reserved ₹${amount}. Balance: ₹${walletAfterReserve.balancePaise / 100} | Hold: ₹${walletAfterReserve.onHoldPaise / 100}`);

    // Step C: Simulate Provider Failure
    console.log("\n-> Step C: Simulating Provider Failure...");
    const mockProviderResponse = {
      status: 'FAILED',
      providerTransactionId: `PROV_ERR_${Date.now()}`,
      operatorReference: null,
      message: 'Provider error: Invalid tariff or temporary downtime'
    };

    // Step D: Release Wallet Hold
    console.log("\n-> Step D: Releasing Wallet Reservation...");
    await walletService.releaseReservation(user._id, amount);
    let walletAfterRelease = await Wallet.findOne({ userId: user._id });
    console.log(`[✔] Released hold. Balance: ₹${walletAfterRelease.balancePaise / 100} | Hold: ₹${walletAfterRelease.onHoldPaise / 100}`);

    // Step E: Update Transactions to FAILED / failed
    console.log("\n-> Step E: Updating Transaction Statuses to FAILED...");
    rechargeTx.status = 'FAILED';
    rechargeTx.providerTransactionId = mockProviderResponse.providerTransactionId;
    rechargeTx.providerResponse = mockProviderResponse;
    rechargeTx.failureReason = mockProviderResponse.message;
    await rechargeTx.save();

    globalTx.status = 'failed';
    globalTx.failureReason = mockProviderResponse.message;
    globalTx.apiReference = mockProviderResponse.providerTransactionId;
    await globalTx.save();

    console.log(`[✔] Updated RechargeTransaction status: ${rechargeTx.status}`);
    console.log(`[✔] Updated Transaction status: ${globalTx.status}`);

    // VERIFICATIONS
    console.log("\n=================================================");
    console.log("RUNNING VERIFICATION CHECKS");
    console.log("=================================================");

    // Check 1: Single RechargeTransaction in MongoDB
    const rechargeDocs = await RechargeTransaction.find({ orderId });
    console.log(`Check 1: RechargeTransaction count for orderId ${orderId}: ${rechargeDocs.length} (Expected: 1)`);
    if (rechargeDocs.length !== 1 || rechargeDocs[0].status !== 'FAILED') {
      throw new Error("Check 1 Failed: RechargeTransaction mismatch");
    }
    console.log(`  ✔ Status: ${rechargeDocs[0].status} | Failure Reason: ${rechargeDocs[0].failureReason}`);

    // Check 2: Single Transaction in MongoDB
    const globalDocs = await Transaction.find({ referenceId: orderId });
    console.log(`Check 2: Transaction count for referenceId ${orderId}: ${globalDocs.length} (Expected: 1)`);
    if (globalDocs.length !== 1 || globalDocs[0].status !== 'failed') {
      throw new Error("Check 2 Failed: Transaction status mismatch");
    }
    console.log(`  ✔ Status: ${globalDocs[0].status} | Failure Reason: ${globalDocs[0].failureReason}`);

    // Check 3: Wallet balance returned
    const finalAvailable = walletAfterRelease.balancePaise - (walletAfterRelease.onHoldPaise || 0);
    console.log(`Check 3: Wallet restored: ${initialAvailable === finalAvailable}`);
    if (initialAvailable !== finalAvailable) {
      throw new Error("Check 3 Failed: Wallet balance mismatch");
    }
    console.log("  ✔ Wallet balance correctly released back to retailer");

    // Check 4: Retailer History includes failed transaction
    const retailerStatement = await Transaction.find({ userId: user._id, referenceId: orderId });
    console.log(`Check 4: Retailer statement includes failed txn: ${retailerStatement.length > 0}`);
    if (retailerStatement.length === 0 || retailerStatement[0].status !== 'failed') {
      throw new Error("Check 4 Failed: Retailer statement missing failed transaction");
    }
    console.log("  ✔ Retailer history shows FAILED transaction");

    console.log("\n=================================================");
    console.log("ALL VERIFICATIONS PASSED SUCCESSFULLY!");
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("\n[X] TEST FAILED:", err);
    process.exit(1);
  }
}

testFailedRechargeLifecycle();
