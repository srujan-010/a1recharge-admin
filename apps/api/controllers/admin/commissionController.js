const OperatorCommission = require('../../models/OperatorCommission');
const CommissionHistory = require('../../models/CommissionHistory');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get all operator commissions
// @route   GET /api/admin/commissions
// @access  Private (Admin)
const getCommissions = async (req, res, next) => {
  try {
    const providerOperators = await require('../../models/ProviderOperator').find().lean();
    const commissions = await OperatorCommission.find().lean();

    // Map commissions by operatorCode
    const commissionMap = commissions.reduce((acc, comm) => {
      acc[comm.operatorCode] = comm;
      return acc;
    }, {});

    // Create joined array
    const joinedData = providerOperators.map(po => {
      const comm = commissionMap[po.code] || {
        providerCommission: 0,
        retailerCommission: 0,
        companyCommission: 0,
        status: 'INACTIVE'
      };
      return {
        _id: comm._id || null, // ID of the OperatorCommission record
        operatorCode: po.code,
        operatorName: po.name,
        serviceType: po.serviceType,
        providerCommission: comm.providerCommission,
        retailerCommission: comm.retailerCommission,
        companyCommission: comm.companyCommission,
        status: comm.status, // ACTIVE / INACTIVE from OperatorCommission
        poStatus: po.status, // true / false from ProviderOperator
      };
    });

    res.status(200).json({
      success: true,
      data: joinedData,
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
    const { providerCommission, retailerCommission, status, operatorName } = req.body;
    const code = req.params.id;

    if (providerCommission === undefined || retailerCommission === undefined) {
      res.status(400);
      throw new Error('Please provide both providerCommission and retailerCommission percentages.');
    }

    if (retailerCommission > providerCommission) {
      res.status(400);
      throw new Error('Retailer commission cannot exceed the provider commission. This would result in negative company margin.');
    }

    let commissionRecord = await OperatorCommission.findOne({ operatorCode: code });
    
    if (!commissionRecord) {
      // Create new
      commissionRecord = new OperatorCommission({
        operatorCode: code,
        operatorName: operatorName || code,
        providerCommission: 0,
        retailerCommission: 0,
        companyCommission: 0,
        status: 'ACTIVE'
      });
    }

    const companyCommission = providerCommission - retailerCommission;

    const oldValues = {
      providerCommission: commissionRecord.providerCommission,
      retailerCommission: commissionRecord.retailerCommission,
      companyCommission: commissionRecord.companyCommission,
      status: commissionRecord.status
    };

    commissionRecord.providerCommission = providerCommission;
    commissionRecord.retailerCommission = retailerCommission;
    commissionRecord.companyCommission = companyCommission;
    
    if (status) {
      commissionRecord.status = status;
    }

    await commissionRecord.save();



    // Also trigger standard Audit Log
    await logAudit(
      req.admin, 
      `UPDATE_COMMISSION`, 
      'COMMISSION', 
      oldValues, 
      {
        providerCommission: commissionRecord.providerCommission,
        retailerCommission: commissionRecord.retailerCommission,
        companyCommission: commissionRecord.companyCommission,
        status: commissionRecord.status
      }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `${commissionRecord.operatorName} commission updated successfully.`,
      data: commissionRecord,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommissions,
  updateCommission
};
