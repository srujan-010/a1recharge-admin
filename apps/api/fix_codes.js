const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://srujanakula5_db_user:QrEBERW3YYiCOU2b@a1recharge.uxhkjxg.mongodb.net/?appName=A1recharge').then(async () => {
  const OC = mongoose.model('OperatorCommission', new mongoose.Schema({operatorCode: String, operatorName: String}, {strict: false}));
  await OC.updateOne({operatorName: 'Jio'}, {$set: {operatorCode: 'RC'}});
  await OC.updateOne({operatorName: 'Vi'}, {$set: {operatorCode: 'V'}});
  await OC.updateOne({operatorName: 'Tata Play'}, {$set: {operatorCode: 'TTV'}});
  await OC.updateOne({operatorName: 'Sun Direct'}, {$set: {operatorCode: 'STV'}});
  await OC.updateOne({operatorName: 'BSNL'}, {$set: {operatorCode: 'BR'}});
  
  // also create one for Idea if it doesn't exist to match Vi
  const vi = await OC.findOne({operatorName: 'Vi'}).lean();
  if (vi) {
    delete vi._id;
    vi.operatorCode = 'I';
    vi.operatorName = 'Idea';
    await OC.updateOne({operatorCode: 'I'}, {$set: vi}, {upsert: true});
  }

  console.log('Fixed codes in OperatorCommission');
  process.exit(0);
});
