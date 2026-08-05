const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const RechargeTransaction = require('./models/RechargeTransaction');
    const Transaction = require('./models/Transaction');

    const orderIds = ['A1R1784651070681162', 'TEST_A1R1784536931135'];

    for (const orderId of orderIds) {
      console.log(`Processing ${orderId}...`);
      const recharge = await RechargeTransaction.findOne({ orderId });
      
      if (!recharge) {
        console.log(`Not found: ${orderId}`);
        continue;
      }

      recharge.status = 'FAILED';
      recharge.failureReason = 'Forced Manual Failure by Admin';
      await recharge.save();

      // Find the associated wallet transaction and mark it as failed
      await Transaction.updateOne(
        { referenceId: orderId },
        { status: 'failed' }
      );

      console.log(`Successfully marked ${orderId} as FAILED.`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
