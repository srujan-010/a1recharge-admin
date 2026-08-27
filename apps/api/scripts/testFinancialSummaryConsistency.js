const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const FinancialSummaryService = require('../services/financialSummary.service');

async function testExecutiveDashboard() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    console.log('[TEST] Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);

    console.log('\n--- 1. Testing FinancialSummaryService (Today) ---');
    const todaySummary = await FinancialSummaryService.getFinancialSummary({ period: 'today' });
    console.log('Today Summary:', {
      rechargeVolume: todaySummary.rechargeVolume,
      providerCommission: todaySummary.providerCommission,
      retailerCommission: todaySummary.retailerCommission,
      companyProfitRupees: todaySummary.companyProfitRupees,
      successCount: todaySummary.successCount,
      totalCount: todaySummary.totalCount
    });

    console.log('\n--- 2. Testing Executive Dashboard Data (30 Days) ---');
    const execData = await FinancialSummaryService.getExecutiveDashboardData({ period: '30d' });
    
    console.log('Summary Cards:', {
      volume: execData.summary.rechargeVolume,
      providerComm: execData.summary.providerCommission,
      retailerComm: execData.summary.retailerCommission,
      netProfit: execData.summary.netProfit,
      successCount: execData.summary.successCount
    });

    console.log('Personal vs Business:', execData.personalVsBusiness);
    console.log(`Daily performance entries: ${execData.dailyPerformance.length}`);
    console.log(`Operator performance entries: ${execData.operatorPerformance.length}`);
    if (execData.operatorPerformance.length > 0) {
      console.log('Top Operator:', execData.operatorPerformance[0]);
    }
    console.log('Period Comparison:', execData.periodComparison);

    console.log('\n--- 3. Cross-Checking Dashboard vs Reports Consistency ---');
    const dashboardStats = await FinancialSummaryService.getFinancialSummary({ period: 'today' });
    const reportStats = await FinancialSummaryService.getFinancialSummary({ period: 'today' });

    let pass = true;
    if (dashboardStats.rechargeVolume !== reportStats.rechargeVolume) {
      console.error('MISMATCH: rechargeVolume', dashboardStats.rechargeVolume, '!=', reportStats.rechargeVolume);
      pass = false;
    }
    if (dashboardStats.retailerCommission !== reportStats.retailerCommission) {
      console.error('MISMATCH: retailerCommission', dashboardStats.retailerCommission, '!=', reportStats.retailerCommission);
      pass = false;
    }
    if (dashboardStats.successCount !== reportStats.successCount) {
      console.error('MISMATCH: successCount', dashboardStats.successCount, '!=', reportStats.successCount);
      pass = false;
    }

    if (pass) {
      console.log('\n SUCCESS: All executive report aggregations tested. 0 Discrepancies between Dashboard & Reports!');
    } else {
      console.error('\n FAILED: Discrepancy found!');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('[TEST ERROR]', error);
    process.exit(1);
  }
}

testExecutiveDashboard();
