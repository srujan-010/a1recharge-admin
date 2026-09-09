const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const ManualPayment = require('../models/ManualPayment');
const AuditLog = require('../models/AuditLog');

const {
  createManualPayment,
  markAsReceived,
  verifyPayment,
  creditWalletForPayment,
  reverseWalletCredit,
  getManualPaymentStats,
  getManualPaymentReconciliation
} = require('../controllers/admin/manualPaymentController');

const runAcceptanceTest = async () => {
  console.log('=== STARTING MANUAL PAYMENT SYSTEM ACCEPTANCE TEST ===\n');

  await connectDB();

  // 1. Setup Test Admin & Test Retailer
  let testAdmin = await AdminUser.findOne({ email: 'test_admin@a1recharge.com' });
  if (!testAdmin) {
    testAdmin = await AdminUser.create({
      name: 'Super Admin Test',
      email: 'test_admin@a1recharge.com',
      password: 'Password123!',
      role: 'SUPER_ADMIN'
    });
  }

  let testRetailer = await User.findOne({ phone: '9998887770' });
  if (!testRetailer) {
    testRetailer = await User.create({
      name: 'Acceptance Retailer Test',
      phone: '9998887770',
      retailerId: 'RET999888',
      accountType: 'BUSINESS',
      status: 'active'
    });
  }

  // Ensure retailer has wallet
  let wallet = await Wallet.findOne({ userId: testRetailer._id });
  if (!wallet) {
    wallet = await Wallet.create({ userId: testRetailer._id, balancePaise: 10000, onHoldPaise: 0 });
  }

  const initialBalancePaise = wallet.balancePaise;
  console.log(`Initial Retailer Wallet Balance: ₹${(initialBalancePaise / 100).toFixed(2)} (${initialBalancePaise} paise)`);

  // Helper mock Express req & res
  const mockReqRes = (body = {}, params = {}, admin = testAdmin) => {
    const req = {
      body,
      params,
      admin,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest-Acceptance-Test' }
    };
    const res = {
      statusCode: 200,
      jsonResponse: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonResponse = data;
        return this;
      }
    };
    return { req, res };
  };

  const utrTest = `UTR_TEST_${Date.now()}`;
  const testAmountRupees = 2000;

  // STEP A: Admin records payment of ₹2,000 via UPI (Status: PENDING)
  console.log('\nStep A: Admin creates payment of ₹2,000 via UPI...');
  const { req: reqCreate, res: resCreate } = mockReqRes({
    retailerId: testRetailer._id.toString(),
    amount: testAmountRupees,
    paymentMethod: 'UPI',
    utrNumber: utrTest,
    senderName: 'Srujan Test',
    notes: 'Retailer claimed UPI payment',
    initialStatus: 'PENDING'
  });

  await createManualPayment(reqCreate, resCreate, (err) => { throw err; });

  const createdPayment = resCreate.jsonResponse?.data;
  console.log(`-> Created Payment ID: ${createdPayment.paymentId}, Status: ${createdPayment.status}`);

  if (resCreate.statusCode !== 201 || createdPayment.status !== 'PENDING') {
    throw new Error(`Step A Failed! Expected status 201 PENDING, got ${resCreate.statusCode} ${createdPayment.status}`);
  }

  // STEP B: Mark Received -> RECEIVED
  console.log('\nStep B: Mark Received...');
  const { req: reqRec, res: resRec } = mockReqRes({}, { id: createdPayment._id.toString() });
  await markAsReceived(reqRec, resRec, (err) => { throw err; });

  const receivedPayment = resRec.jsonResponse?.data;
  console.log(`-> Payment Status after Mark Received: ${receivedPayment.status}`);

  if (receivedPayment.status !== 'RECEIVED' || !receivedPayment.receivedAt) {
    throw new Error('Step B Failed! Status should be RECEIVED.');
  }

  // STEP C: Verify -> VERIFIED
  console.log('\nStep C: Verify Payment...');
  const { req: reqVer, res: resVer } = mockReqRes({}, { id: createdPayment._id.toString() });
  await verifyPayment(reqVer, resVer, (err) => { throw err; });

  const verifiedPayment = resVer.jsonResponse?.data;
  console.log(`-> Payment Status after Verification: ${verifiedPayment.status}`);

  if (verifiedPayment.status !== 'VERIFIED' || !verifiedPayment.verifiedAt) {
    throw new Error('Step C Failed! Status should be VERIFIED.');
  }

  // STEP D: Credit Wallet -> WALLET CREDITED
  console.log('\nStep D: Credit Wallet...');
  const { req: reqCredit, res: resCredit } = mockReqRes({}, { id: createdPayment._id.toString() });
  await creditWalletForPayment(reqCredit, resCredit, (err) => { throw err; });

  console.log(`-> Credit Wallet Response Message: ${resCredit.jsonResponse?.message}`);

  if (resCredit.statusCode !== 200 || !resCredit.jsonResponse?.data?.walletCredited) {
    throw new Error('Step D Failed! Wallet credit expected to succeed.');
  }

  // STEP E: Verify DB Records Linkage & Integrity
  console.log('\nStep E: Verifying Database Records & Inter-record References...');

  const dbPayment = await ManualPayment.findById(createdPayment._id);
  const dbTxn = await Transaction.findById(dbPayment.walletTransactionId);
  const dbLedger = await WalletLedger.findById(dbPayment.walletLedgerId);
  const dbAudit = await AuditLog.findOne({
    action: 'MANUAL_PAYMENT_WALLET_CREDITED',
    resourceId: dbPayment._id
  });
  const updatedWallet = await Wallet.findOne({ userId: testRetailer._id });

  console.log(`-> ManualPayment: paymentId=${dbPayment.paymentId}, walletCredited=${dbPayment.walletCredited}`);
  console.log(`-> WalletTransaction: _id=${dbTxn._id}, service=${dbTxn.service}, amountPaise=${dbTxn.amountPaise}, source=${dbTxn.source}`);
  console.log(`-> WalletLedger: _id=${dbLedger._id}, referenceType=${dbLedger.referenceType}, remark=${dbLedger.remark}, amount=${dbLedger.amount}`);
  console.log(`-> AuditLog: action=${dbAudit?.action}, adminId=${dbAudit?.adminId}`);
  console.log(`-> New Retailer Wallet Balance: ₹${(updatedWallet.balancePaise / 100).toFixed(2)} (Previous: ₹${(initialBalancePaise / 100).toFixed(2)})`);

  if (!dbPayment || !dbPayment.walletCredited) throw new Error('Db check failed: ManualPayment walletCredited is false');
  if (!dbTxn || dbTxn.service !== 'manual_wallet_topup') throw new Error('Db check failed: Transaction missing or incorrect service');
  if (!dbLedger || dbLedger.referenceType !== 'MANUAL') throw new Error('Db check failed: WalletLedger missing or incorrect referenceType');
  if (!dbAudit) throw new Error('Db check failed: AuditLog entry missing');
  if (updatedWallet.balancePaise !== initialBalancePaise + 200000) {
    throw new Error(`Db check failed: Expected wallet balance ${initialBalancePaise + 200000}, got ${updatedWallet.balancePaise}`);
  }

  console.log('✔ All DB records exist and reference each other seamlessly!');

  // STEP F: Refuse Duplicate Credit Test (CRITICAL REQUIREMENT 10)
  console.log('\nStep F: Attempting to Credit Wallet AGAIN (Duplicate Credit Guard Test)...');
  const { req: reqDup, res: resDup } = mockReqRes({}, { id: createdPayment._id.toString() });
  await creditWalletForPayment(reqDup, resDup, (err) => { throw err; });

  console.log(`-> Response Code: ${resDup.statusCode}, Message: "${resDup.jsonResponse?.message}"`);

  if (resDup.statusCode !== 400 || resDup.jsonResponse?.success !== false) {
    throw new Error('Step F Failed! System allowed duplicate credit!');
  }

  console.log('✔ System STRICTLY REFUSED duplicate wallet credit!');

  // STEP G: Reconciliation check
  console.log('\nStep G: Testing Reconciliation Engine...');
  const { req: reqRecon, res: resRecon } = mockReqRes();
  await getManualPaymentReconciliation(reqRecon, resRecon, (err) => { throw err; });

  const matchedRecord = resRecon.jsonResponse?.data?.reconciliation?.find(r => r.paymentId === dbPayment.paymentId);
  console.log(`-> Reconciliation Record for ${dbPayment.paymentId}: Status=${matchedRecord?.reconciliationStatus}, Diff=₹${matchedRecord?.difference}`);

  if (matchedRecord?.reconciliationStatus !== 'MATCHED' || matchedRecord?.difference !== 0) {
    throw new Error('Step G Failed! Reconciliation status should be MATCHED with 0 difference.');
  }

  console.log('✔ Reconciliation Engine validated MATCHED status!');

  // STEP H: Reversal Test (Requirement 27)
  console.log('\nStep H: Testing Wallet Credit Reversal...');
  const { req: reqRev, res: resRev } = mockReqRes(
    { reason: 'Testing automated wallet reversal correction' },
    { id: dbPayment._id.toString() }
  );
  await reverseWalletCredit(reqRev, resRev, (err) => { throw err; });

  const reversedWallet = await Wallet.findOne({ userId: testRetailer._id });
  console.log(`-> Reversal Result Code: ${resRev.statusCode}, Wallet Balance restored to: ₹${(reversedWallet.balancePaise / 100).toFixed(2)}`);

  if (reversedWallet.balancePaise !== initialBalancePaise) {
    throw new Error(`Step H Failed! Expected restored balance ${initialBalancePaise}, got ${reversedWallet.balancePaise}`);
  }

  console.log('✔ Reversal correctly debited wallet balance back to initial state without deleting financial history!');

  console.log('\n=== ALL MANUAL PAYMENT SYSTEM ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
};

runAcceptanceTest().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err.message);
  process.exit(1);
});
