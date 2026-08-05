const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function verifyAnalytics() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const FinancialAnalyticsService = require('./services/FinancialAnalyticsService');
  
  try {
    const metrics = await FinancialAnalyticsService.getTodaysFinancialMetrics();
    console.log("=== UNIFIED FINANCIAL METRICS ===");
    console.log(JSON.stringify(metrics, null, 2));

    if (metrics.todaysRechargeVolume === 2.35) {
      console.log("VERIFICATION FAILED: Still showing ₹2.35 instead of correct volume.");
    } else {
      console.log("VERIFICATION SUCCESS: Volume is strictly in Rupees.");
    }

    if (metrics.providerCommission === 0.08) {
      console.log("VERIFICATION FAILED: Commission is calculating incorrectly (0.08).");
    } else {
      console.log("VERIFICATION SUCCESS: Commission calculation is correct.");
    }
    
    // Simulate what Dashboard returns
    console.log("\n=== DASHBOARD STATS PREVIEW ===");
    console.log({
        rechargeVolume: metrics.todaysRechargeVolume.toFixed(2),
        providerCommission: metrics.providerCommission.toFixed(2),
        retailerCommission: metrics.retailerCommission.toFixed(2),
        netProfit: metrics.netCompanyProfit.toFixed(2),
    });

  } catch (error) {
    console.error("Error during verification:", error);
  } finally {
    process.exit(0);
  }
}

verifyAnalytics();
