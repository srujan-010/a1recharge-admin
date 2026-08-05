/**
 * Abstract interface for Provider integrations
 */
class ProviderInterface {
  async health() {
    throw new Error('Not implemented');
  }

  async balance() {
    throw new Error('Not implemented');
  }

  async operators() {
    throw new Error('Not implemented');
  }

  async plans(operatorCode, circleCode) {
    throw new Error('Not implemented');
  }

  async recharge(options) {
    throw new Error('Not implemented');
  }

  async status(providerTransactionId) {
    throw new Error('Not implemented');
  }
}

module.exports = ProviderInterface;
