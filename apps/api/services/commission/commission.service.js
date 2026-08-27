const OperatorCommission = require('../../models/OperatorCommission');
const ProviderOperator = require('../../models/ProviderOperator');
const User = require('../../models/User');
const { calculateCommission: calculateCommissionFallback } = require('../../utils/commissionEngine');

// Known operator code alias mappings across providers & commission configurations
const OPERATOR_ALIAS_MAP = {
  'A': ['A', 'AT', 'AIRTEL'],
  'AT': ['AT', 'A', 'AIRTEL'],
  'RC': ['RC', 'JO', 'JIO'],
  'JO': ['JO', 'RC', 'JIO'],
  'V': ['V', 'VI', 'I', 'VODAFONE', 'IDEA'],
  'VI': ['VI', 'V', 'I', 'VODAFONE', 'IDEA'],
  'I': ['I', 'VI', 'V', 'VODAFONE', 'IDEA'],
  'BT': ['BT', 'BR', 'BS', 'BSNL'],
  'BR': ['BR', 'BT', 'BS', 'BSNL'],
  'BS': ['BS', 'BT', 'BR', 'BSNL'],
  'ATV': ['ATV', 'AIRDTH'],
  'AIRDTH': ['AIRDTH', 'ATV'],
  'DTV': ['DTV', 'DISHTV'],
  'TTV': ['TTV', 'TATASKY'],
  'VTV': ['VTV', 'VIDEOCOND2H'],
  'STV': ['STV', 'SUNDIRECT'],
};

class CommissionService {
  /**
   * Calculate commissions for a given operator, amount, and accountType
   * @param {string} operatorCode
   * @param {number} amount - Recharge amount in Rupees
   * @param {string} operatorName
   * @param {string} serviceType
   * @param {string} accountType - 'PERSONAL' or 'BUSINESS'
   * @param {string|ObjectId} userId - Optional User ID to resolve accountType if omitted
   */
  async calculateCommission(
    operatorCode,
    amount,
    operatorName = '',
    serviceType = 'mobile',
    accountType = null,
    userId = null
  ) {
    let resolvedAccountType = (accountType || '').toUpperCase();

    // If accountType is not explicitly provided or invalid, resolve from User model
    if (!['PERSONAL', 'BUSINESS'].includes(resolvedAccountType) && userId) {
      try {
        const user = await User.findById(userId).select('accountType').lean();
        if (user && user.accountType) {
          resolvedAccountType = user.accountType.toUpperCase();
        }
      } catch (err) {
        console.error('[CommissionService] Failed to fetch User accountType:', err.message);
      }
    }

    if (!['PERSONAL', 'BUSINESS'].includes(resolvedAccountType)) {
      resolvedAccountType = 'PERSONAL';
    }

    const opCodeClean = (operatorCode || '').trim().toUpperCase();
    const possibleCodes = OPERATOR_ALIAS_MAP[opCodeClean] || [opCodeClean];

    // 1. Try finding specific active rule for resolvedAccountType and operatorCode (or aliases)
    let commissionRule = await OperatorCommission.findOne({
      accountType: resolvedAccountType,
      operatorCode: { $in: possibleCodes },
      status: 'ACTIVE',
    }).lean();

    // 2. Fallback: if not found for specific accountType, check if any active rule exists for the operator
    if (!commissionRule) {
      commissionRule = await OperatorCommission.findOne({
        operatorCode: { $in: possibleCodes },
        status: 'ACTIVE',
      }).lean();
    }

    if (!commissionRule) {
      let resolvedOperatorName = operatorName;
      if (!resolvedOperatorName) {
        const providerOp = await ProviderOperator.findOne({ code: { $in: possibleCodes } }).lean();
        if (providerOp) {
          resolvedOperatorName = providerOp.name;
          serviceType = providerOp.type === 'dth' ? 'dth' : 'mobile';
        }
      }

      if (resolvedOperatorName) {
        const fallback = calculateCommissionFallback(serviceType, resolvedOperatorName, amount * 100);
        const fallbackRetailerComm = fallback.commissionAmountPaise / 100;
        return {
          accountType: resolvedAccountType,
          providerCommissionPercentage: fallback.commissionPercentage,
          providerCommissionAmount: fallbackRetailerComm,
          retailerCommissionPercentage: fallback.commissionPercentage,
          retailerCommissionAmount: fallbackRetailerComm,
          companyProfitPercentage: 0,
          companyProfitAmount: 0,
        };
      }

      return {
        accountType: resolvedAccountType,
        providerCommissionPercentage: 0,
        providerCommissionAmount: 0,
        retailerCommissionPercentage: 0,
        retailerCommissionAmount: 0,
        companyProfitPercentage: 0,
        companyProfitAmount: 0,
      };
    }

    const providerCommPct = commissionRule.providerCommission || 0;
    const retailerCommPct = commissionRule.retailerCommission || 0;

    const providerAmount = parseFloat((amount * (providerCommPct / 100)).toFixed(2));
    const retailerAmount = parseFloat((amount * (retailerCommPct / 100)).toFixed(2));
    
    // Company profit = provider commission received minus retailer commission paid out
    const companyProfitPct = parseFloat((providerCommPct - retailerCommPct).toFixed(2));
    const companyAmount = parseFloat((providerAmount - retailerAmount).toFixed(2));

    console.log(
      `[CommissionResolved] AccountType: ${resolvedAccountType} | OpCode: ${opCodeClean} | Amount: ₹${amount} | ` +
      `ProviderComm: ${providerCommPct}% (₹${providerAmount}) | RetailerComm: ${retailerCommPct}% (₹${retailerAmount}) | NetProfit: ₹${companyAmount}`
    );

    return {
      accountType: resolvedAccountType,
      commissionConfigId: commissionRule._id,
      providerCommissionPercentage: providerCommPct,
      providerCommissionAmount: providerAmount,
      retailerCommissionPercentage: retailerCommPct,
      retailerCommissionAmount: retailerAmount,
      companyProfitPercentage: companyProfitPct,
      companyProfitAmount: companyAmount,
    };
  }
}

module.exports = new CommissionService();

