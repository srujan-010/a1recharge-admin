const OperatorCommission = require('../../models/OperatorCommission');
const CommissionHistory = require('../../models/CommissionHistory');
const ProviderOperator = require('../../models/ProviderOperator');
const { logAudit } = require('../../utils/auditHelper');
const { getOperatorCodeAliases } = require('../../utils/operatorAlias');

// @desc    Get all operator commissions with stats & accountType filter
// @route   GET /api/admin/commissions
// @access  Private (Admin)
const getCommissions = async (req, res, next) => {
  try {
    const accountType = req.query.accountType ? req.query.accountType.toUpperCase() : 'ALL';
    console.log('[Commission] MongoDB connected');
    console.log(`[Commission] Loading operator commission configuration for accountType: ${accountType}`);

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
      personalSlabs: allCommissions.filter((c) => c.accountType === 'PERSONAL').length,
      businessSlabs: allCommissions.filter((c) => c.accountType === 'BUSINESS').length,
      activeSlabs: allCommissions.filter((c) => c.status === 'ACTIVE').length,
      inactiveSlabs: allCommissions.filter((c) => c.status === 'INACTIVE').length,
      personalActive: allCommissions.filter((c) => c.accountType === 'PERSONAL' && c.status === 'ACTIVE').length,
      businessActive: allCommissions.filter((c) => c.accountType === 'BUSINESS' && c.status === 'ACTIVE').length,
    };

    let joinedData = [];

    if (accountType === 'PERSONAL' || accountType === 'BUSINESS') {
      // Map commissions with alias fallback so po.code matches commission operatorCode or aliases
      joinedData = providerOperators.map((po) => {
        const aliases = getOperatorCodeAliases(po.code);
        const comm = commissions.find(
          (c) => aliases.includes((c.operatorCode || '').toUpperCase()) || (c.operatorName && c.operatorName.toLowerCase() === po.name.toLowerCase())
        );

        const providerComm = comm ? comm.providerCommission || 0 : 0;
        const retailerComm = comm ? comm.retailerCommission || 0 : 0;
        const companyComm = comm ? comm.companyCommission ?? (providerComm - retailerComm) : 0;

        console.log(`[Commission] Operator: ${po.name} (${po.code}) | AccountType: ${accountType} | Provider Commission: ${providerComm}% | Retailer Commission: ${retailerComm}%`);

        return {
          _id: comm ? comm._id : null,
          accountType: comm ? comm.accountType : accountType,
          operatorCode: comm ? comm.operatorCode : po.code,
          operatorName: po.name,
          serviceType: po.serviceType || po.type || 'mobile',
          providerCommission: providerComm,
          retailerCommission: retailerComm,
          companyCommission: companyComm,
          status: comm ? comm.status : 'INACTIVE',
          poStatus: po.status,
        };
      });
    } else {
      // ALL selected: return all existing slabs explicitly, plus unconfigured operators for PERSONAL & BUSINESS
      const list = [];
      commissions.forEach((comm) => {
        const aliases = getOperatorCodeAliases(comm.operatorCode);
        const po = providerOperators.find((p) => aliases.includes(p.code.toUpperCase()) || p.name.toLowerCase() === (comm.operatorName || '').toLowerCase());
        const providerComm = comm.providerCommission || 0;
        const retailerComm = comm.retailerCommission || 0;
        const companyComm = comm.companyCommission ?? (providerComm - retailerComm);

        console.log(`[Commission] Operator: ${comm.operatorName || comm.operatorCode} | AccountType: ${comm.accountType} | Provider Commission: ${providerComm}% | Retailer Commission: ${retailerComm}%`);

        list.push({
          _id: comm._id,
          accountType: comm.accountType,
          operatorCode: comm.operatorCode,
          operatorName: comm.operatorName || (po ? po.name : comm.operatorCode),
          serviceType: comm.serviceType || (po ? (po.serviceType || po.type || 'mobile') : 'mobile'),
          providerCommission: providerComm,
          retailerCommission: retailerComm,
          companyCommission: companyComm,
          status: comm.status,
          poStatus: po ? po.status : true,
        });
      });

      providerOperators.forEach((po) => {
        ['PERSONAL', 'BUSINESS'].forEach((accType) => {
          const aliases = getOperatorCodeAliases(po.code);
          const exists = commissions.some(
            (c) => c.accountType === accType && (aliases.includes((c.operatorCode || '').toUpperCase()) || (c.operatorName && c.operatorName.toLowerCase() === po.name.toLowerCase()))
          );

          if (!exists) {
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
    console.error('[Commission Error] Failed to load operator commissions:', error);
    next(error);
  }
};

// @desc    Create new commission slab
// @route   POST /api/admin/commissions
// @access  Private (Super Admin / Finance)
const createCommission = async (req, res, next) => {
  try {
    const { accountType, operatorCode, operatorName, providerCommission, retailerCommission, status, serviceType } = req.body;

    if (!accountType || !['PERSONAL', 'BUSINESS'].includes(accountType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid account type.' });
    }

    if (!operatorCode) {
      return res.status(400).json({ success: false, message: 'Operator code is required.' });
    }

    const upperAccType = accountType.toUpperCase();
    const cleanOpCode = operatorCode.trim().toUpperCase();
    const aliases = getOperatorCodeAliases(cleanOpCode);

    // Check duplicate
    const existing = await OperatorCommission.findOne({ accountType: upperAccType, operatorCode: { $in: aliases } });
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
      operatorCode: cleanOpCode,
      operatorName: operatorName || cleanOpCode,
      serviceType: serviceType || 'mobile',
      providerCommission: providerCommNum,
      retailerCommission: retailerCommNum,
      companyCommission,
      status: status || 'ACTIVE',
    });

    await commissionRecord.save();

    console.log(`[Commission] Created ${upperAccType} slab for ${commissionRecord.operatorName} (${cleanOpCode}) | Provider: ${providerCommNum}% | Retailer: ${retailerCommNum}% | Margin: ${companyCommission}%`);

    await logAudit(
      req.admin,
      `CREATE_COMMISSION`,
      'COMMISSION',
      null,
      {
        accountType: upperAccType,
        operatorCode: cleanOpCode,
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
    console.error('[Commission Error] Failed to create commission:', error);
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

    const aliases = getOperatorCodeAliases(code);

    // Try finding by MongoDB ObjectId first, or by operatorCode + accountType (with aliases)
    let commissionRecord = null;
    if (code.match(/^[0-9a-fA-F]{24}$/)) {
      commissionRecord = await OperatorCommission.findById(code);
    }
    if (!commissionRecord) {
      commissionRecord = await OperatorCommission.findOne({
        accountType: targetAccountType,
        $or: [{ operatorCode: { $in: aliases } }, { operatorName: { $regex: new RegExp(`^${operatorName || code}$`, 'i') } }],
      });
    }

    if (!commissionRecord) {
      // Create new for this accountType and operatorCode
      commissionRecord = new OperatorCommission({
        accountType: targetAccountType,
        operatorCode: code.toUpperCase(),
        operatorName: operatorName || code,
        providerCommission: providerCommNum,
        retailerCommission: retailerCommNum,
        companyCommission: providerCommNum - retailerCommNum,
        status: status || 'ACTIVE',
      });
    }

    const companyCommission = providerCommNum - retailerCommNum;

    const oldValues = {
      accountType: commissionRecord.accountType,
      providerCommission: commissionRecord.providerCommission,
      retailerCommission: commissionRecord.retailerCommission,
      companyCommission: commissionRecord.companyCommission,
      status: commissionRecord.status,
    };

    commissionRecord.providerCommission = providerCommNum;
    commissionRecord.retailerCommission = retailerCommNum;
    commissionRecord.companyCommission = companyCommission;
    if (operatorName) commissionRecord.operatorName = operatorName;

    if (status) {
      commissionRecord.status = status;
    }

    await commissionRecord.save();

    console.log(`[Commission] Updated ${commissionRecord.accountType} slab for ${commissionRecord.operatorName} (${commissionRecord.operatorCode}) | Provider: ${providerCommNum}% | Retailer: ${retailerCommNum}% | Margin: ${companyCommission}%`);

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
        status: commissionRecord.status,
      },
      req
    );

    res.status(200).json({
      success: true,
      message: `[${commissionRecord.accountType}] ${commissionRecord.operatorName} commission updated successfully.`,
      data: commissionRecord,
    });
  } catch (error) {
    console.error('[Commission Error] Failed to update commission:', error);
    next(error);
  }
};

module.exports = {
  getCommissions,
  createCommission,
  updateCommission,
};

