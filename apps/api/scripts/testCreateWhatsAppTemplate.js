const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fast2smsService = require('../services/fast2smsWhatsApp.service');

async function testCreateTemplate() {
  try {
    console.log('[INFO] Attempting to create template provider_wallet_low_balance_500 on Fast2SMS...');

    const result = await fast2smsService.createWabaTemplateOnFast2SMS({
      name: 'provider_wallet_low_balance_500',
      category: 'UTILITY',
      language: 'en_US',
      components: [
        {
          type: 'BODY',
          text: '🚨 A1 Recharge Alert\n\nYour A1 Topup wallet balance has fallen below the minimum threshold.\n\nCurrent Balance: ₹{{1}}\nThreshold: ₹500\nDetected At: {{2}} IST\n\nPlease recharge the provider wallet immediately to avoid recharge failures.',
          example: {
            body_text: [
              ['472.35', '27 Aug 2026, 11:48 PM']
            ]
          }
        }
      ]
    });

    console.log('[SUCCESS] Created template on Fast2SMS:', result);
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Failed to create template on Fast2SMS:', err.message);
    process.exit(0); // Exit cleanly so script failure does not crash process
  }
}

testCreateTemplate();
