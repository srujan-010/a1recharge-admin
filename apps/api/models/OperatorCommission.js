const mongoose = require('mongoose');

const operatorCommissionSchema = new mongoose.Schema(
  {
    accountType: {
      type: String,
      enum: ['PERSONAL', 'BUSINESS'],
      default: 'PERSONAL',
      required: true,
    },
    operatorCode: {
      type: String,
      required: true,
    },
    operatorName: {
      type: String,
      required: true,
    },
    providerCommission: {
      type: Number,
      required: true,
      default: 0,
      // e.g., 4 means 4%
    },
    retailerCommission: {
      type: Number,
      required: true,
      default: 0,
      // e.g., 2 means 2%
    },
    companyCommission: {
      type: Number,
      required: true,
      default: 0,
      // e.g., 2 means 2%
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

operatorCommissionSchema.index({ accountType: 1, operatorCode: 1 }, { unique: true });

const OperatorCommission = mongoose.model('OperatorCommission', operatorCommissionSchema);
module.exports = OperatorCommission;
