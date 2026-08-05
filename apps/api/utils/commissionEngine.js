/**
 * Fallback commission calculator.
 * Since commissions are now globally managed in OperatorCommission MongoDB collection,
 * if this fallback is ever hit, it means the operator is not configured or is inactive.
 * Therefore, we default to 0% commission.
 */
const calculateCommission = (serviceType, operatorName, amountPaise) => {
  return {
    commissionPercentage: 0,
    commissionAmountPaise: 0,
    walletDebitedAmountPaise: amountPaise
  };
};

module.exports = { calculateCommission };
