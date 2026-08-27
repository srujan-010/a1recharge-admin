const axios = require('axios');

class Fast2SMSService {
  constructor() {
    this.walletApiUrl = 'https://www.fast2sms.com/dev/wallet';
    this.cachedWallet = null;
    this.lastSuccessfulUpdate = null;
  }

  /**
   * Helper to mask API key for secure logging
   */
  _maskKey(key) {
    if (!key) return 'N/A';
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
  }

  /**
   * Fetch Fast2SMS Wallet Balance and SMS credits
   * POST https://www.fast2sms.com/dev/wallet
   */
  async getWalletBalance() {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      console.error('[FAST2SMS WALLET ERROR] FAST2SMS_API_KEY is not defined in environment variables.');
      return this._buildFallbackResponse('FAST2SMS_API_KEY is missing on backend server.');
    }

    const headers = {
      'Authorization': apiKey,
      'accept': 'application/json',
    };

    const startTime = Date.now();
    let response = null;
    let attempt = 0;
    const maxAttempts = 2; // Initial attempt + 1 retry

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[FAST2SMS WALLET API REQUEST] Attempt ${attempt}/${maxAttempts} -> POST ${this.walletApiUrl}`);
        console.log(`- Masked Auth Key: ${this._maskKey(apiKey)}`);

        response = await axios.post(
          this.walletApiUrl,
          {},
          {
            headers,
            timeout: 10000, // 10s timeout
          }
        );

        const duration = Date.now() - startTime;
        console.log(`[FAST2SMS WALLET API SUCCESS] HTTP Status: ${response.status} (${duration}ms)`);
        console.log(`- Response Data:`, JSON.stringify(response.data));

        if (response.data && response.data.return === true) {
          const rawWallet = response.data.wallet;
          const rawSmsCount = response.data.sms_count;

          const walletBalance = parseFloat(rawWallet) || 0;
          const smsCount = parseInt(rawSmsCount, 10) || 0;
          const lastUpdated = new Date().toISOString();

          // Save successful response in cache
          this.cachedWallet = {
            walletBalance,
            smsCount,
          };
          this.lastSuccessfulUpdate = lastUpdated;

          return {
            provider: 'Fast2SMS',
            walletBalance,
            smsCount,
            status: 'Connected',
            lastUpdated,
            isCached: false,
            warning: null,
          };
        } else {
          console.warn('[FAST2SMS WALLET WARN] API returned return: false or unexpected body', response.data);
          if (attempt >= maxAttempts) {
            return this._buildFallbackResponse(response.data?.message || 'Unable to fetch latest Fast2SMS balance.');
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`[FAST2SMS WALLET API FAILURE] Attempt ${attempt}/${maxAttempts} (${duration}ms) - Error: ${errorMsg}`);
        
        if (error.response) {
          console.error(`- HTTP Status Code: ${error.response.status}`);
        }

        if (attempt >= maxAttempts) {
          return this._buildFallbackResponse('Unable to fetch latest balance.');
        }

        // Short 500ms delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return this._buildFallbackResponse('Unable to fetch latest balance.');
  }

  /**
   * Helper to build cached fallback or disconnected response
   */
  _buildFallbackResponse(warningMsg) {
    if (this.cachedWallet && this.lastSuccessfulUpdate) {
      console.warn(`[FAST2SMS WALLET FALLBACK] Returning cached wallet balance from ${this.lastSuccessfulUpdate}`);
      return {
        provider: 'Fast2SMS',
        walletBalance: this.cachedWallet.walletBalance,
        smsCount: this.cachedWallet.smsCount,
        status: 'Connected', // Provider stays connected using cached value
        lastUpdated: this.lastSuccessfulUpdate,
        isCached: true,
        warning: warningMsg || 'Unable to fetch latest balance. Displaying cached balance.',
      };
    }

    return {
      provider: 'Fast2SMS',
      walletBalance: 0,
      smsCount: 0,
      status: 'Disconnected',
      lastUpdated: null,
      isCached: false,
      warning: warningMsg || 'Unable to fetch latest balance.',
    };
  }

  /**
   * Send Quick SMS via Fast2SMS API (https://www.fast2sms.com/dev/bulkV2)
   */
  async sendSMS({ phone, message, route = 'q' }) {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      console.error('[FAST2SMS ALERT CONFIG] Missing required configuration: FAST2SMS_API_KEY is not defined.');
      return { success: false, error: 'FAST2SMS_API_KEY is missing on backend server.' };
    }

    let cleanedPhone = String(phone || '').replace(/\D/g, '');
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.substring(2);
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.substring(1);
    }

    if (cleanedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedPhone)) {
      console.error(`[FAST2SMS ALERT ERROR] Invalid 10-digit Indian mobile number: ${phone}`);
      return { success: false, error: `Invalid 10-digit Indian mobile number: ${phone}` };
    }

    const maskedPhone = `********${cleanedPhone.substring(8)}`;
    const maskedKey = this._maskKey(apiKey);

    console.log(`[FAST2SMS ALERT] Preparing low-balance notification`);
    console.log(`Recipient: ${maskedPhone}`);
    console.log(`Channel: SMS`);

    const payload = {
      route: route || 'q',
      message,
      language: 'english',
      flash: 0,
      numbers: cleanedPhone,
    };

    const maxAttempts = 2;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[FAST2SMS ALERT API REQUEST] Attempt ${attempt}/${maxAttempts} -> POST https://www.fast2sms.com/dev/bulkV2`);
        console.log(`- Masked Auth Key: ${maskedKey}`);

        const response = await axios.post(
          'https://www.fast2sms.com/dev/bulkV2',
          payload,
          {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        console.log(`[FAST2SMS ALERT API SUCCESS] HTTP Status: ${response.status}`);
        console.log(`- Response Data:`, JSON.stringify(response.data));

        if (response.data && response.data.return === true) {
          console.log(`[FAST2SMS ALERT] Message accepted successfully`);
          return {
            success: true,
            provider: 'Fast2SMS',
            requestId: response.data.request_id,
            message: Array.isArray(response.data.message) ? response.data.message[0] : (response.data.message || 'Message accepted successfully'),
            data: response.data,
          };
        } else {
          const errorMsg = response.data?.message ? (Array.isArray(response.data.message) ? response.data.message[0] : response.data.message) : 'Fast2SMS API returned return: false';
          console.error(`[FAST2SMS ALERT API REJECTED] Provider returned return: false - ${errorMsg}`);
          if (attempt >= maxAttempts) {
            return {
              success: false,
              provider: 'Fast2SMS',
              error: errorMsg,
              data: response.data,
            };
          }
        }
      } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`[FAST2SMS ALERT API FAILURE] Attempt ${attempt}/${maxAttempts} - Error: ${errorMsg}`);
        
        if (attempt >= maxAttempts) {
          return {
            success: false,
            provider: 'Fast2SMS',
            error: errorMsg,
          };
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      success: false,
      provider: 'Fast2SMS',
      error: 'Unable to send Fast2SMS alert message after retries.',
    };
  }
}

module.exports = new Fast2SMSService();
