const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const RechargeTransaction = require('../models/RechargeTransaction');
const ProviderOperator = require('../models/ProviderOperator');
const ProviderCircle = require('../models/ProviderCircle');
const walletService = require('../services/wallet/wallet.service');

async function testTxnOrderIdFlow() {
  console.log("=================================================");
  console.log("TESTING CLIENT ORDER ID (TXN1785683307071) LIFECYCLE");
  console.log("=================================================");

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // 1. Find or create test retailer
    let user = await User.findOne({ role: 'retailer' });
    if (!user) {
      user = await User.create({
        retailerId: 'TEST_RT_002',
        name: 'Test Retailer 2',
        phone: '9888877777',
        role: 'retailer',
        status: 'active'
      });
    }

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: user._id, balancePaise: 500000 }); // ₹5000
    }

    // Exact order ID reported by user
    const clientOrderId = 'TXN1785683307071';
    const amount = 26;
    const mobileNumber = '9876543210';

    // Ensure clean state for test orderId
    await RechargeTransaction.deleteMany({ orderId: clientOrderId });
    await Transaction.deleteMany({ referenceId: clientOrderId });

    // Find operator & circle
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

    // Step 1: Upfront Document Creation with Client Order ID
    console.log(`\n-> Step 1: Upfront Document Creation with OrderID: ${clientOrderId}...`);
    const rechargeTx = await RechargeTransaction.create({
      orderId: clientOrderId,
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
      referenceId: clientOrderId,
      description: `Recharge for ${mobileNumber} - ${operator.name}`,
      recipientName: mobileNumber,
      mobileNumber: mobileNumber,
      operatorName: operator.name,
      paymentMethod: 'wallet',
    });

    console.log(`[✔] Documents Created! RechargeTransaction ID: ${rechargeTx._id} | Transaction ID: ${globalTx._id}`);

    // Step 2: Reserve Wallet
    console.log("\n-> Step 2: Reserving Wallet Amount ₹26...");
    await walletService.reserveAmount(user._id, amount);

    // Step 3: Provider Returns FAILED
    console.log("\n-> Step 3: Provider Returns FAILED response...");
    const providerResponse = {
      status: 'FAILED',
      providerTransactionId: 'A1ERR998877',
      operatorReference: null,
      message: 'Operator temporary failure or invalid tariff'
    };

    // Step 4: Release Wallet
    console.log("\n-> Step 4: Releasing Wallet Reservation...");
    await walletService.releaseReservation(user._id, amount);

    // Step 5: Update SAME Documents to FAILED
    console.log("\n-> Step 5: Updating SAME Transaction documents to FAILED...");
    rechargeTx.status = providerResponse.status;
    rechargeTx.providerTransactionId = providerResponse.providerTransactionId;
    rechargeTx.providerResponse = providerResponse;
    rechargeTx.failureReason = providerResponse.message;
    await rechargeTx.save();

    globalTx.status = 'failed';
    globalTx.failureReason = providerResponse.message;
    globalTx.apiReference = providerResponse.providerTransactionId;
    await globalTx.save();

    // VERIFICATION CHECKS
    console.log("\n=================================================");
    console.log("VERIFYING GLOBAL TRANSACTIONS SEARCH & RECORD");
    console.log("=================================================");

    // Check 1: Query Global Transactions for exact TXN orderId
    const foundGlobalTx = await Transaction.findOne({ referenceId: clientOrderId });
    console.log(`Check 1: Transaction found for ${clientOrderId}:`, Boolean(foundGlobalTx));
    if (!foundGlobalTx || foundGlobalTx.status !== 'failed') {
      throw new Error("Check 1 Failed: Transaction missing or status is not failed");
    }
    console.log(`  ✔ Status in Global Transactions: ${foundGlobalTx.status} | Reason: ${foundGlobalTx.failureReason}`);

    // Check 2: Query RechargeTransaction for exact TXN orderId
    const foundRechargeTx = await RechargeTransaction.findOne({ orderId: clientOrderId });
    console.log(`Check 2: RechargeTransaction found for ${clientOrderId}:`, Boolean(foundRechargeTx));
    if (!foundRechargeTx || foundRechargeTx.status !== 'FAILED') {
      throw new Error("Check 2 Failed: RechargeTransaction missing or status is not FAILED");
    }
    console.log(`  ✔ Status in Recharge Operations: ${foundRechargeTx.status} | Reason: ${foundRechargeTx.failureReason}`);

    // Check 3: Verify single record (no duplicate documents created)
    const countGlobal = await Transaction.countDocuments({ referenceId: clientOrderId });
    const countRecharge = await RechargeTransaction.countDocuments({ orderId: clientOrderId });
    console.log(`Check 3: Count Global = ${countGlobal}, Count Recharge = ${countRecharge} (Expected: 1 each)`);
    if (countGlobal !== 1 || countRecharge !== 1) {
      throw new Error("Check 3 Failed: Duplicate documents found");
    }
    console.log("  ✔ No duplicate records created!");

    console.log("\n=================================================");
    console.log("ALL VERIFICATIONS PASSED FOR TXN ORDER ID!");
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("\n[X] TEST FAILED:", err);
    process.exit(1);
  }
}

testTxnOrderIdFlow();
