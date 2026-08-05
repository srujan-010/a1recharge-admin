const { calculateCommission } = require('../utils/commissionEngine');

describe('Commission Engine', () => {

  describe('Fallback behavior', () => {
    it('returns 0 commission as fallbacks are now removed (handled in DB)', () => {
      const result = calculateCommission('mobile', 'Airtel', 10000); // ₹100
      expect(result.commissionPercentage).toBe(0);
      expect(result.commissionAmountPaise).toBe(0);
      expect(result.walletDebitedAmountPaise).toBe(10000);
    });

    it('returns 0 commission for unconfigured service/operator', () => {
      const result = calculateCommission('postpaid', 'Unknown Operator', 50000);
      expect(result.commissionPercentage).toBe(0);
      expect(result.commissionAmountPaise).toBe(0);
      expect(result.walletDebitedAmountPaise).toBe(50000);
    });
  });

});
