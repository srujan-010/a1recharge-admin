const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const fast2smsService = require('../services/fast2smsWhatsApp.service');

async function checkTemplates() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a1recharge';
    await mongoose.connect(mongoUri);
    console.log('[INFO] Connected to MongoDB');

    // 1. Sync templates from Fast2SMS
    try {
      console.log('[INFO] Syncing templates from Fast2SMS WABA...');
      await fast2smsService.syncTemplatesLocal();
    } catch (syncErr) {
      console.warn('[WARN] Fast2SMS template sync warning:', syncErr.message);
    }

    const templates = await WhatsAppTemplate.find({}).lean();
    console.log(`[INFO] Total WhatsApp Templates in DB: ${templates.length}`);

    templates.forEach(t => {
      console.log(`- Template: "${t.templateName}" (ID: ${t.messageId}, PhoneId: ${t.phoneNumberId}, Vars: ${t.varCount})`);
      console.log(`  Body: ${t.bodyText}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }
}

checkTemplates();
