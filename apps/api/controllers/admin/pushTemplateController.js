const PushNotificationTemplate = require('../../models/PushNotificationTemplate');
const seedPushTemplates = require('../../utils/seedPushTemplates');
const { logAudit } = require('../../utils/auditHelper');

const extractVariables = (title, body) => {
  const text = `${title || ''} ${body || ''}`;
  const matches = text.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || [];
  return [...new Set(matches.map(m => m.replace(/{{\s*|\s*}}/g, '')))];
};

const CATEGORIES = [
  { id: 'RECHARGE', label: 'Recharge', description: 'Recharge status & transaction updates' },
  { id: 'WALLET', label: 'Wallet', description: 'Wallet credit, debit & balance alerts' },
  { id: 'OFFERS', label: 'Offers', description: 'Promotional cashback & operator deals' },
  { id: 'FESTIVAL', label: 'Festival', description: 'Festival wishes & holiday specials' },
  { id: 'KYC', label: 'KYC', description: 'KYC document verification updates' },
  { id: 'SECURITY', label: 'Security', description: 'Security alerts, PIN & login updates' },
  { id: 'SYSTEM', label: 'System', description: 'System maintenance & status messages' },
  { id: 'PROMOTION', label: 'Promotion', description: 'Marketing & promotional campaigns' },
  { id: 'ANNOUNCEMENT', label: 'Announcement', description: 'Platform news & admin updates' },
  { id: 'CUSTOM', label: 'Custom', description: 'General custom templates' },
];

