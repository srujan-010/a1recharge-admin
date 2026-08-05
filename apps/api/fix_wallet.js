const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const RechargeTransaction = require('./models/RechargeTransaction');
    const walletService = require('./services/wallet/wallet.service');

    const orderIds = ['A1R1784651070681162', 'TEST_A1R1784536931135'];

    for (const orderId of orderIds) {
      console.log(`Checking wallet for ${orderId}...`);
      const recharge = await RechargeTransaction.findOne({ orderId });
      
      if (!recharge) continue;

      if (!recharge.userId) {
        console.log(`No userId for ${orderId}`);
        continue;
      }

      try {
        await walletService.releaseReservation(recharge.userId, recharge.amount);
        console.log(`Successfully released ₹${recharge.amount} reservation for user ${recharge.userId}.`);
      } catch (err) {
        console.log(`Could not release reservation: ${err.message}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
