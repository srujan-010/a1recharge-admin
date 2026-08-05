const SupportTicket = require('../../models/SupportTicket');
const Notification = require('../../models/Notification');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get All Support Tickets (Paginated & Filtered)
// @route   GET /api/admin/support/tickets
// @access  Private (Admin / Support)
const getTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'OPEN'; // default to open

    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const startIndex = (page - 1) * limit;
    const total = await SupportTicket.countDocuments(query);
    
    const tickets = await SupportTicket.find(query)
      .populate('userId', 'retailerId phone fullName name email')
      .populate('transactionId', 'transactionId amountPaise service status')
      .populate('resolvedBy', 'name email')
      .sort({ updatedAt: -1, createdAt: -1 }) // surface most recently active first
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: tickets,
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

// @desc    Admin Reply to Ticket
// @route   POST /api/admin/support/tickets/:id/reply
// @access  Private (Admin / Support)
const replyToTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      res.status(400);
      throw new Error('Reply message cannot be empty');
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }

    // Add admin message
    ticket.messages.push({
      senderType: 'ADMIN',
      senderId: req.admin._id,
      message: message.trim()
    });

    // Auto-update status to IN_PROGRESS if it was OPEN
    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
    }

    await ticket.save();

    // Push Notification to the Retailer
    await Notification.create({
      userId: ticket.userId,
      type: 'IN_APP',
      title: 'Support Replied',
      message: `An admin has replied to your ticket #${ticket.ticketId}.`,
      category: 'INFO',
      action: 'ROUTE_SUPPORT',
      actionData: { ticketId: ticket._id }
    });

    await logAudit(
      req.admin, 
      `REPLY_TICKET`, 
      'SUPPORT', 
      { ticketId: ticket.ticketId }, 
      { action: 'Admin sent a reply' }, 
      req
    );

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve / Close Ticket
// @route   PUT /api/admin/support/tickets/:id/resolve
// @access  Private (Admin / Support)
const resolveTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body; // RESOLVED or CLOSED

    if (!['RESOLVED', 'CLOSED'].includes(status)) {
      res.status(400);
      throw new Error('Status must be RESOLVED or CLOSED');
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.resolvedBy = req.admin._id;
    ticket.resolvedAt = Date.now();

    // Add automated system message
    ticket.messages.push({
      senderType: 'SYSTEM',
      message: `Ticket marked as ${status} by admin.`
    });

    await ticket.save();

    // Notify retailer
    await Notification.create({
      userId: ticket.userId,
      type: 'IN_APP',
      title: `Ticket ${status === 'RESOLVED' ? 'Resolved' : 'Closed'}`,
      message: `Your ticket #${ticket.ticketId} has been marked as ${status.toLowerCase()}.`,
      category: status === 'RESOLVED' ? 'SUCCESS' : 'INFO',
      action: 'ROUTE_SUPPORT',
      actionData: { ticketId: ticket._id }
    });

    await logAudit(
      req.admin, 
      `RESOLVE_TICKET`, 
      'SUPPORT', 
      { ticketId: ticket.ticketId, status: oldStatus }, 
      { status: ticket.status }, 
      req
    );

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  replyToTicket,
  resolveTicket
};
