const mongoose = require('mongoose');

const transactionActionLogSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RechargeTransaction',
    required: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true,
  },
  action: {
    type: String,
    enum: ['CHECK_STATUS', 'RETRY', 'REFUND', 'KEEP_PENDING', 'MANUAL_SUCCESS', 'MANUAL_FAILURE', 'ADD_NOTE'],
    required: true,
  },
  previousStatus: {
    type: String,
  },
  newStatus: {
    type: String,
  },
  remarks: {
    type: String,
    required: true,
  }
}, {
  timestamps: true,
});

const TransactionActionLog = mongoose.model('TransactionActionLog', transactionActionLogSchema);
module.exports = TransactionActionLog;
