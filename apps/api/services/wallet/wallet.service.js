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
      const wallet = await query;
      if (!wallet) throw new Error('Wallet not found');

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
}

module.exports = new WalletService();
