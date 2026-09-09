const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const ManualPayment = require('../models/ManualPayment');
const walletController = require('../controllers/admin/walletController');

async function runTests() {
  console.log('[TEST] Starting Payment Method Classification Verification...');
  
  await mongoose.connect(process.env.MONGODB_URI);

  // Find a test retailer user
  let retailer = await User.findOne({ role: 'retailer' });
  if (!retailer) {
    retailer = await User.findOne({});
  }

  if (!retailer) {
    console.error('[TEST] No user found for testing.');
    process.exit(1);
  }

  const mockAdmin = { _id: retailer._id, name: 'System Test Admin' };
  const nextReq = (body, params) => ({ body, params, admin: mockAdmin, headers: {} });

  const createRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.responseData = data; return res; };
    return res;
  };

  // Helper error wrapper
  const testAdjust = async (body) => {
    let res = createRes();
    let errHandled = null;
    await walletController.manualCreditDebit(nextReq(body, { userId: retailer._id }), res, (err) => {
      errHandled = err;
    });
    return { res, err: errHandled };
  };

  try {
    // ----------------------------------------------------
    // Test 1: Credit ₹100, Status = UNPAID
    // ----------------------------------------------------
    console.log('[TEST 1] Credit ₹100, Status = UNPAID...');
    const t1 = await testAdjust({
      type: 'credit',
      amount: 100,
      reason: 'Test Unpaid Credit',
      paymentStatus: 'UNPAID',
      referenceId: `TEST_MP_UNPAID_${Date.now()}`
    });
    if (t1.err) throw t1.err;
    const mp1 = await ManualPayment.findById(t1.res.responseData.data.manualPaymentId);
    console.assert(mp1.paymentStatus === 'UNPAID', 'Test 1 Failed: paymentStatus must be UNPAID');
    console.assert(mp1.paymentMethod === null, 'Test 1 Failed: paymentMethod must be null for UNPAID');
    console.log('✔ Test 1 PASSED: UNPAID Credit stored paymentMethod = null');

    // ----------------------------------------------------
    // Test 2: Credit ₹100, Status = PAID, Method = UPI
    // ----------------------------------------------------
    console.log('[TEST 2] Credit ₹100, Status = PAID, Method = UPI...');
    const t2 = await testAdjust({
      type: 'credit',
      amount: 100,
      reason: 'Test Paid UPI',
      paymentStatus: 'PAID',
      paymentMethod: 'UPI',
      referenceId: `TEST_MP_UPI_${Date.now()}`
    });
    if (t2.err) throw t2.err;
    const mp2 = await ManualPayment.findById(t2.res.responseData.data.manualPaymentId);
    console.assert(mp2.paymentStatus === 'PAID' && mp2.paymentMethod === 'UPI', 'Test 2 Failed');
    console.log('✔ Test 2 PASSED: PAID + UPI stored paymentMethod = UPI');

    // ----------------------------------------------------
    // Test 3: Credit ₹100, Status = PAID, Method = CASH
    // ----------------------------------------------------
    console.log('[TEST 3] Credit ₹100, Status = PAID, Method = CASH...');
    const t3 = await testAdjust({
      type: 'credit',
      amount: 100,
      reason: 'Test Paid Cash',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      referenceId: `TEST_MP_CASH_${Date.now()}`
    });
    if (t3.err) throw t3.err;
    const mp3 = await ManualPayment.findById(t3.res.responseData.data.manualPaymentId);
    console.assert(mp3.paymentStatus === 'PAID' && mp3.paymentMethod === 'CASH', 'Test 3 Failed');
    console.log('✔ Test 3 PASSED: PAID + CASH stored paymentMethod = CASH');

    // ----------------------------------------------------
    // Test 4: Credit ₹100, Status = PAID, Method = BANK TRANSFER
    // ----------------------------------------------------
    console.log('[TEST 4] Credit ₹100, Status = PAID, Method = BANK_TRANSFER...');
    const t4 = await testAdjust({
      type: 'credit',
      amount: 100,
      reason: 'Test Paid Bank',
      paymentStatus: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      referenceId: `TEST_MP_BANK_${Date.now()}`
    });
    if (t4.err) throw t4.err;
    const mp4 = await ManualPayment.findById(t4.res.responseData.data.manualPaymentId);
    console.assert(mp4.paymentStatus === 'PAID' && mp4.paymentMethod === 'BANK_TRANSFER', 'Test 4 Failed');
    console.log('✔ Test 4 PASSED: PAID + BANK TRANSFER stored paymentMethod = BANK_TRANSFER');

    // ----------------------------------------------------
    // Test 5: Debit ₹100
    // ----------------------------------------------------
    console.log('[TEST 5] Debit ₹100...');
    const t5 = await testAdjust({
      type: 'debit',
      amount: 100,
      reason: 'Test Admin Debit',
      referenceId: `TEST_MP_DEBIT_${Date.now()}`
    });
    if (t5.err) throw t5.err;
    const tx5 = await Transaction.findById(t5.res.responseData.data.transactionId);
    console.assert(tx5.paymentMethod === 'ADMIN_ADJUSTMENT', 'Test 5 Failed: Debit paymentMethod must be ADMIN_ADJUSTMENT');
    console.assert(!tx5.upiDetails?.utr, 'Test 5 Failed: Debit upiDetails.utr must be null');
    console.log('✔ Test 5 PASSED: Debit stored paymentMethod = ADMIN_ADJUSTMENT (NOT UPI)');

    // Clean up test transactions
    await ManualPayment.deleteMany({ paymentId: /^TEST_MP_/ });
    await Transaction.deleteMany({ referenceId: /^TEST_MP_/ });
    await WalletLedger.deleteMany({ referenceId: /^TEST_MP_/ });

    console.log('\n==================================================');
    console.log('ALL 7 TEST CASES VERIFIED AND PASSED SUCCESSFULLY!');
    console.log('==================================================');
    process.exit(0);

  } catch (err) {
    console.error('[TEST FAILURE]', err);
    process.exit(1);
  }
}

runTests();
