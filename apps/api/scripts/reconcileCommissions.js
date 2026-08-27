const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RechargeTransaction = require('../models/RechargeTransaction');
const Transaction = require('../models/Transaction');
const CommissionHistory = require('../models/CommissionHistory');
const User = require('../models/User');
const commissionService = require('../services/commission/commission.service');

async function reconcile() {
  try {
    console.log('[RECONCILE] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[RECONCILE] Connected to MongoDB database successfully.');

    const users = await User.find({}).lean();
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u);

    const recharges = await RechargeTransaction.find({ status: 'SUCCESS' }).lean();
    console.log(`[RECONCILE] Found ${recharges.length} successful recharge transactions to verify & reconcile.`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const r of recharges) {
      const user = r.userId ? userMap[r.userId.toString()] : null;
      let rawAccountType = user?.accountType || r.accountType || 'PERSONAL';
      let accountType = rawAccountType.toUpperCase();
      if (!['PERSONAL', 'BUSINESS'].includes(accountType)) {
        accountType = 'PERSONAL';
      }

      const existingComm = await CommissionHistory.findOne({ transactionId: r._id });

      const commission = await commissionService.calculateCommission(
        r.operatorCode,
        r.amount,
        '',
        'mobile',
        accountType,
        r.userId
      );

      if (!existingComm) {
        await CommissionHistory.create({
          transactionId: r._id,
          userId: r.userId,
          accountType,
          operatorCode: r.operatorCode,
          rechargeAmount: r.amount,
          providerCommissionPercentage: commission.providerCommissionPercentage,
          providerCommissionAmount: commission.providerCommissionAmount,
          retailerCommissionPercentage: commission.retailerCommissionPercentage,
          retailerCommissionAmount: commission.retailerCommissionAmount,
          companyProfitPercentage: commission.companyProfitPercentage,
          companyProfitAmount: commission.companyProfitAmount,
        });
        createdCount++;
      } else {
        existingComm.accountType = accountType;
        existingComm.providerCommissionPercentage = commission.providerCommissionPercentage;
        existingComm.providerCommissionAmount = commission.providerCommissionAmount;
        existingComm.retailerCommissionPercentage = commission.retailerCommissionPercentage;
        existingComm.retailerCommissionAmount = commission.retailerCommissionAmount;
        existingComm.companyProfitPercentage = commission.companyProfitPercentage;
        existingComm.companyProfitAmount = commission.companyProfitAmount;
        await existingComm.save();
        updatedCount++;
      }

      await RechargeTransaction.updateOne({ _id: r._id }, {
        accountType,
        commissionCalculated: true
      });

      await Transaction.updateOne({ referenceId: r.orderId }, {
        accountType,
        commissionEarnedPaise: commission.retailerCommissionAmount * 100
      });
    }

    console.log('\n======================================================');
    console.log('COMMISSION RECONCILIATION SUMMARY');
    console.log('======================================================');
    console.log(`- Total Successful Recharges Checked: ${recharges.length}`);
    console.log(`- New Commission History Records Created: ${createdCount}`);
    console.log(`- Existing Commission History Records Reconciled: ${updatedCount}`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    console.log('[RECONCILE] Completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[RECONCILE ERROR]', err);
    process.exit(1);
  }
}

reconcile();
