const mongoose = require('mongoose');
const Wallet = require('../../models/Wallet');
const WalletLedger = require('../../models/WalletLedger');

class WalletService {
  /**
   * Reserves an amount in the wallet.
   */
  async reserveAmount(userId, amount) {
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');
        if (wallet.balancePaise < amount * 100) throw new Error('Insufficient wallet balance');

        wallet.balancePaise -= amount * 100;
        wallet.onHoldPaise = (wallet.onHoldPaise || 0) + amount * 100;
        await wallet.save({ session });
        await session.commitTransaction();
        session.endSession();
        return true;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        if (err.message && (err.message.includes('Transaction numbers') || err.code === 20)) {
          return this._reserveAmountStandalone(userId, amount);
        }
        throw err;
      }
    } catch (e) {
      return this._reserveAmountStandalone(userId, amount);
    }
  }

  async _reserveAmountStandalone(userId, amount) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balancePaise < amount * 100) throw new Error('Insufficient wallet balance');

    wallet.balancePaise -= amount * 100;
    wallet.onHoldPaise = (wallet.onHoldPaise || 0) + amount * 100;
    await wallet.save();
    return true;
  }

  /**
   * Commits the reserved amount (Deduct). Creates Ledger entry.
   */
  async commitReservation(userId, amount, metadata) {
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');

        wallet.onHoldPaise -= amount * 100;
        await wallet.save({ session });

        await WalletLedger.create([{
          userId,
          transactionType: 'DEBIT',
          amount,
          balanceAfter: wallet.balancePaise / 100,
          referenceType: metadata.referenceType,
          referenceId: metadata.referenceId,
          description: metadata.description,
        }], { session });

        await session.commitTransaction();
        session.endSession();
        return true;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        if (err.message && (err.message.includes('Transaction numbers') || err.code === 20)) {
          return this._commitReservationStandalone(userId, amount, metadata);
        }
        throw err;
      }
    } catch (e) {
      return this._commitReservationStandalone(userId, amount, metadata);
    }
  }

  async _commitReservationStandalone(userId, amount, metadata) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.onHoldPaise -= amount * 100;
    await wallet.save();

    await WalletLedger.create({
      userId,
      transactionType: 'DEBIT',
      amount,
      balanceAfter: wallet.balancePaise / 100,
      referenceType: metadata.referenceType,
      referenceId: metadata.referenceId,
      description: metadata.description,
    });
    return true;
  }

  /**
   * Releases the reserved amount back to balance (Refund).
   */
  async releaseReservation(userId, amount, providedSession = null) {
    if (providedSession) {
      const wallet = await Wallet.findOne({ userId }).session(providedSession);
      if (!wallet) throw new Error('Wallet not found');

      wallet.balancePaise += amount * 100;
      wallet.onHoldPaise = Math.max(0, (wallet.onHoldPaise || 0) - amount * 100);
      await wallet.save({ session: providedSession });
      return true;
    }

    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');

        wallet.balancePaise += amount * 100;
        wallet.onHoldPaise = Math.max(0, (wallet.onHoldPaise || 0) - amount * 100);
        await wallet.save({ session });

        await session.commitTransaction();
        session.endSession();
        return true;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        if (err.message && (err.message.includes('Transaction numbers') || err.code === 20)) {
          return this._releaseReservationStandalone(userId, amount);
        }
        throw err;
      }
    } catch (e) {
      return this._releaseReservationStandalone(userId, amount);
    }
  }

  async _releaseReservationStandalone(userId, amount) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.balancePaise += amount * 100;
    wallet.onHoldPaise = Math.max(0, (wallet.onHoldPaise || 0) - amount * 100);
    await wallet.save();
    return true;
  }

  /**
   * Adds balance directly to the wallet and creates a Ledger entry.
   */
  async addBalance(userId, amount, metadata) {
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) throw new Error('Wallet not found');

        wallet.balancePaise += amount * 100;
        await wallet.save({ session });

        await WalletLedger.create([{
          userId,
          transactionType: 'CREDIT',
          amount,
          balanceAfter: wallet.balancePaise / 100,
          referenceType: metadata.referenceType,
          referenceId: metadata.referenceId,
          description: metadata.description,
        }], { session });

        await session.commitTransaction();
        session.endSession();
        return true;
      } catch (err) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        if (err.message && (err.message.includes('Transaction numbers') || err.code === 20)) {
          return this._addBalanceStandalone(userId, amount, metadata);
        }
        throw err;
      }
    } catch (e) {
      return this._addBalanceStandalone(userId, amount, metadata);
    }
  }

  async _addBalanceStandalone(userId, amount, metadata) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.balancePaise += amount * 100;
    await wallet.save();

    await WalletLedger.create({
      userId,
      transactionType: 'CREDIT',
      amount,
      balanceAfter: wallet.balancePaise / 100,
      referenceType: metadata.referenceType,
      referenceId: metadata.referenceId,
      description: metadata.description,
    });
    return true;
  }
}

module.exports = new WalletService();
