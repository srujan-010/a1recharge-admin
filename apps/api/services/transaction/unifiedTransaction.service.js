const mongoose = require('mongoose');

/**
 * Unified Financial Transaction Service
 * 
 * Provides an authoritative, unified read model for ALL financial movements across:
 * - Transaction (canonical transaction records)
 * - WalletLedger (authoritative ledger for wallet credits, debits, adjustments)
 * - RechargeTransaction (recharges & attempt histories)
 * 
 * Ensures single source of truth without duplicating physical records merely for UI.
 */
class UnifiedTransactionService {

  /**
   * Determine canonical transaction type
   */
  getCanonicalTransactionType(doc) {
    const s = String(doc.service || '').toLowerCase();
    const t = String(doc.type || '').toLowerCase();
    const pm = String(doc.paymentMethod || '').toUpperCase();
    const src = String(doc.source || '').toUpperCase();
    const stat = String(doc.status || '').toUpperCase();

    if (s === 'admin_credit' || (src === 'ADMIN' && t === 'credit') || pm === 'ADMIN_CREDIT') {
      return 'ADMIN_CREDIT';
    }
    if (s === 'admin_debit' || (src === 'ADMIN' && t === 'debit') || pm === 'ADMIN_DEBIT') {
      return 'ADMIN_DEBIT';
    }
    if (s === 'wallet_topup' || ['topup', 'add_money'].includes(s)) {
      if (pm === 'UPI' || pm.includes('UPI') || (doc.upiDetails && doc.upiDetails.gatewayPaymentId)) {
        return 'WALLET_TOPUP_UPI';
      }
      if (pm === 'RAZORPAY' || src === 'RAZORPAY') {
        return 'WALLET_TOPUP_RAZORPAY';
      }
      return 'WALLET_TOPUP';
    }
    if (s === 'commission') {
      return 'COMMISSION_CREDIT';
    }
    if (s === 'refund' || stat === 'REFUNDED') {
      return 'REFUND';
    }
    if (s === 'reversal' || stat === 'REVERSED') {
      return 'REVERSAL';
    }
    if (s === 'wallet_hold') {
      return 'WALLET_HOLD';
    }
    if (s === 'wallet_hold_release') {
      return 'WALLET_HOLD_RELEASE';
    }
    if (s === 'wallet_adjustment') {
      return t === 'credit' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';
    }
    if (s === 'dth' || ['tata sky', 'dish tv', 'sun direct', 'videocon d2h', 'd2h', 'ts', 'ad', 'vd', 'sun'].includes(s)) {
      return 'DTH_RECHARGE';
    }
    if (
      s === 'mobile_recharge' || 
      s === 'mobile' || 
      ['airtel', 'jio', 'bsnl topup', 'bsnl', 'vi', 'reliance - jio', 'a', 'v', 'j', 'bt', 'br', 'stv', 'rc'].includes(s) ||
      (doc.orderId && String(doc.orderId).startsWith('A1R')) ||
      (doc.referenceId && String(doc.referenceId).startsWith('A1R')) ||
      !!doc.recharge
    ) {
      return 'MOBILE_RECHARGE';
    }
    if (s === 'bbps') {
      return 'BILL_PAYMENT';
    }

    return 'OTHER';
  }

