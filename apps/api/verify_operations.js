const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function testOperations() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const RechargeTransaction = require('./models/RechargeTransaction');
  const TransactionActionLog = require('./models/TransactionActionLog');
  const AdminUser = require('./models/AdminUser');
  const User = require('./models/User');

  try {
    const admin = await AdminUser.findOne({ role: 'SUPER_ADMIN' });
    if (!admin) {
      console.log("No super admin found");
      return;
    }

    const retailer = await User.findOne({ role: 'retailer' });

    // 1. Create a dummy RechargeTransaction
    const orderId = `TEST_OP_${Date.now()}`;
    const txn = await RechargeTransaction.create({
      orderId,
      userId: retailer._id,
      providerName: 'A1Topup',
      mobileNumber: '9999999999',
      amount: 10,
      operatorCode: 'RC',
      circleCode: '4',
      status: 'PENDING',
      isTest: true
    });
    console.log("Created PENDING RechargeTransaction:", orderId);

    // 2. We can't really call the API via express easily here, but we can simulate the controller call.
    // Instead, just verifying schema works.
    await TransactionActionLog.create({
      transactionId: txn._id,
      adminId: admin._id,
      action: 'ADD_NOTE',
      previousStatus: 'PENDING',
      newStatus: 'PENDING',
      remarks: 'This is a test note'
    });
    
    txn.internalNotes.push({ note: 'This is a test note', adminId: admin._id });
    await txn.save();

    console.log("Successfully logged action and updated notes.");

    // Fetch details logic simulation
    const details = await RechargeTransaction.findOne({ orderId }).populate('internalNotes.adminId').lean();
    console.log("Fetched Details successfully. Notes count:", details.internalNotes.length);

    console.log("Verification of Operations backend models successful.");
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    process.exit(0);
  }
}

testOperations();
