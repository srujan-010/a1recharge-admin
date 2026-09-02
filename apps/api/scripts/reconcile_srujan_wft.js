const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Transaction = require('../models/Transaction');
const walletService = require('../services/wallet/wallet.service');

async function processSrujanWft() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;
    const userId = new mongoose.Types.ObjectId('6a8c29b65578db4ad2b54247');

    console.log('=== RECONCILING SRUJAN AKULA (RET000013) JUST-COMPLETED ₹100 TOP-UP ===\n');

    // Find the pending WFT record for ₹100 (order_TX6oSPSNIr452S)
    const wft = await db.collection('walletfundingtransactions').findOne({
      userId,
      razorpayOrderId: 'order_TX6oSPSNIr452S'
    });

    if (!wft) {
      console.log('WFT record order_TX6oSPSNIr452S not found!');
      return;
    }

    console.log('Found WFT record:', wft);

    // Call processSuccessfulWalletTopup safely
    const result = await walletService.processSuccessfulWalletTopup({
      userId,
      amountPaise: wft.amountPaise,
      referenceId: wft.razorpayOrderId,
      paymentMethod: 'UPI',
      paymentStatus: 'RAZORPAY_UPI',
      description: 'Wallet Top-up via Razorpay Checkout',
      upiDetails: {
        gateway: 'Razorpay UPI',
        gatewayOrderId: wft.razorpayOrderId,
        gatewayPaymentId: wft.razorpayPaymentId || `pay_RECONCILED_${wft.razorpayOrderId}`
      },
      isTest: false
    });

    // Update WFT status to SUCCESS
    await db.collection('walletfundingtransactions').updateOne(
      { _id: wft._id },
      {
        $set: {
          status: 'SUCCESS',
          razorpayPaymentId: wft.razorpayPaymentId || `pay_RECONCILED_${wft.razorpayOrderId}`
        }
      }
    );

    console.log('\n✅ RECONCILIATION RESULT:', result);

  } catch (err) {
    console.error('Error during reconciliation:', err);
  } finally {
    await mongoose.disconnect();
  }
}

processSrujanWft();
