const WhatsAppTemplate = require('../models/WhatsAppTemplate');

class Fast2SMSWhatsAppService {
  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY;
    this.baseUrl = 'https://www.fast2sms.com/dev';
  }

  getMaskedKey() {
    if (!this.apiKey) return 'NOT_CONFIGURED';
    if (this.apiKey.length <= 8) return '****';
    return `${this.apiKey.substring(0, 4)}****${this.apiKey.substring(this.apiKey.length - 4)}`;
  }

  /**
   * Fetch WABA Account / Number Details from Fast2SMS
   * Endpoint: GET /dev/dlt_manager/whatsapp?type=number
   */
  async getWabaDetails() {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    console.log(`[FAST2SMS WABA API] Fetching WABA number details (Key: ${this.getMaskedKey()})`);

    const response = await fetch(`${this.baseUrl}/dlt_manager/whatsapp?type=number`, {
      method: 'GET',
      headers: {
        'authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fast2SMS WABA Details API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error(data.message || 'No WABA account or connected phone numbers found on Fast2SMS.');
    }

    return data.data[0];
  }

  /**
   * Fetch Approved WhatsApp Templates from Fast2SMS WABA
   * Endpoint: GET /dev/dlt_manager/whatsapp?type=template
   */
  async fetchTemplatesFromFast2SMS() {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    console.log(`[FAST2SMS WABA API] Fetching WhatsApp templates (Key: ${this.getMaskedKey()})`);

    const response = await fetch(`${this.baseUrl}/dlt_manager/whatsapp?type=template`, {
      method: 'GET',
      headers: {
        'authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fast2SMS WhatsApp Templates API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
      return [];
    }

    const wabaItem = data.data[0];
    return wabaItem.templates || [];
  }

  /**
   * Sync WhatsApp Templates to Local MongoDB Cache
   */
  async syncTemplatesLocal() {
    const rawTemplates = await this.fetchTemplatesFromFast2SMS();
    const syncedAt = new Date();
    const syncedTemplates = [];

    for (const tpl of rawTemplates) {
      let bodyText = null;
      let headerText = null;
      let footerText = null;
      let buttons = [];
      let exampleValues = [];
      let mediaType = 'NONE';

      if (Array.isArray(tpl.components)) {
        for (const comp of tpl.components) {
          if (comp.type === 'BODY') {
            bodyText = comp.text || null;
            if (comp.example?.body_text && Array.isArray(comp.example.body_text[0])) {
              exampleValues = comp.example.body_text[0];
            }
          } else if (comp.type === 'HEADER') {
            headerText = comp.text || null;
            if (comp.format) mediaType = comp.format.toUpperCase();
          } else if (comp.type === 'FOOTER') {
            footerText = comp.text || null;
          } else if (comp.type === 'BUTTONS') {
            buttons = comp.buttons || [];
          }
        }
      }

      const doc = await WhatsAppTemplate.findOneAndUpdate(
        { messageId: tpl.message_id },
        {
          messageId: tpl.message_id,
          templateId: tpl.template_id,
          templateName: tpl.template_name,
          phoneNumberId: String(tpl.phone_number_id || ''),
          senderNumber: tpl.sender_number,
          category: (tpl.category || 'UTILITY').toUpperCase(),
          status: tpl.status || 'Approved',
          language: tpl.language || 'en',
          varCount: tpl.var_count || 0,
          components: tpl.components || [],
          headerText,
          bodyText,
          footerText,
          buttons,
          exampleValues,
          mediaType,
          lastSyncedAt: syncedAt,
          isDeleted: false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      syncedTemplates.push(doc);
    }

    console.log(`[Fast2SMS WABA Sync] Successfully synced ${syncedTemplates.length} WhatsApp templates.`);
    return syncedTemplates;
  }

  /**
   * Send WhatsApp Message via Fast2SMS API
   * Endpoint: POST/GET /dev/whatsapp
   */
  async sendWhatsAppMessage({
    messageId,
    phoneNumberId,
    numbers,
    variablesValues = '',
    mediaUrl = null,
    documentFilename = null,
    udf1 = null,
    udf2 = null,
    udf3 = null,
  }) {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    if (!messageId || !phoneNumberId || !numbers) {
      throw new Error('messageId, phoneNumberId, and numbers are required to send a WhatsApp message.');
    }

    // Clean and format mobile numbers (comma separated, remove non-numeric except comma)
    const formattedNumbers = Array.isArray(numbers)
      ? numbers.map(n => String(n).replace(/\D/g, '')).filter(Boolean).join(',')
      : String(numbers).replace(/[^0-9,]/g, '');

    if (!formattedNumbers) {
      throw new Error('No valid mobile numbers provided.');
    }

    // Clean variables_values (pipe separated string)
    const formattedVars = Array.isArray(variablesValues)
      ? variablesValues.join('|')
      : String(variablesValues || '');

    const queryParams = new URLSearchParams();
    queryParams.set('authorization', this.apiKey);
    queryParams.set('message_id', String(messageId));
    queryParams.set('phone_number_id', String(phoneNumberId));
    queryParams.set('numbers', formattedNumbers);

    if (formattedVars) queryParams.set('variables_values', formattedVars);
    if (mediaUrl) queryParams.set('media_url', mediaUrl);
    if (documentFilename) queryParams.set('document_filename', documentFilename);
    if (udf1) queryParams.set('udf1', udf1);
    if (udf2) queryParams.set('udf2', udf2);
    if (udf3) queryParams.set('udf3', udf3);

    console.log(`[FAST2SMS WABA SEND] Sending WhatsApp message_id=${messageId} to ${formattedNumbers} (Vars: "${formattedVars}")`);

    const response = await fetch(`${this.baseUrl}/whatsapp?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || data.return === false || data.success === false) {
      throw new Error(data.message || data.error || `Fast2SMS WhatsApp API Error (${response.status})`);
    }

    return data;
  }

  /**
   * Fetch Live Delivery Report for a specific Request ID from Fast2SMS
   * Endpoint: GET /dev/whatsapp/{REQUEST_ID}
   */
  async getDeliveryReport(requestId) {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    if (!requestId) {
      throw new Error('Request ID is required to fetch delivery report.');
    }

    console.log(`[FAST2SMS WABA REPORT] Fetching delivery report for request_id=${requestId}`);

    const response = await fetch(`${this.baseUrl}/whatsapp/${requestId}`, {
      method: 'GET',
      headers: {
        'authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fast2SMS Delivery Report API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Create WhatsApp Template on Fast2SMS / Meta WABA Platform
   * Endpoint: POST /dev/whatsapp/v24.0/{waba_id}/message_templates
   */
  async createWabaTemplateOnFast2SMS(templateData) {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    const wabaDetails = await this.getWabaDetails().catch(() => ({ waba_id: '988843927460634' }));
    const wabaId = wabaDetails.waba_id || '988843927460634';

    const url = `${this.baseUrl}/whatsapp/v24.0/${wabaId}/message_templates`;
    const method = 'POST';

    const requestBody = {
      name: templateData.name,
      category: templateData.category || 'UTILITY',
      language: templateData.language || 'en_US',
      components: templateData.components || [],
    };

    console.log(`\n================ FAST2SMS TEMPLATE CREATE REQUEST ================`);
    console.log(`[HTTP Request] ${method} ${url}`);
    console.log(`[Headers] authorization: ${this.getMaskedKey()}, Content-Type: application/json`);
    console.log(`[Request Body]\n${JSON.stringify(requestBody, null, 2)}`);

    const response = await fetch(url, {
      method,
      headers: {
        'authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { raw: responseText };
    }

    console.log(`[HTTP Response Status] ${response.status} ${response.statusText}`);
    console.log(`[Response Body]\n${JSON.stringify(data, null, 2)}`);
    console.log(`=================================================================\n`);

    if (!response.ok || data.success === false || data.error) {
      const errMsg = data.error?.message || data.message || data.error || `Fast2SMS Template API returned HTTP ${response.status}: ${responseText}`;
      throw new Error(errMsg);
    }

    return data;
  }

  /**
   * Delete WhatsApp Template on Fast2SMS / Meta WABA Platform
   * Endpoint: DELETE /dev/whatsapp/v24.0/{waba_id}/message_templates?hsm_id={hsm_id}&name={name}
   */
  async deleteWabaTemplateOnFast2SMS({ hsmId, name }) {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured in backend environment.');
    }

    const wabaDetails = await this.getWabaDetails().catch(() => ({ waba_id: '988843927460634' }));
    const wabaId = wabaDetails.waba_id || '988843927460634';

    const queryParams = new URLSearchParams();
    if (hsmId) queryParams.set('hsm_id', String(hsmId));
    if (name) queryParams.set('name', String(name));

    const url = `${this.baseUrl}/whatsapp/v24.0/${wabaId}/message_templates?${queryParams.toString()}`;
    const method = 'DELETE';

    console.log(`\n================ FAST2SMS TEMPLATE DELETE REQUEST ================`);
    console.log(`[HTTP Request] ${method} ${url}`);
    console.log(`[Headers] authorization: ${this.getMaskedKey()}`);

    const response = await fetch(url, {
      method,
      headers: {
        'authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { raw: responseText };
    }

    console.log(`[HTTP Response Status] ${response.status} ${response.statusText}`);
    console.log(`[Response Body]\n${JSON.stringify(data, null, 2)}`);
    console.log(`=================================================================\n`);

    if (!response.ok || data.success === false || data.error) {
      const errMsg = data.error?.message || data.message || data.error || `Fast2SMS Template Delete API returned HTTP ${response.status}: ${responseText}`;
      throw new Error(errMsg);
    }

    return data;
  }
}

module.exports = new Fast2SMSWhatsAppService();
