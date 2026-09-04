const mongoose = require('mongoose');
const assert = require('assert');

async function runTest() {
  const uri = 'mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge';
  await mongoose.connect(uri, { dbName: 'test' });
  const db = mongoose.connection.db;

  console.log('================================================================');
  console.log('TEST SUITE: DEDUPLICATION, ACCOUNTING BREAKDOWN & RETAILER TYPE');
  console.log('================================================================');

  const unifiedTransactionService = require('../services/transaction/unifiedTransaction.service');

  // Test 1: Query Global Transactions for Yogesh (RET000027)
  console.log('\n--- [Test 1] Single Business Transaction for Recharge A1R1788507212287864 ---');
  const yogeshResult = await unifiedTransactionService.getUnifiedGlobalTransactions({
    retailerId: 'RET000027',
    page: 1,
    limit: 50
  });

  const matchingRows = yogeshResult.data.filter(t => 
    t.orderId === 'A1R1788507212287864' || 
    t.referenceId === 'A1R1788507212287864' || 
    t.referenceId === '6a9a744cf40fdf9ca46a3c71'
  );

  assert.strictEqual(matchingRows.length, 1, `Expected exactly 1 row for recharge A1R1788507212287864, found ${matchingRows.length}`);
  console.log('✅ PASS: Exactly 1 Global Transaction row found for recharge.');

  const tx = matchingRows[0];
  console.log('Transaction Summary:');
  console.log(`  Type: ${tx.transactionType}`);
  console.log(`  Gross Amount: ₹${tx.amountRupees}`);
  console.log(`  Commission: ₹${(tx.commissionEarnedPaise / 100).toFixed(2)}`);
  console.log(`  Net Wallet Debit: ₹${tx.netPayableRupees}`);
  console.log(`  Balance After Debit: ₹${tx.closingBalanceRupees}`);
  console.log(`  Operator: ${tx.operatorName}`);
  console.log(`  Target Mobile: ${tx.mobileNumber}`);
  console.log(`  Provider Transaction ID: ${tx.providerTransactionId}`);
  console.log(`  Retailer Account Type: ${tx.accountType}`);

  // Test 2: Check accounting breakdown
  console.log('\n--- [Test 2] Financial Accounting Values ---');
  assert.strictEqual(tx.amountPaise, 19900, 'Gross amount must be 19900 paise (₹199.00)');
  assert.strictEqual(tx.commissionEarnedPaise, 80, 'Commission must be 80 paise (₹0.80)');
  assert.strictEqual(tx.netPayablePaise, 19820, 'Net wallet debit must be 19820 paise (₹198.20)');
  assert.strictEqual(tx.closingBalancePaise, 83712, 'Closing balance must be 83712 paise (₹837.12)');
  assert.strictEqual(tx.amountPaise - tx.commissionEarnedPaise, tx.netPayablePaise, 'Gross - Commission must equal Net Wallet Debit');
  console.log('✅ PASS: All financial accounting breakdown values match exact integer paise.');

  // Test 3: Verify Wallet Ledger is NOT deleted
  console.log('\n--- [Test 3] Wallet Ledger Debit Persistence ---');
  const ledgerDoc = await db.collection('walletledgers').findOne({
    _id: new mongoose.Types.ObjectId('6a9a745cf40fdf9ca46a3c7f')
  });
  assert.ok(ledgerDoc, 'Authoritative wallet ledger entry 6a9a745cf40fdf9ca46a3c7f MUST exist in database');
  assert.strictEqual(ledgerDoc.amountPaise, 19820, 'Ledger amount must remain 19820 paise');
  console.log(`✅ PASS: Wallet ledger record ${ledgerDoc._id} remains intact (Amount: ₹${ledgerDoc.amount}, BalanceAfter: ₹${ledgerDoc.balanceAfter}).`);

  // Test 4: Verify No Duplicate "N/A" Target Debit Row
  console.log('\n--- [Test 4] No Orphan Duplicate Ledger Row in Global Transactions ---');
  const orphanLedgerRows = yogeshResult.data.filter(t => 
    (t.amountPaise === 19820 || t.amountRupees === 198.20) && !t.mobileNumber
  );
  assert.strictEqual(orphanLedgerRows.length, 0, `Expected 0 orphan ledger rows, found ${orphanLedgerRows.length}`);
  console.log('✅ PASS: No duplicate/orphan recharge ledger row emitted in Global Transactions.');

  // Test 5: Verify Retailer Type for RET000027 and RET000044
  console.log('\n--- [Test 5] Retailer Account Type Classification ---');
  assert.strictEqual(tx.accountType, 'RETAILER', 'Yogesh accountType must be RETAILER');
  assert.notStrictEqual(tx.accountType, 'UNKNOWN', 'accountType must not be UNKNOWN');

  const kartikResult = await unifiedTransactionService.getUnifiedGlobalTransactions({
    retailerId: 'RET000044',
    page: 1,
    limit: 10
  });
  if (kartikResult.data.length > 0) {
    const kTx = kartikResult.data[0];
    assert.strictEqual(kTx.accountType, 'RETAILER', 'Kartik accountType must be RETAILER');
    assert.notStrictEqual(kTx.accountType, 'UNKNOWN', 'Kartik accountType must not be UNKNOWN');
    console.log(`✅ PASS: Kartik kalkota accountType resolves to "${kTx.accountType}" (not UNKNOWN).`);
  }
  console.log(`✅ PASS: Yogesh accountType resolves to "${tx.accountType}" (not UNKNOWN).`);

  // Test 6: Verify Standalone Transactions Still Appear
  console.log('\n--- [Test 6] Standalone Financial Transactions ---');
  const standaloneTypes = await db.collection('walletledgers').find({
    referenceType: { $in: ['ADD_MONEY', 'MANUAL', 'ADMIN_CREDIT', 'ADMIN_DEBIT'] }
  }).limit(5).toArray();
  console.log(`Found ${standaloneTypes.length} standalone wallet ledger entries in DB.`);

  const allTx = await unifiedTransactionService.getUnifiedGlobalTransactions({
    page: 1,
    limit: 50
  });
  const topups = allTx.data.filter(t => t.transactionType.includes('WALLET_TOPUP'));
  const adminCredits = allTx.data.filter(t => t.transactionType === 'ADMIN_CREDIT');
  const adminDebits = allTx.data.filter(t => t.transactionType === 'ADMIN_DEBIT');
  console.log(`In Global Transactions: Top-ups: ${topups.length}, Admin Credits: ${adminCredits.length}, Admin Debits: ${adminDebits.length}`);
  assert.ok(topups.length > 0 || adminCredits.length > 0 || adminDebits.length > 0, 'Standalone transactions must continue to appear');
  console.log('✅ PASS: Standalone wallet movements continue to appear as independent Global Transactions.');

  console.log('\n================================================================');
  console.log('🎉 ALL 6 DEDUPLICATION AND RETAILER CLASSIFICATION TESTS PASSED!');
  console.log('================================================================\n');

  await mongoose.disconnect();
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
