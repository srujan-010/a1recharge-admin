const assert = require('assert');
const { normalizePaymentType, getRawPaymentStatus } = require('../utils/paymentHelper');

console.log('====================================================');
console.log(' RUNNING PAYMENT METHOD MAPPING REGRESSION TESTS');
console.log('====================================================\n');

const testCases = [
  {
    name: '1. Exact bug report transaction: RAZORPAY_UPI',
    doc: {
      orderId: 'A1R1788288649038332',
      retailerId: '6a8c29b65578db4ad2b54247',
      amount: 19,
      commissionAmount: 0.08,
      status: 'SUCCESS',
      paymentStatus: 'RAZORPAY_UPI',
    },
    expectedMethod: 'UPI',
    expectedStatus: 'RAZORPAY_UPI',
  },
  {
    name: '2. Document with paymentStatus = WALLET',
    doc: { paymentStatus: 'WALLET' },
    expectedMethod: 'WALLET',
    expectedStatus: 'WALLET',
  },
  {
    name: '3. Document with paymentStatus = WALLET_DEBIT',
    doc: { paymentStatus: 'WALLET_DEBIT' },
    expectedMethod: 'WALLET',
    expectedStatus: 'WALLET_DEBIT',
  },
  {
    name: '4. Document with paymentStatus = UPI',
    doc: { paymentStatus: 'UPI' },
    expectedMethod: 'UPI',
    expectedStatus: 'UPI',
  },
  {
    name: '5. Document with paymentMethod = RAZORPAY_UPI and generic status = SUCCESS',
    doc: { paymentStatus: 'SUCCESS', paymentMethod: 'RAZORPAY_UPI' },
    expectedMethod: 'UPI',
    expectedStatus: 'SUCCESS',
  },
  {
    name: '6. Document with razorpayPaymentId proof',
    doc: { razorpayPaymentId: 'pay_123456789' },
    expectedMethod: 'UPI',
    expectedStatus: 'UNKNOWN',
  },
  {
    name: '7. Document with null/empty paymentStatus & method',
    doc: {},
    expectedMethod: 'UNKNOWN',
    expectedStatus: 'UNKNOWN',
  },
  {
    name: '8. Document with unknown payment string',
    doc: { paymentStatus: 'SOME_RANDOM_INVALID_METHOD' },
    expectedMethod: 'UNKNOWN',
    expectedStatus: 'SOME_RANDOM_INVALID_METHOD',
  },
  {
    name: '9. Direct string RAZORPAY_UPI',
    input: 'RAZORPAY_UPI',
    expectedMethod: 'UPI',
  },
  {
    name: '10. Direct string WALLET_DEBIT',
    input: 'WALLET_DEBIT',
    expectedMethod: 'WALLET',
  },
];

let passed = 0;
let failed = 0;

testCases.forEach((tc) => {
  try {
    const method = normalizePaymentType(tc.doc || tc.input);
    assert.strictEqual(method, tc.expectedMethod, `Expected method ${tc.expectedMethod}, got ${method}`);

    if (tc.doc) {
      const rawStatus = getRawPaymentStatus(tc.doc);
      assert.strictEqual(rawStatus, tc.expectedStatus, `Expected status ${tc.expectedStatus}, got ${rawStatus}`);
    }

    console.log(`[PASS] ${tc.name}`);
    console.log(`       Method: ${method} ${tc.expectedStatus ? `| Status: ${tc.expectedStatus}` : ''}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${tc.name}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
});

console.log('\n----------------------------------------------------');
console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('----------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL REGRESSION TESTS PASSED CLEANLY!\n');
}
