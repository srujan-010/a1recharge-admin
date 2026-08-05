const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find a super admin
  const Admin = require('./models/AdminUser');
  const admin = await Admin.findOne({ role: 'SUPER_ADMIN' });
  
  if (!admin) {
    console.log("No super admin found");
    process.exit(1);
  }

  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // Find a pending recharge
  const RechargeTransaction = require('./models/RechargeTransaction');
  const txn = await RechargeTransaction.findOne({ status: 'PENDING' });
  
  if (!txn) {
    console.log("No pending transaction found");
    process.exit(1);
  }

  console.log(`Found txn: ${txn.orderId}`);

  try {
    const res = await axios.post(`http://localhost:5001/api/admin/recharges/${txn.orderId}/action`, {
      action: 'MANUAL_SUCCESS',
      remarks: 'Test override reason'
    }, {
      headers: {
        'Idempotency-Key': 'test-key-123',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error status:", err.response?.status);
    console.log("Error data:", err.response?.data);
    console.log("Error message:", err.message);
  }
  
  process.exit(0);
}

run();
