const OperatorCommission = require('../../models/OperatorCommission');
const CommissionHistory = require('../../models/CommissionHistory');
const ProviderOperator = require('../../models/ProviderOperator');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get all operator commissions with stats & accountType filter
// @route   GET /api/admin/commissions
// @access  Private (Admin)
const getCommissions = async (req, res, next) => {
  try {
    const accountType = req.query.accountType ? req.query.accountType.toUpperCase() : 'ALL';
    const providerOperators = await ProviderOperator.find().lean();
    
    // Build query for commissions
    const commQuery = {};
    if (accountType === 'PERSONAL' || accountType === 'BUSINESS') {
      commQuery.accountType = accountType;
    }

    const commissions = await OperatorCommission.find(commQuery).lean();
    const allCommissions = await OperatorCommission.find().lean();

    // Summary Statistics
    const stats = {
      personalSlabs: allCommissions.filter(c => c.accountType === 'PERSONAL').length,
      businessSlabs: allCommissions.filter(c => c.accountType === 'BUSINESS').length,
      activeSlabs: allCommissions.filter(c => c.status === 'ACTIVE').length,
      inactiveSlabs: allCommissions.filter(c => c.status === 'INACTIVE').length,
      personalActive: allCommissions.filter(c => c.accountType === 'PERSONAL' && c.status === 'ACTIVE').length,
      businessActive: allCommissions.filter(c => c.accountType === 'BUSINESS' && c.status === 'ACTIVE').length,
    };

    let joinedData = [];

    if (accountType === 'PERSONAL' || accountType === 'BUSINESS') {
      // Map commissions by operatorCode for selected accountType
      const commissionMap = commissions.reduce((acc, comm) => {
        acc[comm.operatorCode] = comm;
        return acc;
      }, {});

      joinedData = providerOperators.map(po => {
        const comm = commissionMap[po.code] || {
          _id: null,
          accountType: accountType,
          providerCommission: 0,
          retailerCommission: 0,
          companyCommission: 0,
          status: 'INACTIVE'
        };
        return {
          _id: comm._id || null,
          accountType: comm.accountType || accountType,
          operatorCode: po.code,
          operatorName: po.name,
          serviceType: po.serviceType || po.type || 'mobile',
          providerCommission: comm.providerCommission || 0,
          retailerCommission: comm.retailerCommission || 0,
          companyCommission: comm.companyCommission || 0,
          status: comm.status || 'INACTIVE',
          poStatus: po.status,
        };
      });
    } else {
      // ALL selected: return all existing slabs explicitly, plus unconfigured operators for PERSONAL & BUSINESS
      const configuredMap = {};
      commissions.forEach(comm => {
        configuredMap[`${comm.accountType}_${comm.operatorCode}`] = comm;
      });

      // Include all configured commissions plus missing operators
      const list = [];
      commissions.forEach(comm => {
        const po = providerOperators.find(p => p.code === comm.operatorCode);
        list.push({
          _id: comm._id,
          accountType: comm.accountType,
          operatorCode: comm.operatorCode,
          operatorName: comm.operatorName || (po ? po.name : comm.operatorCode),
          serviceType: po ? (po.serviceType || po.type || 'mobile') : 'mobile',
          providerCommission: comm.providerCommission,
          retailerCommission: comm.retailerCommission,
          companyCommission: comm.companyCommission,
          status: comm.status,
          poStatus: po ? po.status : true,
        });
      });

      // Add unconfigured operators as defaults if no slabs exist at all for them
      providerOperators.forEach(po => {
        ['PERSONAL', 'BUSINESS'].forEach(accType => {
          if (!configuredMap[`${accType}_${po.code}`]) {
            list.push({
              _id: null,
              accountType: accType,
              operatorCode: po.code,
              operatorName: po.name,
              serviceType: po.serviceType || po.type || 'mobile',
              providerCommission: 0,
              retailerCommission: 0,
              companyCommission: 0,
              status: 'INACTIVE',
              poStatus: po.status,
            });
          }
        });
      });

      joinedData = list;
    }

    res.status(200).json({
      success: true,
      stats,
      data: joinedData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new commission slab
// @route   POST /api/admin/commissions
// @access  Private (Super Admin / Finance)
const createCommission = async (req, res, next) => {
  try {
    const { accountType, operatorCode, operatorName, providerCommission, retailerCommission, status } = req.body;

    if (!accountType || !['PERSONAL', 'BUSINESS'].includes(accountType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid account type.' });
    }

    if (!operatorCode) {
      return res.status(400).json({ success: false, message: 'Operator code is required.' });
    }

    const upperAccType = accountType.toUpperCase();

    // Check duplicate
    const existing = await OperatorCommission.findOne({ accountType: upperAccType, operatorCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A commission slab already exists for this account type and configuration.',
      });
    }

    const providerCommNum = Number(providerCommission) || 0;
    const retailerCommNum = Number(retailerCommission) || 0;

    if (retailerCommNum > providerCommNum) {
      return res.status(400).json({
        success: false,
        message: 'Retailer commission cannot exceed provider commission.',
      });
    }

    const companyCommission = providerCommNum - retailerCommNum;

    const commissionRecord = new OperatorCommission({
      accountType: upperAccType,
      operatorCode,
      operatorName: operatorName || operatorCode,
      providerCommission: providerCommNum,
      retailerCommission: retailerCommNum,
      companyCommission,
      status: status || 'ACTIVE',
    });

    await commissionRecord.save();

    await logAudit(
      req.admin,
      `CREATE_COMMISSION`,
      'COMMISSION',
      null,
      {
        accountType: upperAccType,
        operatorCode,
        providerCommission: providerCommNum,
        retailerCommission: retailerCommNum,
        companyCommission,
        status: commissionRecord.status,
      },
      req
    );

    res.status(201).json({
      success: true,
      message: `${upperAccType} commission slab for ${commissionRecord.operatorName} created successfully.`,
      data: commissionRecord,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update operator commission
// @route   PUT /api/admin/commissions/:id
// @access  Private (Super Admin / Finance)
const updateCommission = async (req, res, next) => {
  try {
    const { providerCommission, retailerCommission, status, operatorName, accountType } = req.body;
    const code = req.params.id; // operatorCode or record ID
    const targetAccountType = (accountType || 'PERSONAL').toUpperCase();

    if (providerCommission === undefined || retailerCommission === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both providerCommission and retailerCommission percentages.',
      });
    }

    const providerCommNum = Number(providerCommission);
    const retailerCommNum = Number(retailerCommission);

    if (retailerCommNum > providerCommNum) {
      return res.status(400).json({
        success: false,
        message: 'Retailer commission cannot exceed the provider commission. This would result in negative company margin.',
      });
    }

    // Try finding by MongoDB ObjectId first, or by operatorCode + accountType
    let commissionRecord = null;
    if (code.match(/^[0-9a-fA-F]{24}$/)) {
      commissionRecord = await OperatorCommission.findById(code);
    }
    if (!commissionRecord) {
      commissionRecord = await OperatorCommission.findOne({ accountType: targetAccountType, operatorCode: code });
    }
    
    if (!commissionRecord) {
      // Create new for this accountType and operatorCode
      commissionRecord = new OperatorCommission({
        accountType: targetAccountType,
        operatorCode: code,
        operatorName: operatorName || code,
        providerCommission: 0,
        retailerCommission: 0,
        companyCommission: 0,
        status: 'ACTIVE'
      });
    }

    const companyCommission = providerCommNum - retailerCommNum;

    const oldValues = {
      accountType: commissionRecord.accountType,
      providerCommission: commissionRecord.providerCommission,
      retailerCommission: commissionRecord.retailerCommission,
      companyCommission: commissionRecord.companyCommission,
      status: commissionRecord.status
    };

    commissionRecord.providerCommission = providerCommNum;
    commissionRecord.retailerCommission = retailerCommNum;
    commissionRecord.companyCommission = companyCommission;
    
    if (status) {
      commissionRecord.status = status;
    }

    await commissionRecord.save();

    // Trigger Audit Log
    await logAudit(
      req.admin, 
      `UPDATE_COMMISSION`, 
      'COMMISSION', 
      oldValues, 
      {
        accountType: commissionRecord.accountType,
        providerCommission: commissionRecord.providerCommission,
        retailerCommission: commissionRecord.retailerCommission,
        companyCommission: commissionRecord.companyCommission,
        status: commissionRecord.status
      }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `[${commissionRecord.accountType}] ${commissionRecord.operatorName} commission updated successfully.`,
      data: commissionRecord,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommissions,
  createCommission,
  updateCommission
};
