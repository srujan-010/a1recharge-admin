require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const AdminUser = require('./models/AdminUser');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('admin123', salt);
  await AdminUser.updateOne({ email: 'admin@a1recharge.com' }, { $set: { password: hash } });
  console.log('Password reset to admin123');
  process.exit(0);
});