// @desc    Get All Push Notification Templates
// @route   GET /api/admin/push-notifications/templates
// @access  Private (Admin)
const getTemplates = async (req, res, next) => {
  try {
    const count = await PushNotificationTemplate.countDocuments({ isDeleted: false });
    if (count === 0) {
      await seedPushTemplates();
    }

    const { search, category, isFavorite, isSystemTemplate } = req.query;
    const query = { isDeleted: false };

    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }

    if (isFavorite === 'true') {
      query.isFavorite = true;
    }

    if (isSystemTemplate !== undefined && isSystemTemplate !== '') {
      query.isSystemTemplate = isSystemTemplate === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const templates = await PushNotificationTemplate.find(query)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ isFavorite: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Available Template Categories
// @route   GET /api/admin/push-notifications/templates/categories
// @access  Private (Admin)
const getCategories = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: CATEGORIES,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Single Push Notification Template
// @route   GET /api/admin/push-notifications/templates/:id
// @access  Private (Admin)
const getTemplateById = async (req, res, next) => {
  try {
    const template = await PushNotificationTemplate.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!template) {
      res.status(404);
      throw new Error('Push notification template not found.');
    }

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Push Notification Template
// @route   POST /api/admin/push-notifications/templates
// @access  Private (Super Admin / Admin)
const createTemplate = async (req, res, next) => {
  try {
    const { name, category, title, body, bannerImage, deepLink, priority, ttl, tags, isFavorite } = req.body;

    if (!name || !title || !body) {
      res.status(400);
      throw new Error('Template Name, Title, and Message Body are required.');
    }

    if (title.length > 65) {
      res.status(400);
      throw new Error('Notification Title cannot exceed 65 characters.');
    }

    if (body.length > 240) {
      res.status(400);
      throw new Error('Message Body cannot exceed 240 characters.');
    }

    const variables = extractVariables(title, body);

    const template = await PushNotificationTemplate.create({
      name,
      category: (category || 'CUSTOM').toUpperCase(),
      title,
      body,
      bannerImage: bannerImage || null,
      deepLink: deepLink || null,
      priority: priority === 'high' ? 'high' : 'normal',
      ttl: ttl ? parseInt(ttl, 10) : 2419200,
      variables,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      isFavorite: isFavorite === true,
      isSystemTemplate: false,
      createdBy: req.admin?._id || null,
    });

    await logAudit(req.admin, 'CREATE_PUSH_TEMPLATE', 'PUSH_NOTIFICATION', null, { name, category }, req);

    res.status(201).json({
      success: true,
      message: 'Push notification template created successfully.',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Push Notification Template
// @route   PUT /api/admin/push-notifications/templates/:id
// @access  Private (Super Admin / Admin)
const updateTemplate = async (req, res, next) => {
  try {
    const template = await PushNotificationTemplate.findOne({ _id: req.params.id, isDeleted: false });

    if (!template) {
      res.status(404);
      throw new Error('Push notification template not found.');
    }

    const { name, category, title, body, bannerImage, deepLink, priority, ttl, tags, isFavorite } = req.body;

    if (title && title.length > 65) {
      res.status(400);
      throw new Error('Notification Title cannot exceed 65 characters.');
    }

    if (body && body.length > 240) {
      res.status(400);
      throw new Error('Message Body cannot exceed 240 characters.');
    }

    if (name) template.name = name;
    if (category) template.category = category.toUpperCase();
    if (title) template.title = title;
    if (body) template.body = body;
    if (bannerImage !== undefined) template.bannerImage = bannerImage || null;
    if (deepLink !== undefined) template.deepLink = deepLink || null;
    if (priority) template.priority = priority;
    if (ttl !== undefined) template.ttl = parseInt(ttl, 10);
    if (tags !== undefined) template.tags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);
    if (isFavorite !== undefined) template.isFavorite = isFavorite === true;

    template.variables = extractVariables(template.title, template.body);
    template.updatedBy = req.admin?._id || null;

    await template.save();

    await logAudit(req.admin, 'UPDATE_PUSH_TEMPLATE', 'PUSH_NOTIFICATION', null, { templateId: template._id, name: template.name }, req);

    res.status(200).json({
      success: true,
      message: 'Push notification template updated successfully.',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Push Notification Template (Soft Delete)
// @route   DELETE /api/admin/push-notifications/templates/:id
// @access  Private (Super Admin / Admin)
const deleteTemplate = async (req, res, next) => {
  try {
    const template = await PushNotificationTemplate.findOne({ _id: req.params.id, isDeleted: false });

    if (!template) {
      res.status(404);
      throw new Error('Push notification template not found.');
    }

    if (template.isSystemTemplate) {
      res.status(403);
      throw new Error('System default templates cannot be deleted.');
    }

    template.isDeleted = true;
    template.updatedBy = req.admin?._id || null;
    await template.save();

    await logAudit(req.admin, 'DELETE_PUSH_TEMPLATE', 'PUSH_NOTIFICATION', null, { templateId: template._id, name: template.name }, req);

    res.status(200).json({
      success: true,
      message: 'Push notification template deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Favorite Status of Template
// @route   POST /api/admin/push-notifications/templates/:id/favorite
// @access  Private (Admin)
const toggleFavorite = async (req, res, next) => {
  try {
    const template = await PushNotificationTemplate.findOne({ _id: req.params.id, isDeleted: false });

    if (!template) {
      res.status(404);
      throw new Error('Push notification template not found.');
    }

    template.isFavorite = !template.isFavorite;
    template.updatedBy = req.admin?._id || null;
    await template.save();

    res.status(200).json({
      success: true,
      isFavorite: template.isFavorite,
      message: template.isFavorite ? 'Added to favorites.' : 'Removed from favorites.',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate Push Notification Template
// @route   POST /api/admin/push-notifications/templates/:id/duplicate
// @access  Private (Admin)
const duplicateTemplate = async (req, res, next) => {
  try {
    const template = await PushNotificationTemplate.findOne({ _id: req.params.id, isDeleted: false });

    if (!template) {
      res.status(404);
      throw new Error('Push notification template not found.');
    }

    const cloneName = `${template.name} (Copy)`;

    const duplicated = await PushNotificationTemplate.create({
      name: cloneName,
      category: template.category,
      title: template.title,
      body: template.body,
      bannerImage: template.bannerImage,
      deepLink: template.deepLink,
      priority: template.priority,
      ttl: template.ttl,
      variables: template.variables,
      tags: template.tags,
      isFavorite: false,
      isSystemTemplate: false, // Duplicates are always custom templates
      usageCount: 0,
      createdBy: req.admin?._id || null,
    });

    await logAudit(req.admin, 'DUPLICATE_PUSH_TEMPLATE', 'PUSH_NOTIFICATION', null, { originalId: template._id, cloneId: duplicated._id }, req);

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully.',
      data: duplicated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  getCategories,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleFavorite,
  duplicateTemplate,
};
