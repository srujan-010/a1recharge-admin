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
}

module.exports = new Fast2SMSService();
