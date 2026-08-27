const ProviderFactory = require('../services/providers/provider.factory');
const NotificationService = require('../services/notification.service');

const ProviderWallet = require('../models/ProviderWallet');
const ProviderOperator = require('../models/ProviderOperator');
const ProviderCircle = require('../models/ProviderCircle');
const mongoose = require('mongoose');

// @desc    Check health of the A1 Topup provider
// @route   GET /api/provider/a1topup/health
// @access  Private (Admin only)
const checkProviderHealth = async (req, res, next) => {
  try {
    const provider = ProviderFactory.getProvider('A1Topup');
    const healthStatus = await provider.health();
    
    if (!healthStatus.success) {
      res.status(503);
      throw new Error(`Provider Health Check Failed: ${healthStatus.message}`);
    }

    res.status(200).json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check and update balance of the A1 Topup provider
// @route   GET /api/provider/a1topup/balance
// @access  Private (Admin only)
const checkProviderBalance = async (req, res, next) => {
  try {
    const provider = ProviderFactory.getProvider('A1Topup');
    const balanceData = await provider.balance();
    
    // Update Provider Wallet in DB
    let wallet = await ProviderWallet.findOne({ providerName: 'A1Topup' });
    if (!wallet) {
      wallet = new ProviderWallet({ providerName: 'A1Topup' });
    }
    
    wallet.balance = balanceData.balance;
    wallet.currency = balanceData.currency;
    wallet.lastCheckedAt = Date.now();
    await wallet.save();

    res.status(200).json({
      success: true,
      data: {
        providerName: wallet.providerName,
        balance: wallet.balance,
        currency: wallet.currency,
        lastCheckedAt: wallet.lastCheckedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch supported operators from provider
// @route   GET /api/provider/a1topup/operators
// @access  Private (Admin only)
const getOperators = async (req, res, next) => {
  try {
    const provider = ProviderFactory.getProvider('A1Topup');
    const operatorsData = await provider.operators();
    res.status(200).json(operatorsData);
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch plans from provider
// @route   GET /api/provider/a1topup/plans
// @access  Private (Admin only)
const getPlans = async (req, res, next) => {
  try {
    const { operator, circle } = req.query;
    if (!operator || !circle) {
      res.status(400);
      throw new Error('Operator and circle are required to fetch plans');
    }
    const provider = ProviderFactory.getProvider('A1Topup');
    const plansData = await provider.plans(operator, circle);
    res.status(200).json(plansData);
  } catch (error) {
    next(error);
  }
};

const RechargeTransaction = require('../models/RechargeTransaction');
const Transaction = require('../models/Transaction');
const CommissionHistory = require('../models/CommissionHistory');
const walletService = require('../services/wallet/wallet.service');
const commissionService = require('../services/commission/commission.service');
const ledgerService = require('../services/ledger/ledger.service');
const { logAudit } = require('../utils/auditHelper');

// @desc    Execute a recharge transaction
// @route   POST /api/recharge/mobile
// @access  Private (Retailer)
const executeRecharge = async (req, res, next) => {
  let orderId;
  let amountForRollback = 0;
  let walletReserved = false;
  let transactionDoc = null;
  let globalTransactionDoc = null;

  try {
    let { mobileNumber, amount, operatorId, circleId, amountPaise, mpin, paymentMode = 'wallet' } = req.body;
    const userId = req.user._id;

    if (amountPaise && !amount) {
      amount = amountPaise / 100;
    }

    // Preserve client-provided Order ID (e.g. TXN1785683307071) if sent in request, otherwise generate one
    orderId = req.body.orderId || req.body.referenceId || req.body.client_id || req.body.transactionId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    console.log(`[Recharge Log Stage 1] Request Received | OrderID: ${orderId} | Phone: ${mobileNumber} | Amount: ₹${amount}`);

    // Create Initial Transaction Documents BEFORE any checks/provider calls
    transactionDoc = await RechargeTransaction.create({
      orderId,
      userId,
      accountType: req.user?.accountType || 'PERSONAL',
      providerName: 'A1Topup',
      mobileNumber: mobileNumber || '0000000000',
      amount: amount || 0,
      operatorCode: 'UNKNOWN',
      circleCode: 'UNKNOWN',
      status: 'PENDING',
      reservedAmount: amount || 0,
    });

    globalTransactionDoc = await Transaction.create({
      userId,
      type: 'debit',
      amountPaise: (amount || 0) * 100,
      status: 'pending',
      service: 'mobile_recharge',
      referenceId: orderId,
      description: `Recharge for ${mobileNumber || 'N/A'}`,
      recipientName: mobileNumber || '',
      mobileNumber: mobileNumber || '',
      operatorName: 'Unknown',
      paymentMethod: paymentMode,
    });

    console.log(`[Recharge Log Stage 2] Transaction Documents Created | OrderID: ${orderId}`);

    // Helper for validation failures to persist FAILED status before returning
    const handleEarlyFailure = async (errorMessage, stepName) => {
      console.error(`[Recharge Early Failure - ${stepName}] ${errorMessage} | OrderID: ${orderId}`);
      if (transactionDoc) {
        transactionDoc.status = 'FAILED';
        transactionDoc.failureReason = errorMessage;
        await transactionDoc.save().catch(e => console.error(e));
      }
      if (globalTransactionDoc) {
        globalTransactionDoc.status = 'failed';
        globalTransactionDoc.failureReason = errorMessage;
        await globalTransactionDoc.save().catch(e => console.error(e));
      }
      await logAudit(
        req.user,
        'RECHARGE_FAILED',
        'RECHARGE',
        null,
        { orderId, mobileNumber, amount, status: 'FAILED', reason: errorMessage },
        req,
        transactionDoc?._id
      ).catch(e => console.error(e));

      return res.status(400).json({
        success: false,
        step: stepName,
        error: errorMessage,
        message: errorMessage,
        data: {
          transactionId: orderId,
          referenceId: orderId,
          status: 'failed',
          amountPaise: (amount || 0) * 100,
          failureReason: errorMessage,
          mobileNumber: mobileNumber || '',
          timestamp: transactionDoc?.createdAt || new Date()
        }
      });
    };

    // Early Payload Validation
    if (!mobileNumber || !amount || !operatorId) {
      return await handleEarlyFailure("Missing required fields: mobileNumber, amount, or operatorId", "Payload Validation");
    }

    if (amount <= 0) {
      return await handleEarlyFailure("Invalid recharge amount", "Amount Validation");
    }

    // MPIN Validation
    if (paymentMode === 'wallet') {
      if (!mpin) {
        return await handleEarlyFailure("Missing MPIN", "MPIN Validation");
      }
      try {
        const isMatch = await req.user.matchMpin(mpin);
        if (!isMatch) {
          return await handleEarlyFailure("Invalid MPIN", "MPIN Validation");
        }
      } catch (mpinErr) {
        return await handleEarlyFailure(mpinErr.message || "MPIN Validation Failed", "MPIN Validation");
      }
    }

    // Resolve Provider Operator
    let operator;
    if (mongoose.Types.ObjectId.isValid(operatorId)) {
      operator = await ProviderOperator.findById(operatorId);
    } else {
      const legacyMap = { 'jio': 'RC', 'airtel': 'A', 'vi': 'V', 'bsnl': 'BT', 'dth_tata': 'TTV', 'dth_airtel': 'ATV', 'dth_dish': 'DTV' };
      const mappedCode = legacyMap[operatorId.toLowerCase()] || 'RC';
      operator = await ProviderOperator.findOne({ code: mappedCode, provider: 'A1Topup' });
    }

    if (!operator || !operator.status) {
      return await handleEarlyFailure(!operator ? "Invalid operator" : "Operator is currently disabled", "Operator Validation");
    }

    // Resolve Provider Circle
    let circle;
    if (circleId && mongoose.Types.ObjectId.isValid(circleId)) {
      circle = await ProviderCircle.findById(circleId);
    } else {
      circle = await ProviderCircle.findOne({ code: '4', provider: 'A1Topup' });
      if (!circle) circle = await ProviderCircle.findOne({ status: true });
    }

    if (!circle || !circle.status) {
      return await handleEarlyFailure(!circle ? "Invalid circle" : "Circle is currently disabled", "Circle Validation");
    }

    let operatorCode = operator.code;
    const circleCode = circle.code;

    // Update documents with resolved operator details
    transactionDoc.operatorCode = operatorCode;
    transactionDoc.circleCode = circleCode;
    transactionDoc.providerName = operator.provider || 'A1Topup';
    await transactionDoc.save();

    globalTransactionDoc.operatorName = operator.name;
    globalTransactionDoc.description = `Recharge for ${mobileNumber} - ${operator.name}`;
    await globalTransactionDoc.save();

    // Dynamic BSNL Routing
    if (operator.name.toUpperCase() === 'BSNL') {
      const PlanCache = require('../models/PlanCache');
      const cache = await PlanCache.findOne({ operatorId: operator._id, circleId: circle._id }).sort({ createdAt: -1 });
      if (cache && cache.plans) {
        const plan = cache.plans.find(p => Number(p.amount) === Number(amount));
        if (plan) {
           const category = (plan.category || '').toLowerCase();
           operatorCode = (category.includes('top up') || category.includes('talktime')) ? 'BT' : 'BR';
        } else {
           operatorCode = 'BR';
        }
      } else {
         operatorCode = 'BR';
      }
      transactionDoc.operatorCode = operatorCode;
      await transactionDoc.save();
    }

    // Reserve Wallet Balance
    amountForRollback = amount;
    try {
      await walletService.reserveAmount(userId, amount);
      walletReserved = true;
      console.log(`[Recharge Log Stage 3] Wallet Reserved | Amount: ₹${amount}`);
    } catch (walletErr) {
      return await handleEarlyFailure(walletErr.message || 'Insufficient wallet balance', "Wallet Reservation");
    }

    // Call Provider API
    const providerName = operator.provider || 'A1Topup';
    const provider = ProviderFactory.getProvider(providerName);
    console.log(`[Recharge Log Stage 4] Calling Provider ${providerName} for Order ${orderId}...`);

    let providerResponse;
    try {
      providerResponse = await provider.recharge({
        orderId,
        mobileNumber,
        amount,
        operatorCode,
        circleCode,
      });
    } catch (providerError) {
      console.error(`[Recharge Log Stage 4 Exception] Provider Call Error: ${providerError.message}`);
      providerResponse = {
        status: 'FAILED',
        providerTransactionId: null,
        operatorReference: null,
        message: providerError.message || 'Provider API error / timeout'
      };
    }

    // Update Transaction with Provider Response
    console.log(`[Recharge Log Stage 5] Provider Response Received:`, providerResponse);
    transactionDoc.providerTransactionId = providerResponse.providerTransactionId || null;
    transactionDoc.operatorReference = providerResponse.operatorReference || null;
    transactionDoc.providerResponse = providerResponse;

    const finalStatus = providerResponse.status || 'FAILED';
    transactionDoc.status = finalStatus;

    if (finalStatus === 'SUCCESS') {
      // Deduct Wallet & Log Ledger
      await walletService.commitReservation(userId, amount, {
        referenceType: 'RECHARGE',
        referenceId: transactionDoc._id,
        description: `Recharge for ${mobileNumber} - Order ID: ${orderId}`,
      });

      const userAccountType = req.user?.accountType || 'PERSONAL';
      transactionDoc.accountType = userAccountType;

      // Idempotency Check: Verify if commission was already calculated for this transaction
      const existingComm = await CommissionHistory.findOne({ transactionId: transactionDoc._id });
      let commission;
      if (!existingComm) {
        commission = await commissionService.calculateCommission(
          operatorCode,
          amount,
          operator.name,
          operator.type === 'dth' ? 'dth' : 'mobile',
          userAccountType,
          userId
        );

        if (commission.retailerCommissionAmount > 0) {
          await walletService.addBalance(userId, commission.retailerCommissionAmount, {
            referenceType: 'COMMISSION',
            referenceId: transactionDoc._id,
            description: `Commission for Recharge ${orderId}`,
          });
          
          await Transaction.create({
            userId,
            accountType: userAccountType,
            type: 'credit',
            amountPaise: commission.retailerCommissionAmount * 100,
            status: 'success',
            service: 'commission',
            referenceId: `COM${Date.now()}${Math.floor(Math.random() * 1000)}`,
            description: `Commission for Recharge ${orderId}`,
            apiReference: transactionDoc._id.toString(),
            paymentMethod: 'wallet',
            operatorName: operator.name,
          });
        }

        await CommissionHistory.create({
          transactionId: transactionDoc._id,
          userId,
          accountType: userAccountType,
          operatorCode,
          rechargeAmount: amount,
          providerCommissionPercentage: commission.providerCommissionPercentage,
          providerCommissionAmount: commission.providerCommissionAmount,
          retailerCommissionPercentage: commission.retailerCommissionPercentage,
          retailerCommissionAmount: commission.retailerCommissionAmount,
          companyProfitPercentage: commission.companyProfitPercentage,
          companyProfitAmount: commission.companyProfitAmount,
        });
      } else {
        commission = {
          retailerCommissionAmount: existingComm.retailerCommissionAmount
        };
      }

      transactionDoc.commissionCalculated = true;
      globalTransactionDoc.status = 'success';
      globalTransactionDoc.accountType = userAccountType;
      globalTransactionDoc.apiReference = providerResponse.providerTransactionId;
      globalTransactionDoc.commissionEarnedPaise = (commission.retailerCommissionAmount || 0) * 100;
      
      console.log(`[Recharge Log Stage 6] Transaction SUCCESS | Order: ${orderId} | AccountType: ${userAccountType}`);

    } else if (finalStatus === 'FAILED' || finalStatus === 'TIMEOUT') {
      // Release Wallet Reservation
      console.log(`[Recharge Log Stage 7] Executing Wallet Release for Failed/Timeout Recharge | Order: ${orderId}`);
      await walletService.releaseReservation(userId, amount);
      
      transactionDoc.failureReason = providerResponse.message || 'Provider recharge failed';
      globalTransactionDoc.status = finalStatus === 'TIMEOUT' ? 'timeout' : 'failed';
      globalTransactionDoc.failureReason = providerResponse.message || 'Provider recharge failed';
      globalTransactionDoc.apiReference = providerResponse.providerTransactionId || null;

      console.log(`[Recharge Log Stage 6/7] Transaction ${finalStatus} | Reason: ${transactionDoc.failureReason}`);

    } else if (finalStatus === 'PENDING') {
      globalTransactionDoc.status = 'pending';
      globalTransactionDoc.apiReference = providerResponse.providerTransactionId;
      console.log(`[Recharge Log Stage 6] Transaction PENDING | Order: ${orderId}`);
    }

    // Save both documents
    await transactionDoc.save();
    await globalTransactionDoc.save();

    // Log Audit Entry
    await logAudit(
      req.user,
      finalStatus === 'SUCCESS' ? 'RECHARGE_EXECUTED' : 'RECHARGE_FAILED',
      'RECHARGE',
      null,
      {
        orderId,
        mobileNumber,
        operator: operator.name,
        amount,
        status: finalStatus,
        providerTransactionId: providerResponse.providerTransactionId,
        failureReason: finalStatus !== 'SUCCESS' ? providerResponse.message : null
      },
      req,
      transactionDoc._id
    ).catch(e => console.error(e));

    // Dispatch Notifications
    if (finalStatus === 'SUCCESS') {
      NotificationService.sendRechargeSuccess({
        userId,
        transactionId: transactionDoc.orderId,
        orderId,
        service: 'mobile_recharge',
        operator: operator.name,
        amount,
        number: mobileNumber
      });
      NotificationService.sendWalletDebited({
        userId,
        amount,
        reason: `Recharge: ${operator.name} (${mobileNumber})`
      });

      // Background Provider Low-Balance Automation (Non-blocking)
      const providerAutomationService = require('../services/providerAutomation.service');
      setImmediate(() => {
        providerAutomationService.checkAndTriggerLowBalanceAlert(transactionDoc).catch(err => {
          console.error('[RechargeController] Low balance automation error:', err.message);
        });
      });
    } else if (finalStatus === 'FAILED' || finalStatus === 'TIMEOUT') {
      NotificationService.sendRechargeFailed({
        userId,
        transactionId: transactionDoc.orderId,
        operator: operator.name,
        amount,
        reason: providerResponse.message
      });
    }

    // Return API Response
    if (finalStatus === 'SUCCESS' || finalStatus === 'PENDING') {
      const isPending = finalStatus === 'PENDING';
      return res.status(200).json({
        success: true,
        message: isPending ? 'Recharge pending verification' : 'Recharge successful',
        data: {
          transactionId: transactionDoc.orderId,
          referenceId: transactionDoc.orderId,
          operatorRef: transactionDoc.operatorReference || transactionDoc.providerTransactionId || 'Processing...',
          status: isPending ? 'pending' : 'success',
          amountPaise: transactionDoc.amount * 100,
          commissionEarnedPaise: transactionDoc.commissionCalculated ? (await CommissionHistory.findOne({ transactionId: transactionDoc._id }))?.retailerCommissionAmount * 100 || 0 : 0,
          walletDebitedPaise: paymentMode === 'wallet' ? transactionDoc.amount * 100 : 0,
          walletBalanceAfterPaise: 0,
          mobileNumber: transactionDoc.mobileNumber,
          operatorName: operator.name.toUpperCase(),
          timestamp: transactionDoc.createdAt
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: providerResponse.message || 'Recharge failed at provider',
        data: {
          transactionId: transactionDoc.orderId,
          referenceId: transactionDoc.orderId,
          status: finalStatus.toLowerCase(),
          amountPaise: transactionDoc.amount * 100,
          failureReason: transactionDoc.failureReason,
          mobileNumber: transactionDoc.mobileNumber,
          operatorName: operator.name.toUpperCase(),
          timestamp: transactionDoc.createdAt
        }
      });
    }

  } catch (error) {
    console.error(`[Recharge Catch Block] Unhandled Exception:`, error);
    if (walletReserved) {
      await walletService.releaseReservation(req.user._id, amountForRollback).catch(e => console.error("Release hold err:", e));
    }

    if (transactionDoc) {
      transactionDoc.status = 'FAILED';
      transactionDoc.failureReason = error.message;
      await transactionDoc.save().catch(e => console.error(e));
    }
    if (globalTransactionDoc) {
      globalTransactionDoc.status = 'failed';
      globalTransactionDoc.failureReason = error.message;
      await globalTransactionDoc.save().catch(e => console.error(e));
    }

    return res.status(400).json({
      success: false,
      step: "Exception Catch Block",
      error: error.message,
      message: error.message,
      details: error.stack
    });
  }
};

// @desc    Check status of a recharge transaction
// @route   GET /api/recharge/status/:orderId
// @access  Private
const checkStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Admin can check any status, Retailer can only check their own
    const query = { orderId };
    if (req.user.role !== 'admin') {
      query.userId = userId;
    }

    const transaction = await RechargeTransaction.findOne(query);
    
    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    if (!transaction.providerTransactionId) {
      res.status(400);
      throw new Error('No provider transaction ID associated with this order.');
    }

    const providerName = transaction.providerName || 'A1Topup';
    const provider = ProviderFactory.getProvider(providerName);
    const statusResponse = await provider.status(transaction.providerTransactionId);

    // If status changed to SUCCESS from PENDING, we must run commission/ledger logic
    if (transaction.status === 'PENDING' && statusResponse.status === 'SUCCESS') {
      transaction.status = 'SUCCESS';
      transaction.operatorReference = statusResponse.operatorReference;
      
      // Deduct Wallet & Log Ledger
      await walletService.commitReservation(transaction.userId, transaction.amount, {
        referenceType: 'RECHARGE',
        referenceId: transaction._id,
        description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
      });

      const User = require('../models/User');
      const userRec = await User.findById(transaction.userId).lean();
      const userAccountType = userRec?.accountType || transaction.accountType || 'PERSONAL';
      transaction.accountType = userAccountType;

      // Idempotency check: Ensure commission not credited twice
      const existingComm = await CommissionHistory.findOne({ transactionId: transaction._id });
      let commission;
      if (!existingComm) {
        commission = await commissionService.calculateCommission(
          transaction.operatorCode,
          transaction.amount,
          '',
          'mobile',
          userAccountType,
          transaction.userId
        );
        if (commission.retailerCommissionAmount > 0) {
          await walletService.addBalance(transaction.userId, commission.retailerCommissionAmount, {
            referenceType: 'COMMISSION',
            referenceId: transaction._id,
            description: `Commission for Recharge ${transaction.orderId}`,
          });
          
          await Transaction.create({
            userId: transaction.userId,
            accountType: userAccountType,
            type: 'credit',
            amountPaise: commission.retailerCommissionAmount * 100,
            status: 'success',
            service: 'commission',
            referenceId: `COM${Date.now()}${Math.floor(Math.random() * 1000)}`,
            description: `Commission for Recharge ${transaction.orderId}`,
            apiReference: transaction._id.toString(),
            paymentMethod: 'wallet',
          });
        }
        
        await CommissionHistory.create({
          transactionId: transaction._id,
          userId: transaction.userId,
          accountType: userAccountType,
          operatorCode: transaction.operatorCode,
          rechargeAmount: transaction.amount,
          providerCommissionPercentage: commission.providerCommissionPercentage,
          providerCommissionAmount: commission.providerCommissionAmount,
          retailerCommissionPercentage: commission.retailerCommissionPercentage,
          retailerCommissionAmount: commission.retailerCommissionAmount,
          companyProfitPercentage: commission.companyProfitPercentage,
          companyProfitAmount: commission.companyProfitAmount,
        });
      } else {
        commission = { retailerCommissionAmount: existingComm.retailerCommissionAmount };
      }

      await Transaction.updateOne({ referenceId: transaction.orderId }, { 
        status: 'success', 
        accountType: userAccountType,
        apiReference: statusResponse.providerTransactionId,
        commissionEarnedPaise: (commission.retailerCommissionAmount || 0) * 100 
      });

      transaction.commissionCalculated = true;
    } else if (transaction.status === 'PENDING' && statusResponse.status === 'FAILED') {
      transaction.status = 'FAILED';
      transaction.failureReason = statusResponse.message;
      await walletService.releaseReservation(transaction.userId, transaction.amount);
      
      await Transaction.updateOne({ referenceId: transaction.orderId }, { 
        status: 'failed', 
        apiReference: statusResponse.providerTransactionId 
      });
    }
    
    await transaction.save();

    res.status(200).json({
      success: true,
      data: statusResponse,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle asynchronous callback/webhook from provider
// @route   POST /api/recharge/callback
// @access  Public (Provider)
const providerCallback = async (req, res, next) => {
  try {
    // Assuming A1 Topup sends: { txnid, status, opid, message, client_id }
    // Providers sometimes use GET instead of POST for webhooks, so check both body and query
    const data = Object.keys(req.body).length > 0 ? req.body : req.query;

    const { txid, txnid, status, opid, message, orderid, client_id } = data;

    const actualTxId = txid || txnid;
    const actualOrderId = orderid || client_id;

    if (!actualTxId && !actualOrderId) {
      return res.status(400).send('Invalid payload');
    }

    // Find transaction by orderId (actualOrderId) or providerTransactionId (actualTxId)
    const query = {};
    if (actualOrderId) query.orderId = actualOrderId;
    else if (actualTxId) query.providerTransactionId = actualTxId;

    const transaction = await RechargeTransaction.findOne(query);

    if (!transaction) {
      return res.status(404).send('Transaction not found');
    }

    // If transaction is already processed, return success (Idempotent)
    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
      return res.status(200).send('OK');
    }

    let normalizedStatus = 'PENDING';
    const rawStatus = (status || '').toUpperCase();
    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') normalizedStatus = 'SUCCESS';
    else if (rawStatus === 'FAILED' || rawStatus === 'ERROR' || rawStatus === 'FAILURE') normalizedStatus = 'FAILED';

    if (normalizedStatus === 'SUCCESS') {
      transaction.status = 'SUCCESS';
      if (opid) transaction.operatorReference = opid;
      
      // Deduct Wallet & Log Ledger
      await walletService.commitReservation(transaction.userId, transaction.amount, {
        referenceType: 'RECHARGE',
        referenceId: transaction._id,
        description: `Recharge for ${transaction.mobileNumber} - Order ID: ${transaction.orderId}`,
      });

      const User = require('../models/User');
      const userRec = await User.findById(transaction.userId).lean();
      const userAccountType = userRec?.accountType || transaction.accountType || 'PERSONAL';
      transaction.accountType = userAccountType;

      // Idempotency check: Ensure commission not credited twice
      const existingComm = await CommissionHistory.findOne({ transactionId: transaction._id });
      let commission;
      if (!existingComm) {
        commission = await commissionService.calculateCommission(
          transaction.operatorCode,
          transaction.amount,
          '',
          'mobile',
          userAccountType,
          transaction.userId
        );
        if (commission.retailerCommissionAmount > 0) {
          await walletService.addBalance(transaction.userId, commission.retailerCommissionAmount, {
            referenceType: 'COMMISSION',
            referenceId: transaction._id,
            description: `Commission for Recharge ${transaction.orderId}`,
          });

          await Transaction.create({
            userId: transaction.userId,
            accountType: userAccountType,
            type: 'credit',
            amountPaise: commission.retailerCommissionAmount * 100,
            status: 'success',
            service: 'commission',
            referenceId: `COM${Date.now()}${Math.floor(Math.random() * 1000)}`,
            description: `Commission for Recharge ${transaction.orderId}`,
            apiReference: transaction._id.toString(),
            paymentMethod: 'wallet',
          });
        }

        await CommissionHistory.create({
          transactionId: transaction._id,
          userId: transaction.userId,
          accountType: userAccountType,
          operatorCode: transaction.operatorCode,
          rechargeAmount: transaction.amount,
          providerCommissionPercentage: commission.providerCommissionPercentage,
          providerCommissionAmount: commission.providerCommissionAmount,
          retailerCommissionPercentage: commission.retailerCommissionPercentage,
          retailerCommissionAmount: commission.retailerCommissionAmount,
          companyProfitPercentage: commission.companyProfitPercentage,
          companyProfitAmount: commission.companyProfitAmount,
        });
      } else {
        commission = { retailerCommissionAmount: existingComm.retailerCommissionAmount };
      }

      await Transaction.updateOne({ referenceId: transaction.orderId }, { 
         status: 'success', 
         accountType: userAccountType,
         apiReference: actualTxId,
         commissionEarnedPaise: (commission.retailerCommissionAmount || 0) * 100 
      });
      
      transaction.commissionCalculated = true;
    } else if (normalizedStatus === 'FAILED') {
      transaction.status = 'FAILED';
      transaction.failureReason = message || 'Failed at provider end';
      
      await walletService.releaseReservation(transaction.userId, transaction.amount);
      
      await Transaction.updateOne({ referenceId: transaction.orderId }, { 
         status: 'failed', 
         apiReference: actualTxId 
      });
    }

    await transaction.save();
    res.status(200).send('OK'); // Must return 200 OK so provider stops retrying

  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  checkProviderHealth,
  checkProviderBalance,
  getOperators,
  getPlans,
  executeRecharge,
  checkStatus,
  providerCallback,
};
