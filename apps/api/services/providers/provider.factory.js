const a1TopupProvider = require('./a1topup/provider.service');

class ProviderFactory {
  /**
   * Returns the provider instance based on providerName
   * @param {string} providerName 
   * @returns {import('./Provider.interface')}
   */
  static getProvider(providerName) {
    // In the future, this can query a DB or config to route dynamically.
    // For now, A1Topup is our primary provider.
    switch (providerName.toLowerCase()) {
      case 'a1topup':
        return a1TopupProvider;
      default:
        throw new Error(`Provider ${providerName} is not supported.`);
    }
  }
}

module.exports = ProviderFactory;
