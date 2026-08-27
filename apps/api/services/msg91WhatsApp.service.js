const axios = require('axios');

class Msg91WhatsAppService {
  constructor() {
    this.baseUrl = 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
    this.apiUrl = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
  }

  /**
   * Helper to normalize Indian phone number to 12-digit format (e.g. 919100329521)
   */
  normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
      return `91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return digits;
    }
    return digits;
  }

  /**
   * Send WhatsApp Template Message via MSG91
   * @param {Object} options
   * @param {string} options.phone - Recipient mobile number (10 or 12 digits)
   * @param {string} [options.templateName] - Name of approved MSG91 WhatsApp template ('plansapi_wallet_low')
   * @param {string} [options.templateId] - Approved MSG91 Template ID ('2137252017178187')
   * @param {Object} [options.variables] - Map of template variables e.g. { "1": "₹24.50" }
   */
  async sendTemplateMessage({ phone, templateName = 'plansapi_wallet_low', templateId = '2137252017178187', variables = {} }) {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      throw new Error('MSG91_AUTH_KEY is not configured in environment variables.');
    }

    const formattedPhone = this.normalizePhone(phone);
    if (!formattedPhone || formattedPhone.length < 12) {
      throw new Error(`Invalid recipient phone number for WhatsApp alert: ${phone}`);
    }

    // Format A: MSG91 v5 Template IDPayload
    const payloadA = {
      template_id: templateId,
      recipients: [
        {
          to: [formattedPhone],
          variables: variables,
        },
      ],
    };

    const headers = {
      authkey: authKey,
      'Content-Type': 'application/json',
    };

    console.log(`[MSG91 WHATSAPP API] Outbound message request to ${formattedPhone} using template ${templateName} (ID: ${templateId})`);

    try {
      // Attempt Request with Format A
      const response = await axios.post(this.baseUrl, payloadA, { headers, timeout: 15000 });
      
      if (response.data && (response.data.status === 'success' || response.data.type === 'success' || response.data.hasError === false)) {
        console.log(`[MSG91 WHATSAPP SUCCESS] Response:`, response.data);
        return { success: true, data: response.data };
      }

      // If Format A returned an error message from MSG91, try Format B (Meta WABA standard payload)
      console.warn(`[MSG91 WHATSAPP] Format A response indicated warning/error:`, response.data, `Retrying with Format B...`);
      return await this.sendFormatB({ formattedPhone, templateName, templateId, variables, headers });
    } catch (error) {
      const errRes = error.response?.data;
      console.warn(`[MSG91 WHATSAPP] Format A request failed:`, errRes || error.message, `Retrying with Format B...`);
      return await this.sendFormatB({ formattedPhone, templateName, templateId, variables, headers });
    }
  }

  /**
   * Format B fallback for standard Meta WABA payload
   */
  async sendFormatB({ formattedPhone, templateName, templateId, variables, headers }) {
    const varValue = variables['1'] || variables.balance || '';

    const payloadB = {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER || '',
      content_type: 'template',
      payload: {
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en',
            policy: 'deterministic',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: String(varValue),
                },
              ],
            },
          ],
        },
      },
    };

    try {
      const response = await axios.post(this.baseUrl, payloadB, { headers, timeout: 15000 });
      console.log(`[MSG91 WHATSAPP FORMAT B SUCCESS] Response:`, response.data);
      return { success: true, data: response.data };
    } catch (error) {
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error(`[MSG91 WHATSAPP ERROR] Failed to send WhatsApp message via MSG91:`, errMsg);
      throw new Error(`MSG91 WhatsApp API Error: ${errMsg}`);
    }
  }
}

module.exports = new Msg91WhatsAppService();
