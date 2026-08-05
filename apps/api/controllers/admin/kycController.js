const Kyc = require('../../models/Kyc');
const User = require('../../models/User');
const { logAudit } = require('../../utils/auditHelper');
const NotificationService = require('../../services/notification.service');

// @desc    Get all KYC records (Paginated & Filtered)
// @route   GET /api/admin/kyc
// @access  Private (Admin)
const getKycList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'pending'; // default to pending
    const search = req.query.search || '';

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { shopName: { $regex: search, $options: 'i' } }
      ];
    }

    const startIndex = (page - 1) * limit;
    const total = await Kyc.countDocuments(query);
    
    // Fetch KYCs, populate user to get retailer ID and phone
    const kycs = await Kyc.find(query)
      .populate('userId', 'retailerId phone email')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    // Use the toAdminJSON method to decrypt Aadhaar/PAN for admin viewing
    const decryptedKycs = kycs.map(kyc => {
      const adminData = kyc.toAdminJSON();
      // Attach populated userId manually since toAdminJSON strips populated objects if not handled
      if (kyc.userId) adminData.user = kyc.userId;
      if (kyc.verifiedBy) adminData.verifiedByAdmin = kyc.verifiedBy;
      return adminData;
    });

    res.status(200).json({
      success: true,
      data: decryptedKycs,
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

// @desc    Update KYC Status (Approve/Reject)
// @route   PUT /api/admin/kyc/:id/status
// @access  Private (Admin)
const updateKycStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const kycId = req.params.id;

    if (!['verified', 'rejected'].includes(status)) {
      res.status(400);
      throw new Error('Invalid status. Must be verified or rejected.');
    }

    if (status === 'rejected' && (!remarks || remarks.trim().length < 5)) {
      res.status(400);
      throw new Error('Please provide a reason for rejection (min 5 characters).');
    }

    const kyc = await Kyc.findById(kycId);
    
    if (!kyc) {
      res.status(404);
      throw new Error('KYC record not found');
    }

    const oldStatus = kyc.status;
    kyc.status = status;
    kyc.remarks = remarks || '';
    kyc.verifiedBy = req.admin._id;

    if (status === 'verified') {
      kyc.approvedAt = Date.now();
      // Also update the User model
      await User.findByIdAndUpdate(kyc.userId, { kycStatus: 'verified' });
      
      // Notify retailer via Event-Driven Notification Engine
      NotificationService.sendKycApproved({ userId: kyc.userId });
    } else if (status === 'rejected') {
      kyc.rejectedAt = Date.now();
      await User.findByIdAndUpdate(kyc.userId, { kycStatus: 'rejected' });
      
      // Notify retailer via Event-Driven Notification Engine
      NotificationService.sendKycRejected({ userId: kyc.userId, reason: remarks });
    }

    await kyc.save();

    await logAudit(
      req.admin, 
      `KYC_${status.toUpperCase()}`, 
      'KYC', 
      { status: oldStatus }, 
      { status: kyc.status, remarks: kyc.remarks }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `KYC has been ${status}.`,
      data: kyc.toAdminJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKycList,
  updateKycStatus
};
