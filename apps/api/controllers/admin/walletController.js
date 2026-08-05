const WalletLedger = require('../../models/WalletLedger');
const User = require('../../models/User');
const walletService = require('../../services/wallet/wallet.service');
const NotificationService = require('../../services/notification.service');
const { logAudit } = require('../../utils/auditHelper');
const mongoose = require('mongoose');

// @desc    Get global wallet ledger (Paginated & Searchable)
// @route   GET /api/admin/wallets/ledger
// @access  Private (Admin)
const getGlobalLedger = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || ''; // Could search by Retailer ID or reference ID

    const query = {};

    if (search) {
      // If the search is a valid ObjectId, search by userId or referenceId
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or = [
          { userId: search },
          { referenceId: search }
        ];
      } else {
        // Find users matching search term to get their ObjectIds
        const users = await User.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { retailerId: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        const userIds = users.map(u => u._id);
        
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        } else {
          // If search doesn't match any user and isn't an ObjectId, return empty
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, pages: 0 }
          });
        }
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await WalletLedger.countDocuments(query);
    
    // Fetch ledger entries and populate user details
    const ledger = await WalletLedger.find(query)
      .populate('userId', 'name retailerId phone')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: ledger,
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

// @desc    Manually Adjust Wallet (Credit or Debit)
// @route   POST /api/admin/wallets/:userId/adjust
// @access  Private (Super Admin / Finance)
const manualCreditDebit = async (req, res, next) => {
  try {
    const { type, amountPaise, reason } = req.body;
    const { userId } = req.params;

    if (!['credit', 'debit'].includes(type)) {
      res.status(400);
      throw new Error('Invalid adjustment type. Must be credit or debit.');
    }

    if (!amountPaise || amountPaise <= 0) {
      res.status(400);
      throw new Error('Amount must be greater than 0 paise.');
    }

    if (!reason || reason.trim().length < 5) {
      res.status(400);
      throw new Error('A valid reason (min 5 chars) is required for manual adjustments.');
    }

    const retailer = await User.findById(userId);
    if (!retailer) {
      res.status(404);
      throw new Error('Retailer not found');
    }

    const amountRupees = amountPaise / 100;

    // Generate a unique reference ID for this manual transaction
    const refId = new mongoose.Types.ObjectId();

    if (type === 'credit') {
      const resVal = await walletService.addBalance(userId, amountRupees, {
        referenceType: 'MANUAL',
        referenceId: refId,
        description: `Manual Credit: ${reason}`,
      });
      NotificationService.sendWalletCredited({
        userId,
        amount: amountRupees,
        newBalance: resVal && resVal.newBalance ? resVal.newBalance : undefined,
        reason: `Manual Credit: ${reason}`,
        referenceId: refId
      });
    } else {
      await walletService.reserveAmount(userId, amountRupees);
      const resVal = await walletService.commitReservation(userId, amountRupees, {
        referenceType: 'MANUAL',
        referenceId: refId,
        description: `Manual Debit: ${reason}`,
      });
      NotificationService.sendWalletDebited({
        userId,
        amount: amountRupees,
        newBalance: resVal && resVal.newBalance ? resVal.newBalance : undefined,
        reason: `Manual Debit: ${reason}`,
        referenceId: refId
      });
    }

    // Audit Log this critical action
    await logAudit(
      req.admin, 
      `MANUAL_WALLET_ADJUSTMENT`, 
      'WALLET', 
      null, 
      { userId, type, amountPaise, reason, referenceId: refId }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `Successfully applied manual ${type} of ₹${amountRupees.toFixed(2)} to ${retailer.name}.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGlobalLedger,
  manualCreditDebit
};