  /**
   * Builds and executes the authoritative unified transaction query
   */
  async getUnifiedGlobalTransactions({
    page = 1,
    limit = 20,
    search = '',
    status = 'all',
    retailerId = '',
    service = '',
    transactionType = 'all',
    paymentMethod = 'all',
    accountType = 'all',
    showTest = false,
    userId = null
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const db = mongoose.connection.db;

    // Pipeline Construction
    const pipeline = [];

    // Stage 1: Base projection from `transactions`, enriched with recharge and wallet ledger
    pipeline.push(
      // Lookup matching recharge document
      {
        $lookup: {
          from: 'rechargetransactions',
          let: { refId: '$referenceId', txnId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$orderId', '$$refId'] },
                    { $eq: ['$_id', '$$refId'] },
                    { $eq: ['$_id', '$$txnId'] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'rcDoc'
        }
      },
      {
        $addFields: {
          recharge: { $arrayElemAt: ['$rcDoc', 0] }
        }
      },
      // Lookup matching wallet ledger document for closing balance and net debit
      {
        $lookup: {
          from: 'walletledgers',
          let: {
            ledgerId: '$recharge.walletDebitLedgerId',
            rcId: '$recharge._id',
            refId: '$referenceId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$ledgerId'] },
                    { $eq: ['$referenceId', '$$rcId'] },
                    { $eq: ['$referenceId', '$$refId'] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'ledgerDoc'
        }
      },
      {
        $addFields: {
          ledger: { $arrayElemAt: ['$ledgerDoc', 0] }
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          accountType: { $ifNull: ['$accountType', '$recharge.accountType'] },
          type: { $toLower: '$type' },
          amountPaise: {
            $cond: [
              { $and: [{ $ne: ['$amountPaise', null] }, { $gt: ['$amountPaise', 0] }] },
              '$amountPaise',
              { $round: [{ $multiply: [{ $ifNull: ['$amount', 0] }, 100] }, 0] }
            ]
          },
          netPayablePaise: {
            $cond: [
              { $ne: ['$recharge.netPayablePaise', null] },
              '$recharge.netPayablePaise',
              {
                $cond: [
                  { $ne: ['$payableAmountPaise', null] },
                  '$payableAmountPaise',
                  {
                    $cond: [
                      { $ne: ['$ledger.amountPaise', null] },
                      '$ledger.amountPaise',
                      null
                    ]
                  }
                ]
              }
            ]
          },
          closingBalancePaise: {
            $cond: [
              { $ne: ['$closingBalancePaise', null] },
              '$closingBalancePaise',
              {
                $cond: [
                  { $ne: ['$ledger.balanceAfterPaise', null] },
                  '$ledger.balanceAfterPaise',
                  {
                    $cond: [
                      { $ne: ['$ledger.balanceAfter', null] },
                      { $round: [{ $multiply: ['$ledger.balanceAfter', 100] }, 0] },
                      null
                    ]
                  }
                ]
              }
            ]
          },
          status: { $toUpper: { $ifNull: ['$status', 'PENDING'] } },
          service: { $ifNull: ['$recharge.serviceType', '$service'] },
          referenceId: '$referenceId',
          orderId: { $ifNull: ['$recharge.orderId', '$referenceId'] },
          description: '$description',
          mobileNumber: { $ifNull: ['$mobileNumber', { $ifNull: ['$recipientName', '$recharge.mobileNumber'] }] },
          operatorName: { $ifNull: ['$operatorName', '$recharge.internalOperatorName'] },
          apiReference: { $ifNull: ['$apiReference', '$recharge.providerTransactionId'] },
          providerTransactionId: { $ifNull: ['$providerTransactionId', '$recharge.providerTransactionId'] },
          walletDebitLedgerId: { $ifNull: ['$recharge.walletDebitLedgerId', '$ledger._id'] },
          commissionEarnedPaise: {
            $cond: [
              { $gt: ['$commissionEarnedPaise', 0] },
              '$commissionEarnedPaise',
              {
                $cond: [
                  { $ne: ['$recharge.commissionAmountPaise', null] },
                  '$recharge.commissionAmountPaise',
                  0
                ]
              }
            ]
          },
          paymentMethod: { $toUpper: { $ifNull: ['$paymentMethod', { $ifNull: ['$recharge.paymentMethod', 'WALLET'] }] } },
          paymentStatus: '$paymentStatus',
          source: { $ifNull: ['$source', 'SYSTEM'] },
          performedBy: { $ifNull: ['$performedBy', null] },
          adminId: { $ifNull: ['$adminId', null] },
          adminName: { $ifNull: ['$adminName', null] },
          reason: { $ifNull: ['$reason', null] },
          upiDetails: '$upiDetails',
          isTest: { $ifNull: ['$isTest', false] },
          createdAt: '$createdAt'
        }
      }
    );

    // Stage 2: Union standalone WalletLedger entries (EXCLUDING recharge debits)
    pipeline.push({
      $unionWith: {
        coll: 'walletledgers',
        pipeline: [
          // IMPORTANT: Strictly exclude recharge debits! They are the accounting records of parent recharges.
          {
            $match: {
              referenceType: { $nin: ['RECHARGE', 'RECHARGE_DEBIT'] }
            }
          },
          {
            $lookup: {
              from: 'transactions',
              let: { refId: '$referenceId', ledgerId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$referenceId', '$$refId'] },
                        { $eq: ['$referenceId', { $toString: '$$refId' }] },
                        { $eq: ['$_id', '$$ledgerId'] }
                      ]
                    }
                  }
                },
                { $limit: 1 }
              ],
              as: 'matchedTxn'
            }
          },
          {
            $match: {
              matchedTxn: { $size: 0 }
            }
          },
          {
            $project: {
              _id: '$_id',
              userId: '$userId',
              accountType: null,
              type: {
                $cond: [
                  { $eq: [{ $toUpper: '$transactionType' }, 'CREDIT'] },
                  'credit',
                  'debit'
                ]
              },
              amountPaise: {
                $cond: [
                  { $and: [{ $ne: ['$amountPaise', null] }, { $gt: ['$amountPaise', 0] }] },
                  '$amountPaise',
                  { $round: [{ $multiply: [{ $ifNull: ['$amount', 0] }, 100] }, 0] }
                ]
              },
              netPayablePaise: { $literal: null },
              closingBalancePaise: {
                $cond: [
                  { $ne: ['$balanceAfterPaise', null] },
                  '$balanceAfterPaise',
                  { $round: [{ $multiply: [{ $ifNull: ['$balanceAfter', 0] }, 100] }, 0] }
                ]
              },
              status: { $literal: 'SUCCESS' },
              service: {
                $switch: {
                  branches: [
                    { case: { $in: ['$referenceType', ['ADMIN_CREDIT', 'MANUAL_CREDIT']] }, then: 'admin_credit' },
                    { case: { $in: ['$referenceType', ['ADMIN_DEBIT', 'MANUAL_DEBIT']] }, then: 'admin_debit' },
                    {
                      case: { $eq: ['$referenceType', 'MANUAL'] },
                      then: {
                        $cond: [{ $eq: [{ $toUpper: '$transactionType' }, 'CREDIT'] }, 'admin_credit', 'admin_debit']
                      }
                    },
                    { case: { $in: ['$referenceType', ['ADD_MONEY', 'RAZORPAY_WALLET_CREDIT']] }, then: 'wallet_topup' },
                    { case: { $eq: ['$referenceType', 'COMMISSION'] }, then: 'commission' },
                    { case: { $eq: ['$referenceType', 'REFUND'] }, then: 'refund' },
                    { case: { $eq: ['$referenceType', 'HOLD_RELEASE'] }, then: 'wallet_hold_release' }
                  ],
                  default: 'wallet_adjustment'
                }
              },
              referenceId: { $toString: '$referenceId' },
              orderId: { $literal: null },
              description: '$description',
              mobileNumber: { $literal: null },
              operatorName: { $literal: null },
              apiReference: { $literal: null },
              providerTransactionId: { $literal: null },
              walletDebitLedgerId: { $literal: null },
              commissionEarnedPaise: { $literal: 0 },
              paymentMethod: {
                $switch: {
                  branches: [
                    { case: { $in: ['$referenceType', ['ADMIN_CREDIT', 'ADMIN_DEBIT', 'MANUAL']] }, then: 'ADMIN' },
                    { case: { $eq: ['$referenceType', 'ADD_MONEY'] }, then: 'UPI' },
                    { case: { $eq: ['$referenceType', 'RAZORPAY_WALLET_CREDIT'] }, then: 'RAZORPAY' }
                  ],
                  default: 'SYSTEM'
                }
              },
              paymentStatus: { $literal: null },
              source: {
                $switch: {
                  branches: [
                    { case: { $in: ['$referenceType', ['ADMIN_CREDIT', 'ADMIN_DEBIT', 'MANUAL']] }, then: 'ADMIN' },
                    { case: { $in: ['$referenceType', ['ADD_MONEY', 'RAZORPAY_WALLET_CREDIT']] }, then: 'RAZORPAY' }
                  ],
                  default: 'SYSTEM'
                }
              },
              performedBy: { $ifNull: ['$adminName', null] },
              adminId: { $ifNull: ['$adminId', null] },
              adminName: { $ifNull: ['$adminName', null] },
              reason: { $ifNull: ['$remark', '$description'] },
              upiDetails: { $literal: null },
              isTest: { $literal: false },
              createdAt: '$createdAt'
            }
          }
        ]
      }
    });

