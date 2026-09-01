const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const { normalizePaymentType } = require('../../utils/paymentHelper');

// @desc    Get global transactions (Paginated & Searchable)
// @route   GET /api/admin/transactions
// @access  Private (Admin)
const getGlobalTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const retailerId = req.query.retailer || '';
    const service = req.query.service || '';
    const accountType = req.query.accountType || '';
    const paymentMethod = req.query.paymentMethod || '';
    const showTest = req.query.showTest === 'true';

    const query = {};

    if (accountType && accountType !== 'all') {
      query.accountType = accountType.toUpperCase();
    }

    if (paymentMethod && paymentMethod !== 'all') {
      const normFilter = normalizePaymentType(paymentMethod);
      if (normFilter === 'UPI') {
        query.$or = [
          { paymentMethod: { $in: ['UPI', 'RAZORPAY_UPI', 'RAZORPAY', 'upi', 'razorpay_upi', 'bhim_upi', 'upi_qr'] } },
          { paymentStatus: { $in: ['UPI', 'RAZORPAY_UPI', 'RAZORPAY', 'upi', 'razorpay_upi', 'bhim_upi', 'upi_qr'] } },
          { 'upiDetails.gatewayPaymentId': { $ne: null } }
        ];
      } else if (normFilter === 'WALLET') {
        query.$or = [
          { paymentMethod: { $in: ['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT', 'wallet'] } },
          { paymentStatus: { $in: ['WALLET', 'WALLETS', 'WALLET_DEBIT', 'WALLET_CREDIT', 'wallet'] } }
        ];
      } else {
        query.$or = [
          { paymentMethod: { $regex: new RegExp(`^${normFilter}$`, 'i') } },
          { paymentStatus: { $regex: new RegExp(`^${normFilter}$`, 'i') } }
        ];
      }
    }

    if (!showTest) {
      query.isTest = { $ne: true };
    }

    if (service) {
      if (service === 'recharge') {
        query.service = { $in: ['mobile_recharge', 'dth', 'mobile', 'recharge'] };
      } else {
        query.service = { $regex: new RegExp(`^${service}$`, 'i') };
      }
    }

    // 1. Filter by specific retailer if provided in the query string
    if (retailerId) {
      const user = await User.findOne({ retailerId });
      if (user) {
        query.userId = user._id;
      } else {
        // If the retailerId doesn't exist, return empty
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 }
        });
      }
    }

    // 2. Filter by Status (case-insensitive)
    if (status && status !== 'all') {
      query.status = { $regex: new RegExp(`^${status}$`, 'i') };
    }

    // 3. Search by Reference ID, Customer Mobile Number, or API Reference
    if (search) {
      const searchOr = [
        { referenceId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { apiReference: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { 'upiDetails.utr': { $regex: search, $options: 'i' } },
        { 'upiDetails.gatewayOrderId': { $regex: search, $options: 'i' } },
        { 'upiDetails.gatewayPaymentId': { $regex: search, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await Transaction.countDocuments(query);
    
    // Fetch transactions and populate user details
    const transactions = await Transaction.find(query)
      .populate('userId', 'name retailerId phone accountType')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    const formattedTransactions = transactions.map(doc => {
      const canonicalMethod = normalizePaymentType(doc);
      const rawStatus = doc.paymentStatus || doc.paymentMethod || 'UNKNOWN';
      return {
        ...doc,
        paymentStatus: rawStatus,
        paymentMethod: canonicalMethod,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGlobalTransactions
};
