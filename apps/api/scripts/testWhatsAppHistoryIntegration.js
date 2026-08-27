require('dotenv').config();
const mongoose = require('mongoose');
const WhatsAppCampaignHistory = require('../models/WhatsAppCampaignHistory');

async function runTest() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a1recharge';
  await mongoose.connect(mongoUri);

  console.log('\n==========================================================');
  console.log('  UNIFIED WHATSAPP MESSAGE HISTORY - VERIFICATION TEST');
  console.log('==========================================================\n');

  // 1. Create a simulated API message send
  const apiTestReqId = `REQ_API_${Date.now()}`;
  const apiRecord = await WhatsAppCampaignHistory.create({
    messageId: 1001,
    templateId: 'tpl_api_alert',
    templateName: 'a1_recharge_api_alert',
    phoneNumberId: '1294250930429862',
    recipients: ['9100329521'],
    recipientCount: 1,
    variablesValues: 'TEST_USER|SUCCESS|20.00',
    status: 'DELIVERED',
    requestId: apiTestReqId,
    source: 'API',
    sentCount: 1,
    failedCount: 0,
  });

  console.log('✓ Created API-sent message history record:');
  console.log(`  ID: ${apiRecord._id} | Source: ${apiRecord.source} | Template: ${apiRecord.templateName} | ReqId: ${apiRecord.requestId}`);

  // 2. Create a simulated Portal message send
  const portalTestReqId = `REQ_PORTAL_${Date.now()}`;
  const portalRecord = await WhatsAppCampaignHistory.create({
    messageId: 1002,
    templateId: 'tpl_portal_broadcast',
    templateName: 'a1_recharge_portal_broadcast',
    phoneNumberId: '1294250930429862',
    recipients: ['919988776655'],
    recipientCount: 1,
    variablesValues: 'OFFER_2026',
    status: 'DELIVERED',
    requestId: portalTestReqId,
    source: 'PORTAL',
    sentCount: 1,
    failedCount: 0,
  });

  console.log('✓ Created Portal-sent message history record:');
  console.log(`  ID: ${portalRecord._id} | Source: ${portalRecord.source} | Template: ${portalRecord.templateName} | ReqId: ${portalRecord.requestId}`);

  // 3. Query history with Source = ALL
  const allHistory = await WhatsAppCampaignHistory.find({
    requestId: { $in: [apiTestReqId, portalTestReqId] }
  }).sort({ createdAt: -1 });

  console.log(`\n[QUERY: ALL SOURCES] Found ${allHistory.length} records:`);
  allHistory.forEach(item => {
    console.log(`  - [${item.source}] ${item.templateName} (${item.recipients.join(', ')}) -> Status: ${item.status}`);
  });

  if (allHistory.length === 2) {
    console.log('\n✓ PASS: Both API-sent and Portal-sent messages exist in unified history database.');
  } else {
    console.error('\n❌ FAIL: Expected 2 records, found', allHistory.length);
  }

  // Cleanup test records
  await WhatsAppCampaignHistory.deleteMany({ requestId: { $in: [apiTestReqId, portalTestReqId] } });

  await mongoose.disconnect();
}

runTest().catch(console.error);
