const RechargeTransaction = require('../models/RechargeTransaction');
const ProviderFactory = require('./providers/provider.factory');

class FinancialAnalyticsService {
  /**
   * Calculates all unified financial metrics for Today.
   * This is the Single Source of Truth for Dashboard and Provider Wallet KPIs.
   */
  static async getTodaysFinancialMetrics() {
    const a1Topup = ProviderFactory.getProvider('A1Topup');
    let liveProviderBalance = null;
    let providerHealth = 'Safe';
    
    // 1. Fetch exact live balance from A1 Topup API
    try {
      const balanceData = await a1Topup.balance();
      if (balanceData && balanceData.success) {
        liveProviderBalance = balanceData.balance;
      }
    } catch (err) {
      console.error('Failed to fetch A1Topup balance in FinancialAnalyticsService:', err.message);
      liveProviderBalance = null;
    }

    if (liveProviderBalance !== null) {
      if (liveProviderBalance < 400) providerHealth = 'Critical';
      else if (liveProviderBalance < 1000) providerHealth = 'Warning';
    } else {
      providerHealth = 'Unknown';
    }

    // 2. Setup Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 3. Single Aggregation Pipeline for all transaction metrics
    const aggregationResult = await RechargeTransaction.aggregate([
      { 
        $match: { 
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'SUCCESS',
          isTest: { $ne: true },
          orderId: { $not: /^TEST/i }
        } 
      },
      {
        $lookup: {
          from: 'commissionhistories',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'commissionDoc'
        }
      },
      {
        $unwind: {
          path: '$commissionDoc',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          amount: 1, // Amount in RUPEES
          providerCommission: { $ifNull: ['$commissionDoc.providerCommissionAmount', 0] },
          retailerCommission: { $ifNull: ['$commissionDoc.retailerCommissionAmount', 0] }
        }
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$amount' },
          totalProviderCommission: { $sum: '$providerCommission' },
          totalRetailerCommission: { $sum: '$retailerCommission' },
          rechargeCount: { $sum: 1 }
        }
      }
    ]);

    const stats = aggregationResult.length > 0 ? aggregationResult[0] : {
      totalVolume: 0,
      totalProviderCommission: 0,
      totalRetailerCommission: 0,
      rechargeCount: 0
    };

    const todaysRechargeVolume = stats.totalVolume;
    const providerCommission = stats.totalProviderCommission;
    const retailerCommission = stats.totalRetailerCommission;
    const netCompanyProfit = providerCommission - retailerCommission;
    const todaysConsumption = todaysRechargeVolume - providerCommission;

    return {
      todaysRechargeVolume,
      providerCommission,
      retailerCommission,
      netCompanyProfit,
      todaysConsumption,
      rechargeCount: stats.rechargeCount,
      liveProviderBalance,
      providerHealth,
      lastUpdated: new Date()
    };
  }
}

module.exports = FinancialAnalyticsService;
