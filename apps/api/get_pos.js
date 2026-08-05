const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge').then(async () => {
  const pos = await mongoose.model('ProviderOperator', new mongoose.Schema({},{strict:false})).find().lean();
  console.log(JSON.stringify(pos.map(p => ({name: p.name, code: p.code, type: p.serviceType})), null, 2));
  process.exit(0);
});
