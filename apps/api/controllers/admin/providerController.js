const ProviderWallet = require('../../models/ProviderWallet');
const ProviderFactory = require('../../services/providers/provider.factory');
const { logAudit } = require('../../utils/auditHelper');

// @desc    Get all configured providers
// @route   GET /api/admin/providers
// @access  Private (Admin)
const getProviders = async (req, res, next) => {
  try {
    let a1Topup = await ProviderWallet.findOne({ providerName: 'A1Topup' });
    if (!a1Topup) {
      a1Topup = await ProviderWallet.create({ providerName: 'A1Topup', balance: 0, currency: 'INR' });
    }

    let fast2sms = await ProviderWallet.findOne({ providerName: 'Fast2SMS' });
    if (!fast2sms) {
      const fast2smsService = require('../../services/fast2sms.service');
      const liveData = await fast2smsService.getWalletBalance();
      fast2sms = await ProviderWallet.create({
        providerName: 'Fast2SMS',
        balance: liveData.walletBalance || 0,
        currency: 'INR',
        lastCheckedAt: Date.now()
      });
    }

    const providers = await ProviderWallet.find().lean();

    res.status(200).json({
      success: true,
      data: providers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger live API ping to refresh provider balance
// @route   POST /api/admin/providers/:id/refresh-balance
// @access  Private (Super Admin / Finance)
const refreshProviderBalance = async (req, res, next) => {
  try {
    const walletId = req.params.id;
    const wallet = await ProviderWallet.findById(walletId);

    if (!wallet) {
      res.status(404);
      throw new Error('Provider wallet not found');
    }

    const oldBalance = wallet.balance;

    if (wallet.providerName === 'Fast2SMS') {
      const fast2smsService = require('../../services/fast2sms.service');
      const balanceData = await fast2smsService.getWalletBalance();
      
      wallet.balance = balanceData.walletBalance;
      wallet.currency = 'INR';
      wallet.lastCheckedAt = Date.now();
      await wallet.save();
    } else {
      // Ping the live provider API
      const providerService = ProviderFactory.getProvider(wallet.providerName);
      const balanceData = await providerService.balance();
      
      if (!balanceData) {
        res.status(502);
        throw new Error(`Failed to fetch live balance from ${wallet.providerName}`);
      }

      wallet.balance = balanceData.balance;
      wallet.currency = balanceData.currency;
      wallet.lastCheckedAt = Date.now();
      await wallet.save();
    }

    await logAudit(
      req.admin, 
      `SYNC_PROVIDER_BALANCE`, 
      'PROVIDER_WALLET', 
      { providerName: wallet.providerName, balance: oldBalance }, 
      { providerName: wallet.providerName, balance: wallet.balance }, 
      req
    );

    res.status(200).json({
      success: true,
      message: `${wallet.providerName} balance synced successfully.`,
      data: wallet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live balance directly from a Provider's API
// @route   GET /api/admin/provider/balance?providerName=A1Topup
// @access  Private (Admin)
const getProviderBalance = async (req, res, next) => {
  try {
    const providerName = req.query.providerName || 'A1Topup';

    // Get the generic provider service instance (e.g., a1TopupProvider)
    const providerService = ProviderFactory.getProvider(providerName);
    
    // Fetch live balance directly from provider API
    const balanceData = await providerService.balance();

    if (!balanceData || !balanceData.success) {
      return res.status(502).json({
        success: false,
        provider: providerName,
        message: 'Provider is currently unreachable or returned an error.',
        status: 'offline'
      });
    }

    res.status(200).json({
      success: true,
      provider: providerName,
      balance: balanceData.balance,
      currency: balanceData.currency || 'INR',
      lastUpdated: new Date().toISOString(),
      status: 'online'
    });
  } catch (error) {
    console.error(`[ProviderController] getProviderBalance error:`, error.message);
    res.status(502).json({
      success: false,
      provider: req.query.providerName || 'A1Topup',
      message: error.message || 'Failed to fetch provider balance.',
      status: 'offline'
    });
  }
};

// @desc    Test Fast2SMS Low Balance WhatsApp Alert
// @route   POST /api/admin/providers/fast2sms/test-low-balance-alert
// @access  Private (Super Admin / Admin / Finance)
const triggerTestFast2SMSAlert = async (req, res, next) => {
  try {
    const { balance } = req.body;
    const testBalance = balance !== undefined ? parseFloat(balance) : 24.50;
    const fast2SMSWalletMonitorService = require('../../services/fast2SMSWalletMonitor.service');
    const result = await fast2SMSWalletMonitorService.sendTestAlert(testBalance);

    res.status(200).json({
      success: true,
      message: 'Test Fast2SMS WhatsApp low-balance alert dispatched',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProviders,
  refreshProviderBalance,
  getProviderBalance,
  triggerTestFast2SMSAlert,
};
