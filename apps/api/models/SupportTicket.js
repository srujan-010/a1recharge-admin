const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderType: {
    type: String,
    enum: ['RETAILER', 'ADMIN', 'SYSTEM'],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId, // User ID or AdminUser ID depending on type
    required: false
  },
  message: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const supportTicketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: false
  },
  ticketId: {
    type: String,
    unique: true,
    required: true,
    default: () => `TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['TRANSACTION_FAILURE', 'WALLET_ISSUE', 'KYC_ISSUE', 'COMMISSION_ISSUE', 'OTHER'],
    default: 'OTHER'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    default: 'NORMAL'
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },
  messages: [messageSchema],
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
