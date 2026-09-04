const mongoose = require('mongoose');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');

class WalletService {
  /**
   * Helper to parse and validate monetary amounts into integer paise.
   */
  toPaise(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error('Invalid monetary amount');
    }
    return Math.round(num * 100);
  }

  /**
   * Validates wallet invariant rules:
   * 1. Wallet Balance (balancePaise) >= 0
   * 2. Hold Amount (onHoldPaise) >= 0
   * 3. Spendable Balance (balancePaise - onHoldPaise) >= 0
   */
  validateWalletInvariants(wallet) {
    if (!wallet) throw new Error('Wallet not found');
    const balancePaise = Number(wallet.balancePaise || 0);
    const onHoldPaise = Number(wallet.onHoldPaise || 0);

    if (!Number.isFinite(balancePaise) || balancePaise < 0) {
      throw new Error(`Wallet balance invariant error: Wallet balance cannot be negative (${balancePaise})`);
    }
    if (!Number.isFinite(onHoldPaise) || onHoldPaise < 0) {
      throw new Error(`Wallet hold invariant error: Hold amount cannot be negative (${onHoldPaise})`);
    }
    if (balancePaise < onHoldPaise) {
      throw new Error(`Wallet spendable invariant error: Hold amount (${onHoldPaise}) exceeds wallet balance (${balancePaise})`);
    }
    return true;
  }

  /**
   * Reserves an amount for a pending recharge.
   * INCREASES onHoldPaise ONLY.
   * Does NOT modify walletBalance (balancePaise).
   */
  async reserveAmount(userId, amount) {
    const amountPaise = this.toPaise(amount);

    const perform = async (session) => {
      const query = Wallet.findOne({ userId });
      if (session) query.session(session);
      const wallet = await query;
      if (!wallet) throw new Error('Wallet not found');

      const spendablePaise = wallet.balancePaise - (wallet.onHoldPaise || 0);
      if (spendablePaise < amountPaise) {
        throw new Error(`Insufficient spendable wallet balance. Spendable: ₹${(spendablePaise / 100).toFixed(2)}, Required: ₹${(amountPaise / 100).toFixed(2)}`);
      }

      wallet.onHoldPaise = (wallet.onHoldPaise || 0) + amountPaise;

      this.validateWalletInvariants(wallet);
      await wallet.save({ session: session || undefined });
      return true;
    };

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const res = await perform(session);
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return perform(null);
      }
    } catch (e) {
      return perform(null);
    }
  }

  /**
   * Commits a reserved hold upon successful recharge completion.
   * 1. Creates EXACTLY ONE finalized wallet debit (deducts net amount from balancePaise).
   * 2. Decreases hold amount (onHoldPaise).
   * 3. Creates DEBIT entry in WalletLedger.
   */
  async commitReservation(userId, amount, metadata = {}) {
    const grossPaise = this.toPaise(amount);
    const commPaise = metadata.commissionEarnedPaise ? Math.max(0, Math.round(Number(metadata.commissionEarnedPaise))) : 0;
    const netDebitPaise = Math.max(0, grossPaise - commPaise);

    const perform = async (session) => {
      const query = Wallet.findOne({ userId });
      if (session) query.session(session);
      const wallet = await query;
      if (!wallet) throw new Error('Wallet not found');

      const holdDeduct = Math.min(wallet.onHoldPaise || 0, grossPaise);
      wallet.onHoldPaise = Math.max(0, (wallet.onHoldPaise || 0) - holdDeduct);
      wallet.balancePaise = Math.max(0, wallet.balancePaise - netDebitPaise);

      this.validateWalletInvariants(wallet);
      await wallet.save({ session: session || undefined });

      const ledgerData = {
        userId,
        transactionType: 'DEBIT',
        amount: Number((netDebitPaise / 100).toFixed(2)),
        balanceAfter: Number((wallet.balancePaise / 100).toFixed(2)),
        referenceType: metadata.referenceType || 'RECHARGE',
        referenceId: metadata.referenceId,
        description: metadata.description || `Recharge commit for order ${metadata.orderId || ''}`,
      };

      if (session) {
        await WalletLedger.create([ledgerData], { session });
      } else {
        await WalletLedger.create(ledgerData);
      }

      return {
        walletBalancePaise: wallet.balancePaise,
        walletBalance: Number((wallet.balancePaise / 100).toFixed(2)),
        holdAmountPaise: wallet.onHoldPaise || 0,
        holdAmount: Number(((wallet.onHoldPaise || 0) / 100).toFixed(2)),
        spendableBalancePaise: wallet.balancePaise - (wallet.onHoldPaise || 0),
        spendableBalance: Number(((wallet.balancePaise - (wallet.onHoldPaise || 0)) / 100).toFixed(2))
      };
    };

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const res = await perform(session);
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return perform(null);
      }
    } catch (e) {
      return perform(null);
    }
  }

  /**
   * Releases reserved hold upon failed recharge or manual release.
   * DECREASES onHoldPaise ONLY.
   * Does NOT modify wallet balance (balancePaise) or create wallet credit.
   */
  async releaseHoldWithLedger(userId, amount, metadata = {}, providedSession = null) {
    const amountPaise = this.toPaise(amount);

    const perform = async (session) => {
      const query = Wallet.findOne({ userId });
      if (session) query.session(session);
      const wallet = await query;
      if (!wallet) throw new Error('Wallet not found for user');

      if ((wallet.onHoldPaise || 0) <= 0) {
        throw new Error('Hold has already been released.');
      }

      const releasePaise = Math.min(wallet.onHoldPaise || 0, amountPaise);
      if (releasePaise <= 0) {
        throw new Error('Hold amount is 0 or already released.');
      }

      wallet.onHoldPaise = Math.max(0, (wallet.onHoldPaise || 0) - releasePaise);
      // NOTE: balancePaise is UNCHANGED. Zero wallet credit on hold release!

      this.validateWalletInvariants(wallet);

      if (session) {
        await wallet.save({ session });
      } else {
        await wallet.save();
      }

      return {
        walletBalancePaise: wallet.balancePaise,
        walletBalance: Number((wallet.balancePaise / 100).toFixed(2)),
        holdAmountPaise: wallet.onHoldPaise || 0,
        holdAmount: Number(((wallet.onHoldPaise || 0) / 100).toFixed(2)),
        spendableBalancePaise: wallet.balancePaise - (wallet.onHoldPaise || 0),
        spendableBalance: Number(((wallet.balancePaise - (wallet.onHoldPaise || 0)) / 100).toFixed(2))
      };
    };

    if (providedSession) return perform(providedSession);

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const res = await perform(session);
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return perform(null);
      }
    } catch (e) {
      return perform(null);
    }
  }

  /**
   * Alias for releaseHoldWithLedger.
   */
  async releaseReservation(userId, amount, providedSession = null) {
    return this.releaseHoldWithLedger(userId, amount, {}, providedSession);
  }

  /**
   * Adds balance directly to wallet (e.g. Verified UPI Top-up or Admin Credit).
   * INCREASES balancePaise (Real wallet credit!).
   */
  async addBalance(userId, amount, metadata = {}) {
    const amountPaise = this.toPaise(amount);

    const perform = async (session) => {
      const query = Wallet.findOne({ userId });
      if (session) query.session(session);
      let wallet = await query;
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balancePaise: 0,
          onHoldPaise: 0
        });
      }

      wallet.balancePaise += amountPaise;

      this.validateWalletInvariants(wallet);
      await wallet.save({ session: session || undefined });

      const ledgerData = {
        userId,
        transactionType: 'CREDIT',
        amount: Number((amountPaise / 100).toFixed(2)),
        balanceAfter: Number((wallet.balancePaise / 100).toFixed(2)),
        referenceType: metadata.referenceType || 'ADD_MONEY',
        referenceId: metadata.referenceId,
        description: metadata.description || 'Wallet credit',
      };

      if (session) {
        await WalletLedger.create([ledgerData], { session });
      } else {
        await WalletLedger.create(ledgerData);
      }

      return {
        walletBalancePaise: wallet.balancePaise,
        walletBalance: Number((wallet.balancePaise / 100).toFixed(2)),
        holdAmountPaise: wallet.onHoldPaise || 0,
        holdAmount: Number(((wallet.onHoldPaise || 0) / 100).toFixed(2)),
        spendableBalancePaise: wallet.balancePaise - (wallet.onHoldPaise || 0),
        spendableBalance: Number(((wallet.balancePaise - (wallet.onHoldPaise || 0)) / 100).toFixed(2))
      };
    };

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const res = await perform(session);
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return perform(null);
      }
    } catch (e) {
      return perform(null);
    }
  }

  /**
   * Idempotent process for successful retailer wallet top-up (UPI / Razorpay / Gateway).
   * Ensures:
   * 1. Idempotency: Payment ID / Reference ID check. If already processed & successful, returns existing record.
   * 2. Atomic Wallet Credit: Increases balancePaise (Real wallet credit!), onHoldPaise is UNCHANGED.
   * 3. Wallet Ledger: Creates CREDIT entry in WalletLedger (referenceType: 'ADD_MONEY').
   * 4. Global Transaction: Creates/updates Transaction record (service: 'wallet_topup', paymentMethod: 'UPI', paymentStatus: 'RAZORPAY_UPI').
   */
  async processSuccessfulWalletTopup({
    userId,
    amountPaise,
    referenceId,
    paymentMethod = 'UPI',
    paymentStatus = 'RAZORPAY_UPI',
    description,
    upiDetails = {},
    isTest = false
  }) {
    if (!userId) {
      throw new Error('User ID is required for wallet top-up');
    }

    const numericAmountPaise = Number(amountPaise);
    if (!Number.isFinite(numericAmountPaise) || numericAmountPaise <= 0) {
      throw new Error('Valid positive monetary amount in paise is required');
    }

    const refId = referenceId || upiDetails.gatewayPaymentId || upiDetails.gatewayOrderId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const { normalizePaymentType } = require('../../utils/paymentHelper');
    const Transaction = require('../../models/Transaction');
    const WalletLedger = require('../../models/WalletLedger');
    const User = require('../../models/User');
    const Notification = require('../../models/Notification');

    const canonicalPaymentMethod = normalizePaymentType(paymentMethod) || 'UPI';
    const canonicalPaymentStatus = paymentStatus || 'RAZORPAY_UPI';

    // 1. IDEMPOTENCY CHECK
    // Check if a successful top-up transaction already exists for this reference or gateway payment/order ID
    const searchConditions = [{ referenceId: refId }];
    if (upiDetails.gatewayPaymentId) {
      searchConditions.push({ 'upiDetails.gatewayPaymentId': upiDetails.gatewayPaymentId });
    }
    if (upiDetails.gatewayOrderId) {
      searchConditions.push({ 'upiDetails.gatewayOrderId': upiDetails.gatewayOrderId });
    }

    const existingTxn = await Transaction.findOne({
      userId,
      service: 'wallet_topup',
      $or: searchConditions
    });

    if (existingTxn && existingTxn.status === 'success') {
      const currentWallet = await Wallet.findOne({ userId });
      return {
        alreadyProcessed: true,
        success: true,
        message: 'Wallet top-up already processed',
        walletBalancePaise: currentWallet ? currentWallet.balancePaise : existingTxn.closingBalancePaise,
        transaction: existingTxn
      };
    }

    const topupDescription = description || `Wallet Top-up via ${canonicalPaymentMethod}`;
    const amountRupees = numericAmountPaise / 100;

    // Check if WalletLedger already exists (i.e. wallet balance was credited, but Transaction record was missing)
    const ledgerSearch = [{ referenceId: refId }];
    if (upiDetails.gatewayOrderId) ledgerSearch.push({ referenceId: upiDetails.gatewayOrderId });
    if (upiDetails.gatewayPaymentId) ledgerSearch.push({ referenceId: upiDetails.gatewayPaymentId });

    const existingLedger = await WalletLedger.findOne({
      userId,
      referenceType: { $in: ['ADD_MONEY', 'RAZORPAY_WALLET_CREDIT', 'MANUAL'] },
      $or: ledgerSearch
    });

    let walletResult;
    if (existingLedger) {
      // Wallet was ALREADY credited! Do NOT credit again!
      console.log(`[WALLET SERVICE] Ledger entry already exists for ${refId}. Skipping duplicate wallet balance increment.`);
      const currentWallet = await Wallet.findOne({ userId });
      const ledgerBalanceAfterPaise = existingLedger.balanceAfterPaise || (existingLedger.balanceAfter ? Math.round(existingLedger.balanceAfter * 100) : (currentWallet ? currentWallet.balancePaise : 0));
      walletResult = {
        wallet: currentWallet,
        walletBalancePaise: currentWallet ? currentWallet.balancePaise : ledgerBalanceAfterPaise,
        ledger: existingLedger
      };
    } else {
      // 2. ATOMIC WALLET BALANCE UPDATE & WALLET LEDGER ENTRY
      walletResult = await this.addBalance(userId, amountRupees, {
        referenceType: 'ADD_MONEY',
        referenceId: refId,
        description: topupDescription,
      });
    }

    const user = await User.findById(userId).select('accountType').lean();
    const rawAcc = (user && user.accountType) ? user.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    let transactionDoc;
    if (existingTxn) {
      existingTxn.status = 'success';
      existingTxn.amountPaise = numericAmountPaise;
      existingTxn.closingBalancePaise = walletResult.walletBalancePaise;
      existingTxn.paymentMethod = canonicalPaymentMethod;
      existingTxn.paymentStatus = canonicalPaymentStatus;
      existingTxn.source = 'RAZORPAY';
      existingTxn.transactionType = 'WALLET_TOPUP_UPI';
      existingTxn.description = topupDescription;
      existingTxn.upiDetails = {
        utr: upiDetails.utr || upiDetails.upiTransactionId || existingTxn.upiDetails?.utr || null,
        gateway: upiDetails.gateway || existingTxn.upiDetails?.gateway || 'Razorpay UPI',
        gatewayOrderId: upiDetails.gatewayOrderId || existingTxn.upiDetails?.gatewayOrderId || null,
        gatewayPaymentId: upiDetails.gatewayPaymentId || existingTxn.upiDetails?.gatewayPaymentId || null,
      };
      existingTxn.isTest = isTest || false;
      transactionDoc = await existingTxn.save();
    } else {
      transactionDoc = await Transaction.create({
        userId,
        accountType: userAccountType,
        type: 'credit',
        amountPaise: numericAmountPaise,
        status: 'success',
        service: 'wallet_topup',
        transactionType: 'WALLET_TOPUP_UPI',
        source: 'RAZORPAY',
        referenceId: refId,
        description: topupDescription,
        closingBalancePaise: walletResult.walletBalancePaise,
        paymentMethod: canonicalPaymentMethod,
        paymentStatus: canonicalPaymentStatus,
        upiDetails: {
          utr: upiDetails.utr || upiDetails.upiTransactionId || null,
          gateway: upiDetails.gateway || 'Razorpay UPI',
          gatewayOrderId: upiDetails.gatewayOrderId || null,
          gatewayPaymentId: upiDetails.gatewayPaymentId || null,
        },
        isTest: isTest || false
      });
    }

    // 4. NOTIFICATION
    try {
      await Notification.create({
        userId,
        title: 'Wallet Credited 💳',
        message: `₹${amountRupees.toFixed(2)} has been added to your wallet via ${canonicalPaymentMethod}. New Balance: ₹${(walletResult.walletBalancePaise / 100).toFixed(2)}.`,
        category: 'SUCCESS',
        priority: 'NORMAL',
        action: 'ROUTE_WALLET'
      });
    } catch (notifErr) {
      console.warn('[WalletService] Notification creation non-critical error:', notifErr.message);
    }

    return {
      alreadyProcessed: false,
      success: true,
      message: 'Wallet top-up processed successfully',
      walletBalancePaise: walletResult.walletBalancePaise,
      transaction: transactionDoc
    };
  }

  /**
   * Performs a legitimate refund for a completed, debited recharge.
   * INCREASES balancePaise and creates a REFUND ledger entry.
   */
  async refundRecharge(userId, amount, metadata = {}, providedSession = null) {
    const amountPaise = this.toPaise(amount);

    const perform = async (session) => {
      const query = Wallet.findOne({ userId });
      if (session) query.session(session);
      const wallet = await query;
      if (!wallet) throw new Error('Wallet not found for user');

      wallet.balancePaise += amountPaise;

      this.validateWalletInvariants(wallet);

      const ledgerData = {
        userId,
        transactionType: 'CREDIT',
        amount: Number((amountPaise / 100).toFixed(2)),
        balanceAfter: Number((wallet.balancePaise / 100).toFixed(2)),
        referenceType: 'REFUND',
        referenceId: metadata.referenceId,
        description: metadata.description || `Refund for order ${metadata.orderId || ''}`,
      };

      if (session) {
        await wallet.save({ session });
        await WalletLedger.create([ledgerData], { session });
      } else {
        await wallet.save();
        await WalletLedger.create(ledgerData);
      }

      return {
        walletBalancePaise: wallet.balancePaise,
        walletBalance: Number((wallet.balancePaise / 100).toFixed(2)),
        holdAmountPaise: wallet.onHoldPaise || 0,
        holdAmount: Number(((wallet.onHoldPaise || 0) / 100).toFixed(2)),
        spendableBalancePaise: wallet.balancePaise - (wallet.onHoldPaise || 0),
        spendableBalance: Number(((wallet.balancePaise - (wallet.onHoldPaise || 0)) / 100).toFixed(2))
      };
    };

    if (providedSession) return perform(providedSession);

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const res = await perform(session);
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return perform(null);
      }
    } catch (e) {
      return perform(null);
    }
  }

  /**
   * Records a failed wallet top-up attempt in Transaction history.
   * DOES NOT modify wallet balance or create a ledger credit.
   */
  async processFailedWalletTopup({
    userId,
    amountPaise,
    referenceId,
    paymentMethod = 'UPI',
    paymentStatus = 'FAILED',
    failureReason = 'Payment failed or cancelled',
    description,
    upiDetails = {},
  }) {
    const { normalizePaymentType } = require('../../utils/paymentHelper');
    const Transaction = require('../../models/Transaction');
    const User = require('../../models/User');

    const canonicalPaymentMethod = normalizePaymentType(paymentMethod) || 'UPI';
    const refId = referenceId || upiDetails.gatewayPaymentId || upiDetails.gatewayOrderId || `TXN_FAIL_${Date.now()}`;

    const currentWallet = await Wallet.findOne({ userId });
    const user = await User.findById(userId).select('accountType').lean();
    const rawAcc = (user && user.accountType) ? user.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    let existingTxn = await Transaction.findOne({
      userId,
      service: 'wallet_topup',
      referenceId: refId
    });

    if (existingTxn) {
      existingTxn.status = 'failed';
      existingTxn.failureReason = failureReason;
      existingTxn.paymentStatus = paymentStatus;
      await existingTxn.save();
      return { success: true, transaction: existingTxn };
    }

    const newTxn = await Transaction.create({
      userId,
      accountType: userAccountType,
      type: 'credit',
      amountPaise: Number(amountPaise || 0),
      status: 'failed',
      failureReason,
      service: 'wallet_topup',
      referenceId: refId,
      description: description || `Failed Wallet Top-up via ${canonicalPaymentMethod}`,
      closingBalancePaise: currentWallet ? currentWallet.balancePaise : 0,
      paymentMethod: canonicalPaymentMethod,
      paymentStatus,
      upiDetails: {
        utr: upiDetails.utr || null,
        gateway: upiDetails.gateway || 'Razorpay UPI',
        gatewayOrderId: upiDetails.gatewayOrderId || null,
        gatewayPaymentId: upiDetails.gatewayPaymentId || null,
      }
    });

    return { success: true, transaction: newTxn };
  }

  /**
   * Records a pending wallet top-up order in Transaction history.
   * DOES NOT modify wallet balance or create a ledger credit.
   */
  async processPendingWalletTopup({
    userId,
    amountPaise,
    referenceId,
    paymentMethod = 'UPI',
    paymentStatus = 'PENDING',
    description,
    upiDetails = {},
  }) {
    const { normalizePaymentType } = require('../../utils/paymentHelper');
    const Transaction = require('../../models/Transaction');
    const User = require('../../models/User');

    const canonicalPaymentMethod = normalizePaymentType(paymentMethod) || 'UPI';
    const refId = referenceId || upiDetails.gatewayOrderId || `TXN_PEND_${Date.now()}`;

    const currentWallet = await Wallet.findOne({ userId });
    const user = await User.findById(userId).select('accountType').lean();
    const rawAcc = (user && user.accountType) ? user.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    let existingTxn = await Transaction.findOne({
      userId,
      service: 'wallet_topup',
      referenceId: refId
    });

    if (existingTxn) {
      return { success: true, transaction: existingTxn };
    }

    const newTxn = await Transaction.create({
      userId,
      accountType: userAccountType,
      type: 'credit',
      amountPaise: Number(amountPaise || 0),
      status: 'pending',
      service: 'wallet_topup',
      referenceId: refId,
      description: description || `Pending Wallet Top-up Order`,
      closingBalancePaise: currentWallet ? currentWallet.balancePaise : 0,
      paymentMethod: canonicalPaymentMethod,
      paymentStatus,
      upiDetails: {
        utr: upiDetails.utr || null,
        gateway: upiDetails.gateway || 'Razorpay UPI',
        gatewayOrderId: upiDetails.gatewayOrderId || null,
        gatewayPaymentId: upiDetails.gatewayPaymentId || null,
      }
    });

    return { success: true, transaction: newTxn };
  }

  /**
   * Process Admin Manual Credit or Debit atomically with proper ledger and transaction records.
   */
  async processManualAdjustment({
    userId,
    adminId,
    type = 'CREDIT', // 'CREDIT' or 'DEBIT'
    amountPaise,
    remark,
    description
  }) {
    const numericPaise = Number(amountPaise);
    if (!Number.isFinite(numericPaise) || numericPaise <= 0) {
      throw new Error('Valid positive amountPaise is required for manual adjustment');
    }
    const amountRupees = numericPaise / 100;
    const isCredit = type.toUpperCase() === 'CREDIT';
    const refId = `MANUAL_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const Transaction = require('../../models/Transaction');
    const User = require('../../models/User');

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balancePaise: 0, onHoldPaise: 0 });
    }

    if (isCredit) {
      wallet.balancePaise += numericPaise;
    } else {
      if (wallet.balancePaise < numericPaise) {
        throw new Error(`Insufficient wallet balance for manual debit. Current: ₹${(wallet.balancePaise/100).toFixed(2)}, Requested Debit: ₹${amountRupees.toFixed(2)}`);
      }
      wallet.balancePaise -= numericPaise;
    }

    this.validateWalletInvariants(wallet);
    await wallet.save();

    const ledger = await WalletLedger.create({
      userId,
      adminId: adminId || null,
      transactionType: isCredit ? 'CREDIT' : 'DEBIT',
      amount: amountRupees,
      balanceAfter: Number((wallet.balancePaise / 100).toFixed(2)),
      referenceType: 'MANUAL',
      referenceId: refId,
      remark: remark || (isCredit ? 'ADMIN_MANUAL_CREDIT' : 'ADMIN_MANUAL_DEBIT'),
      description: description || `Manual ${isCredit ? 'Credit' : 'Debit'} by Admin`
    });

    const user = await User.findById(userId).select('accountType').lean();
    const rawAcc = (user && user.accountType) ? user.accountType.toUpperCase() : 'BUSINESS';
    const userAccountType = ['PERSONAL', 'BUSINESS'].includes(rawAcc) ? rawAcc : 'BUSINESS';

    const txn = await Transaction.create({
      userId,
      accountType: userAccountType,
      type: isCredit ? 'credit' : 'debit',
      amountPaise: numericPaise,
      status: 'success',
      service: isCredit ? 'manual_credit' : 'manual_debit',
      referenceId: refId,
      description: description || `Manual ${isCredit ? 'Credit' : 'Debit'} by Admin`,
      closingBalancePaise: wallet.balancePaise,
      paymentMethod: isCredit ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      paymentStatus: 'SUCCESS'
    });

    return {
      success: true,
      walletBalancePaise: wallet.balancePaise,
      ledger,
      transaction: txn
    };
  }
}

module.exports = new WalletService();

