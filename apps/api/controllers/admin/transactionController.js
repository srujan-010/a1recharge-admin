const unifiedTransactionService = require('../../services/transaction/unifiedTransaction.service');

// @desc    Get global transactions (Paginated & Searchable across all financial transaction types)
// @route   GET /api/admin/transactions
// @access  Private (Admin)
const getGlobalTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const retailerId = req.query.retailer || '';
    const service = req.query.service || '';
    const transactionType = req.query.transactionType || 'all';
    const accountType = req.query.accountType || 'all';
    const paymentMethod = req.query.paymentMethod || 'all';
    const showTest = req.query.showTest === 'true';

    const result = await unifiedTransactionService.getUnifiedGlobalTransactions({
      page,
      limit,
      search,
      status,
      retailerId,
      service,
      transactionType,
      paymentMethod,
      accountType,
      showTest
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGlobalTransactions
};
