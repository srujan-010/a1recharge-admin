class TemplateRenderer {
  /**
   * Render text template by substituting all {{variable}} placeholders with live business context.
   * Ensures missing variables are safely cleaned up and never leaves raw {{placeholders}} in output.
   *
   * @param {String} templateText - Notification title or body string
   * @param {Object} context - Business data variables (user, transaction, wallet info)
   * @returns {String} Fully rendered notification string
   */
  static render(templateText, context = {}) {
    if (!templateText) return '';

    const now = new Date();
    const defaultDate = context.date || now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const defaultTime = context.time || now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Extract retailer name from various potential keys
    const retailerName = context.name || context.retailer || context.fullName || context.userName || 'Retailer';
    const mobileNo = context.mobile || context.number || context.phone || context.mobileNo || '';

    // Enriched variables context with standard aliases and defaults
    const envContext = {
      appName: 'A1 Recharge',
      date: defaultDate,
      time: defaultTime,
      ...context,

      // Retailer Aliases
      name: retailerName,
      retailer: retailerName,
      retailerId: context.retailerId || context.merchantId || '',
      mobile: mobileNo,
      number: mobileNo,
      phone: mobileNo,
      email: context.email || '',

      // Recharge / Transaction Aliases
      amount: context.amount !== undefined && context.amount !== null ? String(context.amount) : '',
      operator: context.operator || context.service || '',
      service: context.service || context.operator || 'Recharge',
      circle: context.circle || '',
      transactionId: context.transactionId || context.orderId || context.txnId || '',
      orderId: context.orderId || context.transactionId || context.txnId || '',
      status: context.status || '',

      // Wallet Aliases
      wallet: context.wallet !== undefined && context.wallet !== null ? String(context.wallet) : (context.balance !== undefined ? String(context.balance) : (context.newBalance !== undefined ? String(context.newBalance) : (context.currentBalance !== undefined ? String(context.currentBalance) : ''))),
      balance: context.balance !== undefined && context.balance !== null ? String(context.balance) : (context.newBalance !== undefined ? String(context.newBalance) : (context.currentBalance !== undefined ? String(context.currentBalance) : '')),
      currentBalance: context.currentBalance !== undefined ? String(context.currentBalance) : (context.balance !== undefined ? String(context.balance) : ''),
      newBalance: context.newBalance !== undefined ? String(context.newBalance) : (context.balance !== undefined ? String(context.balance) : ''),
      commission: context.commission !== undefined && context.commission !== null ? String(context.commission) : (context.amount !== undefined ? String(context.amount) : ''),
      reason: context.reason || '',
      ip: context.ip || 'Unknown',
      device: context.device || 'Device',
    };

    // Regex replace all {{variableName}} patterns
    const rendered = templateText.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const val = envContext[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val);
      }
      // Missing variable: return empty string, NEVER return raw {{key}}
      return '';
    });

    // Clean up double spaces caused by empty variable substitutions
    return rendered.replace(/  +/g, ' ').trim();
  }
}

module.exports = TemplateRenderer;
