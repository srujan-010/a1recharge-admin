const OperatorCommission = require('../models/OperatorCommission');
const ProviderOperator = require('../models/ProviderOperator');

const getActiveSlabs = async (req, res) => {
  try {
    const operatorCommissions = await OperatorCommission.find({ status: 'ACTIVE' }).lean();
    const providerOperators = await ProviderOperator.find().lean();
    
    const poMap = providerOperators.reduce((acc, po) => {
      acc[po.code] = po;
      return acc;
    }, {});

    const mappedSlabs = operatorCommissions.map(comm => {
      const po = poMap[comm.operatorCode] || {};
      return {
        id: comm._id.toString(),
        serviceType: po.serviceType || 'mobile',
        operatorName: comm.operatorName,
        commissionType: 'percentage', // Always percentage now
        commissionValue: comm.retailerCommission,
        effectiveFrom: comm.updatedAt || comm.createdAt || new Date().toISOString()
      };
    });

    res.json({
      success: true,
      data: mappedSlabs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch commissions' });
  }
};

module.exports = {
  getActiveSlabs
};
