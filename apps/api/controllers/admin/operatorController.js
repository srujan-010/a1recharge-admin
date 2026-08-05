const ProviderOperator = require('../../models/ProviderOperator');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get all operators (Paginated & Searchable)
// @route   GET /api/admin/operators
// @access  Private (Admin)
const getOperators = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const serviceType = req.query.serviceType || '';
    const status = req.query.status || '';

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } }
      ];
    }

    if (serviceType && serviceType !== 'all') {
      query.serviceType = serviceType;
    }

    if (status && status !== 'all') {
      query.status = status === 'active';
    }

    const startIndex = (page - 1) * limit;
    const total = await ProviderOperator.countDocuments(query);
    
    const operators = await ProviderOperator.find(query)
      .sort({ serviceType: 1, displayOrder: 1, name: 1 })
      .skip(startIndex)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: operators,
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

// @desc    Update operator status or display order
// @route   PUT /api/admin/operators/:id
// @access  Private (Super Admin / Admin)
const updateOperator = async (req, res, next) => {
  try {
    const { status, displayOrder } = req.body;
    const operatorId = req.params.id;

    const operator = await ProviderOperator.findById(operatorId);
    
    if (!operator) {
      res.status(404);
      throw new Error('Operator not found');
    }

    const oldValues = {
      status: operator.status,
      displayOrder: operator.displayOrder
    };

    if (status !== undefined) operator.status = status;
    if (displayOrder !== undefined) operator.displayOrder = displayOrder;

    await operator.save();

    await logAudit(
      req.admin, 
      `UPDATE_OPERATOR`, 
      'OPERATOR', 
      oldValues, 
      {
        status: operator.status,
        displayOrder: operator.displayOrder
      }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `${operator.name} updated successfully.`,
      data: operator,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOperators,
  updateOperator
};
