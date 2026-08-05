const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // Let's just use Node's native fetch if available, or we'll use http module.

dotenv.config();

async function runTest() {
  console.log("Starting test...");
  
  // 1. Test OPTIONS request
  console.log("Testing OPTIONS request...");
  const optionsRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/admin/wallets/123/adjust',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'idempotency-key'
      }
    }, (res) => {
      resolve(res.headers);
    });
    req.on('error', reject);
    req.end();
  });
  
  console.log("OPTIONS Headers:", optionsRes);
  const allowHeaders = optionsRes['access-control-allow-headers'];
  if (!allowHeaders || (!allowHeaders.includes('idempotency-key') && !allowHeaders.includes('Idempotency-Key'))) {
    console.error("FAILED: idempotency-key not in allowed headers", allowHeaders);
    process.exit(1);
  } else {
    console.log("SUCCESS: idempotency-key is allowed.");
  }
  
  // 2. Connect to DB
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  
  const AdminUser = require('./models/AdminUser');
  const User = require('./models/User');
  const Wallet = require('./models/Wallet');
  const WalletLedger = require('./models/WalletLedger');
  const AuditLog = require('./models/AuditLog');
  
  // Find or create admin
  let admin = await AdminUser.findOne({ role: 'SUPER_ADMIN' });
  if (!admin) {
    console.log("No admin found. Cannot test.");
    process.exit(1);
  }
  
  // Generate token directly for admin (bypassing login)
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  
  // Find a retailer
  let retailer = await User.findOne({ role: 'retailer' });
  if (!retailer) {
    console.log("Creating dummy retailer...");
    retailer = await User.create({
      name: 'Test Retailer',
      phone: '9999999999',
      role: 'retailer',
      status: 'active'
    });
    await Wallet.create({ userId: retailer._id, balance: 0 });
  }
  
  const userId = retailer._id.toString();
  console.log(`Using Retailer ID: ${userId}`);
  
  // 3. Make POST request (Credit 100 Rs)
  console.log("Making POST request for credit...");
  
  const postData = JSON.stringify({
    amountPaise: 10000,
    type: 'credit',
    reason: 'Test Credit'
  });
  
  const postRes = await new Promise((resolve, reject) => {
    let responseData = '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path: `/api/admin/wallets/${userId}/adjust`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'idempotency-key': 'test-key-1',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: responseData }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  console.log(`Credit Response: ${postRes.statusCode}`, postRes.body);
  
  // 4. Make POST request (Debit 100 Rs)
  console.log("Making POST request for debit...");
  const postDataDebit = JSON.stringify({
    amountPaise: 10000,
    type: 'debit',
    reason: 'Test Debit'
  });
  
  const postResDebit = await new Promise((resolve, reject) => {
    let responseData = '';
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api/admin/wallets/${userId}/adjust`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'idempotency-key': 'test-key-2',
        'Content-Length': Buffer.byteLength(postDataDebit)
      }
    }, (res) => {
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: responseData }));
    });
    req.on('error', reject);
    req.write(postDataDebit);
    req.end();
  });
  
  console.log(`Debit Response: ${postResDebit.statusCode}`, postResDebit.body);
  
  // 5. Verify DB changes
  const wallet = await Wallet.findOne({ userId });
  console.log(`Wallet Balance: ${wallet.balance}`);
  
  const ledgers = await WalletLedger.find({ userId }).sort({ createdAt: -1 }).limit(2);
  console.log("Recent Ledgers:", ledgers.map(l => ({ type: l.transactionType, amt: l.amount, desc: l.description })));
  
  const audits = await AuditLog.find({ action: 'WALLET_ADJUSTMENT' }).sort({ createdAt: -1 }).limit(2);
  console.log("Recent Audits:", audits.map(a => ({ action: a.action, target: a.targetId })));
  
  console.log("Test complete.");
  process.exit(0);
}

runTest().catch(console.error);
