const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get all distributors (Paginated & Searchable)
// @route   GET /api/admin/distributors
// @access  Private (Admin)
const getDistributors = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = { role: 'distributor' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { retailerId: { $regex: search, $options: 'i' } },
        { shopName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const startIndex = (page - 1) * limit;
    const total = await User.countDocuments(query);
    
    // Fetch distributors
    const distributors = await User.find(query)
      .select('-mpinHash -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    // Fetch wallet balances for these distributors
    const userIds = distributors.map(r => r._id);
    const wallets = await Wallet.find({ userId: { $in: userIds } }).lean();
    
    const walletMap = wallets.reduce((acc, w) => {
      acc[w.userId.toString()] = w.balancePaise;
      return acc;
    }, {});

    const enriched = distributors.map(r => ({
      ...r,
      walletBalancePaise: walletMap[r._id.toString()] || 0
    }));

    res.status(200).json({
      success: true,
      data: enriched,
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
  getDistributors
};