    // Stage 3: Union RechargeTransaction entries not present in transactions
    pipeline.push({
      $unionWith: {
        coll: 'rechargetransactions',
        pipeline: [
          {
            $lookup: {
              from: 'transactions',
              let: { ordId: '$orderId', rcId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$referenceId', '$$ordId'] },
                        { $eq: ['$_id', '$$rcId'] }
                      ]
                    }
                  }
                },
                { $limit: 1 }
              ],
              as: 'matchedTxn'
            }
          },
          {
            $match: {
              matchedTxn: { $size: 0 }
            }
          },
          // Lookup ledger for this recharge
          {
            $lookup: {
              from: 'walletledgers',
              let: {
                ledgerId: '$walletDebitLedgerId',
                rcId: '$_id',
                ordId: '$orderId'
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$_id', '$$ledgerId'] },
                        { $eq: ['$referenceId', '$$rcId'] },
                        { $eq: ['$referenceId', '$$ordId'] }
                      ]
                    }
                  }
                },
                { $limit: 1 }
              ],
              as: 'rcLedger'
            }
          },
          {
            $addFields: {
              matchedLedgerDoc: { $arrayElemAt: ['$rcLedger', 0] }
            }
          },
          {
            $project: {
              _id: '$_id',
              userId: '$userId',
              accountType: '$accountType',
              type: { $literal: 'debit' },
              amountPaise: {
                $cond: [
                  { $and: [{ $ne: ['$grossAmountPaise', null] }, { $gt: ['$grossAmountPaise', 0] }] },
                  '$grossAmountPaise',
                  { $round: [{ $multiply: [{ $ifNull: ['$amount', 0] }, 100] }, 0] }
                ]
              },
              netPayablePaise: {
                $cond: [
                  { $ne: ['$netPayablePaise', null] },
                  '$netPayablePaise',
                  {
                    $cond: [
                      { $ne: ['$matchedLedgerDoc.amountPaise', null] },
                      '$matchedLedgerDoc.amountPaise',
                      null
                    ]
                  }
                ]
              },
              closingBalancePaise: {
                $cond: [
                  { $ne: ['$matchedLedgerDoc.balanceAfterPaise', null] },
                  '$matchedLedgerDoc.balanceAfterPaise',
                  {
                    $cond: [
                      { $ne: ['$matchedLedgerDoc.balanceAfter', null] },
                      { $round: [{ $multiply: ['$matchedLedgerDoc.balanceAfter', 100] }, 0] },
                      null
                    ]
                  }
                ]
              },
              status: { $toUpper: { $ifNull: ['$status', 'PENDING'] } },
              service: {
                $cond: [
                  { $eq: [{ $toLower: '$serviceType' }, 'dth'] },
                  'dth',
                  'mobile_recharge'
                ]
              },
              referenceId: { $ifNull: ['$orderId', { $toString: '$_id' }] },
              orderId: '$orderId',
              description: { $concat: ['Recharge for ', { $ifNull: ['$mobileNumber', ''] }] },
              mobileNumber: '$mobileNumber',
              operatorName: { $ifNull: ['$internalOperatorName', '$operatorCode'] },
              apiReference: { $ifNull: ['$providerTransactionId', null] },
              providerTransactionId: { $ifNull: ['$providerTransactionId', null] },
              walletDebitLedgerId: { $ifNull: ['$walletDebitLedgerId', '$matchedLedgerDoc._id'] },
              commissionEarnedPaise: {
                $cond: [
                  { $ne: ['$commissionAmountPaise', null] },
                  '$commissionAmountPaise',
                  { $round: [{ $multiply: [{ $ifNull: ['$commissionAmount', 0] }, 100] }, 0] }
                ]
              },
              paymentMethod: { $toUpper: { $ifNull: ['$paymentMethod', 'WALLET'] } },
              paymentStatus: '$paymentStatus',
              source: { $literal: 'WALLET' },
              performedBy: null,
              adminId: null,
              adminName: null,
              reason: null,
              upiDetails: null,
              isTest: { $ifNull: ['$isTest', false] },
              createdAt: '$createdAt'
            }
          }
        ]
      }
    });

    // Stage 4: Populate User Details
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      {
        $unwind: {
          path: '$userDoc',
          preserveNullAndEmptyArrays: true
        }
      }
    );

    // Stage 5: Normalize and compute canonical transactionType
    pipeline.push({
      $addFields: {
        canonicalType: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $eq: ['$service', 'admin_credit'] },
                    { $and: [{ $eq: ['$source', 'ADMIN'] }, { $eq: ['$type', 'credit'] }] },
                    { $eq: ['$paymentMethod', 'ADMIN_CREDIT'] }
                  ]
                },
                then: 'ADMIN_CREDIT'
              },
              {
                case: {
                  $or: [
                    { $eq: ['$service', 'admin_debit'] },
                    { $and: [{ $eq: ['$source', 'ADMIN'] }, { $eq: ['$type', 'debit'] }] },
                    { $eq: ['$paymentMethod', 'ADMIN_DEBIT'] }
                  ]
                },
                then: 'ADMIN_DEBIT'
              },
              {
                case: {
                  $and: [
                    { $in: ['$service', ['wallet_topup', 'topup', 'add_money']] },
                    {
                      $or: [
                        { $in: ['$paymentMethod', ['UPI', 'RAZORPAY_UPI', 'BHIM_UPI']] },
                        { $ne: ['$upiDetails.gatewayPaymentId', null] }
                      ]
                    }
                  ]
                },
                then: 'WALLET_TOPUP_UPI'
              },
              {
                case: {
                  $and: [
                    { $in: ['$service', ['wallet_topup', 'topup', 'add_money']] },
                    {
                      $or: [
                        { $eq: ['$paymentMethod', 'RAZORPAY'] },
                        { $eq: ['$source', 'RAZORPAY'] }
                      ]
                    }
                  ]
                },
                then: 'WALLET_TOPUP_RAZORPAY'
              },
              { case: { $in: ['$service', ['wallet_topup', 'topup', 'add_money']] }, then: 'WALLET_TOPUP' },
              { case: { $eq: ['$service', 'commission'] }, then: 'COMMISSION_CREDIT' },
              { case: { $or: [{ $eq: ['$service', 'refund'] }, { $eq: ['$status', 'REFUNDED'] }] }, then: 'REFUND' },
              { case: { $or: [{ $eq: ['$service', 'reversal'] }, { $eq: ['$status', 'REVERSED'] }] }, then: 'REVERSAL' },
              { case: { $eq: ['$service', 'wallet_hold'] }, then: 'WALLET_HOLD' },
              { case: { $eq: ['$service', 'wallet_hold_release'] }, then: 'WALLET_HOLD_RELEASE' },
              { case: { $eq: ['$service', 'wallet_adjustment'] }, then: 'WALLET_ADJUSTMENT' },
              {
                case: {
                  $or: [
                    { $eq: ['$service', 'dth'] },
                    { $in: [{ $toUpper: '$service' }, ['DISH TV', 'TATA SKY', 'SUN DIRECT', 'VIDEOCON D2H', 'D2H', 'TS', 'AD', 'VD', 'SUN']] },
                    { $regexMatch: { input: { $ifNull: ['$orderId', ''] }, regex: '^A1DTH', options: 'i' } },
                    { $regexMatch: { input: { $ifNull: ['$referenceId', ''] }, regex: '^A1DTH', options: 'i' } }
                  ]
                },
                then: 'DTH_RECHARGE'
              },
              {
                case: {
                  $or: [
                    { $in: ['$service', ['mobile_recharge', 'mobile', 'recharge']] },
                    { $in: [{ $toUpper: '$service' }, ['AIRTEL', 'JIO', 'BSNL TOPUP', 'BSNL', 'VI', 'RELIANCE - JIO', 'A', 'V', 'J', 'BT', 'BR', 'STV', 'RC', 'MOBILE']] },
                    { $regexMatch: { input: { $ifNull: ['$orderId', ''] }, regex: '^A1R', options: 'i' } },
                    { $regexMatch: { input: { $ifNull: ['$referenceId', ''] }, regex: '^A1R', options: 'i' } }
                  ]
                },
                then: 'MOBILE_RECHARGE'
              },
              { case: { $eq: ['$service', 'bbps'] }, then: 'BILL_PAYMENT' }
            ],
            default: 'OTHER'
          }
        }
      }
    });

    // Stage 6: Filtering
    const matchFilters = {};

    // Test filter
    if (!showTest) {
      matchFilters.isTest = { $ne: true };
    }

    // Direct User Filter (e.g. for Retailer portal statement)
    if (userId) {
      matchFilters.userId = new mongoose.Types.ObjectId(userId);
    }

    // Retailer Filter (by retailerId or ObjectId)
    if (retailerId) {
      if (mongoose.Types.ObjectId.isValid(retailerId)) {
        matchFilters.$or = [
          { 'userDoc.retailerId': retailerId },
          { userId: new mongoose.Types.ObjectId(retailerId) }
        ];
      } else {
        matchFilters['userDoc.retailerId'] = retailerId;
      }
    }

    // Account Type Filter
    if (accountType && accountType !== 'all') {
      const acc = accountType.toUpperCase();
      matchFilters.$or = [
        { accountType: acc },
        { 'userDoc.accountType': acc }
      ];
    }

    // Status Filter
    if (status && status !== 'all') {
      const normStatus = status.toUpperCase();
      matchFilters.status = normStatus;
    }

    // Payment Method Filter
    if (paymentMethod && paymentMethod !== 'all') {
      const normPm = paymentMethod.toUpperCase();
      if (normPm === 'UPI') {
        matchFilters.$or = [
          { paymentMethod: { $in: ['UPI', 'RAZORPAY_UPI', 'BHIM_UPI'] } },
          { 'upiDetails.gatewayPaymentId': { $ne: null } }
        ];
      } else if (normPm === 'WALLET') {
        matchFilters.paymentMethod = 'WALLET';
      } else if (normPm === 'RAZORPAY') {
        matchFilters.$or = [
          { paymentMethod: { $in: ['RAZORPAY', 'RAZORPAY_UPI'] } },
          { source: 'RAZORPAY' }
        ];
      } else if (normPm === 'ADMIN') {
        matchFilters.$or = [
          { paymentMethod: { $in: ['ADMIN', 'ADMIN_CREDIT', 'ADMIN_DEBIT'] } },
          { source: 'ADMIN' }
        ];
      } else if (normPm === 'SYSTEM') {
        matchFilters.$or = [
          { paymentMethod: 'SYSTEM' },
          { source: 'SYSTEM' }
        ];
      } else {
        matchFilters.paymentMethod = normPm;
      }
    }

    // Transaction Type Filter
    if (transactionType && transactionType !== 'all') {
      const normType = transactionType.toUpperCase();
      if (normType === 'RECHARGE') {
        matchFilters.canonicalType = { $in: ['MOBILE_RECHARGE', 'DTH_RECHARGE'] };
      } else if (normType === 'WALLET_TOPUP' || normType === 'TOPUP') {
        matchFilters.canonicalType = { $in: ['WALLET_TOPUP', 'WALLET_TOPUP_UPI', 'WALLET_TOPUP_RAZORPAY'] };
      } else if (normType === 'ADMIN_CREDIT') {
        matchFilters.canonicalType = 'ADMIN_CREDIT';
      } else if (normType === 'ADMIN_DEBIT') {
        matchFilters.canonicalType = 'ADMIN_DEBIT';
      } else if (normType === 'COMMISSION') {
        matchFilters.canonicalType = 'COMMISSION_CREDIT';
      } else if (normType === 'REFUND') {
        matchFilters.canonicalType = 'REFUND';
      } else if (normType === 'REVERSAL') {
        matchFilters.canonicalType = 'REVERSAL';
      } else if (normType === 'HOLD') {
        matchFilters.canonicalType = 'WALLET_HOLD';
      } else if (normType === 'HOLD_RELEASE') {
        matchFilters.canonicalType = 'WALLET_HOLD_RELEASE';
      } else {
        matchFilters.canonicalType = normType;
      }
    }

    // Legacy Service Filter (recharge, bbps, etc.)
    if (service && service !== 'all') {
      if (service === 'recharge') {
        matchFilters.canonicalType = { $in: ['MOBILE_RECHARGE', 'DTH_RECHARGE'] };
      } else if (['wallet_topup', 'topup', 'add_money'].includes(service.toLowerCase())) {
        matchFilters.canonicalType = { $in: ['WALLET_TOPUP', 'WALLET_TOPUP_UPI', 'WALLET_TOPUP_RAZORPAY'] };
      } else {
        matchFilters.service = { $regex: new RegExp(`^${service}$`, 'i') };
      }
    }

    // Global Search Filter
    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { 'userDoc.name': { $regex: q, $options: 'i' } },
        { 'userDoc.retailerId': { $regex: q, $options: 'i' } },
        { 'userDoc.phone': { $regex: q, $options: 'i' } },
        { referenceId: { $regex: q, $options: 'i' } },
        { orderId: { $regex: q, $options: 'i' } },
        { mobileNumber: { $regex: q, $options: 'i' } },
        { apiReference: { $regex: q, $options: 'i' } },
        { providerTransactionId: { $regex: q, $options: 'i' } },
        { 'upiDetails.gatewayPaymentId': { $regex: q, $options: 'i' } },
        { 'upiDetails.gatewayOrderId': { $regex: q, $options: 'i' } },
        { 'upiDetails.utr': { $regex: q, $options: 'i' } },
        { reason: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { adminName: { $regex: q, $options: 'i' } },
        { performedBy: { $regex: q, $options: 'i' } }
      ];

      if (mongoose.Types.ObjectId.isValid(q)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(q) });
      }

      matchFilters.$or = searchConditions;
    }

    pipeline.push({ $match: matchFilters });

    // Stage 7: Sorting and Pagination via Facet
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limitNum }
        ]
      }
    });

    const [facetResult] = await db.collection('transactions').aggregate(pipeline, { allowDiskUse: true }).toArray();

    const total = facetResult?.metadata?.[0]?.total || 0;
    const rawData = facetResult?.data || [];

    // Format output
    const formattedData = rawData.map(doc => {
      const canonicalType = doc.canonicalType || this.getCanonicalTransactionType(doc);
      const isCredit = doc.type === 'credit';
      const user = doc.userDoc ? {
        _id: doc.userDoc._id,
        name: doc.userDoc.name || 'Unknown Retailer',
        retailerId: doc.userDoc.retailerId || 'N/A',
        phone: doc.userDoc.phone || '',
        accountType: doc.userDoc.accountType || doc.accountType || 'PERSONAL'
      } : {
        _id: doc.userId,
        name: 'Unknown Retailer',
        retailerId: 'N/A',
        phone: '',
        accountType: doc.accountType || 'PERSONAL'
      };

      // Construct clean descriptive service name
      let serviceTitle = doc.description || '';
      if (canonicalType === 'ADMIN_CREDIT') {
        serviceTitle = 'Manual Wallet Credit';
      } else if (canonicalType === 'ADMIN_DEBIT') {
        serviceTitle = 'Manual Wallet Debit';
      } else if (canonicalType === 'WALLET_TOPUP_UPI' || canonicalType === 'WALLET_TOPUP_RAZORPAY' || canonicalType === 'WALLET_TOPUP') {
        serviceTitle = 'Wallet Top-up';
      } else if (canonicalType === 'MOBILE_RECHARGE') {
        serviceTitle = doc.operatorName ? `${doc.operatorName} Recharge` : 'Mobile Recharge';
      } else if (canonicalType === 'DTH_RECHARGE') {
        serviceTitle = doc.operatorName ? `${doc.operatorName} DTH` : 'DTH Recharge';
      } else if (canonicalType === 'COMMISSION_CREDIT') {
        serviceTitle = 'Commission Credit';
      } else if (canonicalType === 'REFUND') {
        serviceTitle = 'Recharge Refund';
      } else if (canonicalType === 'REVERSAL') {
        serviceTitle = 'Transaction Reversal';
      } else if (canonicalType === 'WALLET_HOLD_RELEASE') {
        serviceTitle = 'Wallet Hold Release';
      }

      const targetIdentifier = doc.mobileNumber 
        || doc.upiDetails?.gatewayPaymentId 
        || (canonicalType.includes('WALLET_TOPUP') ? doc.referenceId : null)
        || null;

      const netPayablePaise = doc.netPayablePaise !== null && doc.netPayablePaise !== undefined 
        ? Math.round(doc.netPayablePaise) 
        : null;

      return {
        _id: doc._id,
        userId: user,
        accountType: user.accountType,
        transactionType: canonicalType,
        type: doc.type,
        amountPaise: Math.round(doc.amountPaise || 0),
        amountRupees: Number(((doc.amountPaise || 0) / 100).toFixed(2)),
        netPayablePaise,
        netPayableRupees: netPayablePaise !== null ? Number((netPayablePaise / 100).toFixed(2)) : null,
        closingBalancePaise: doc.closingBalancePaise !== null ? Math.round(doc.closingBalancePaise) : null,
        closingBalanceRupees: doc.closingBalancePaise !== null ? Number((doc.closingBalancePaise / 100).toFixed(2)) : null,
        status: doc.status.toLowerCase(),
        service: doc.service,
        serviceTitle,
        description: doc.description,
        mobileNumber: doc.mobileNumber || null,
        targetIdentifier,
        operatorName: doc.operatorName || null,
        apiReference: doc.apiReference || null,
        providerTransactionId: doc.providerTransactionId || doc.apiReference || null,
        orderId: doc.orderId || doc.referenceId,
        referenceId: doc.referenceId,
        walletDebitLedgerId: doc.walletDebitLedgerId || null,
        commissionEarnedPaise: Math.round(doc.commissionEarnedPaise || 0),
        paymentMethod: doc.paymentMethod,
        source: doc.source || 'SYSTEM',
        performedBy: doc.performedBy || doc.adminName || (doc.source === 'ADMIN' ? 'Admin' : null),
        adminId: doc.adminId || null,
        adminName: doc.adminName || null,
        reason: doc.reason || (doc.source === 'ADMIN' ? doc.description : null),
        upiDetails: doc.upiDetails || null,
        createdAt: doc.createdAt,
        isTest: !!doc.isTest
      };
    });

    return {
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };
  }
}

module.exports = new UnifiedTransactionService();
