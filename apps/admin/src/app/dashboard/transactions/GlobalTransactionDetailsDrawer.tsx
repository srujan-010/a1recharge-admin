"use client";

import React from 'react';
import { 
  X, 
  Smartphone, 
  Wallet, 
  ReceiptText, 
  ArrowDownRight, 
  ArrowUpRight, 
  ShieldCheck, 
  Building2, 
  QrCode, 
  CreditCard, 
  Cpu, 
  ExternalLink,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  UserCheck
} from 'lucide-react';
import { TransactionEntry } from '@/hooks/useTransactions';
import { Badge } from '@/components/ui/badge';
import { AccountTypeBadge } from '@/components/ui/account-type-badge';
import Link from 'next/link';

interface GlobalTransactionDetailsDrawerProps {
  transaction: TransactionEntry | null;
  onClose: () => void;
}

export function GlobalTransactionDetailsDrawer({
  transaction,
  onClose,
}: GlobalTransactionDetailsDrawerProps) {
  if (!transaction) return null;

  const isCredit = transaction.type === 'credit';
  const isRecharge = transaction.transactionType === 'MOBILE_RECHARGE' || transaction.transactionType === 'DTH_RECHARGE';
  const isAdminAdj = transaction.transactionType === 'ADMIN_CREDIT' || transaction.transactionType === 'ADMIN_DEBIT' || transaction.source === 'ADMIN';
  const isTopup = transaction.transactionType.includes('WALLET_TOPUP');

  const grossAmount = (transaction.amountPaise / 100).toFixed(2);
  const commission = ((transaction.commissionEarnedPaise || 0) / 100).toFixed(2);
  const netDebit = transaction.netPayablePaise 
    ? (transaction.netPayablePaise / 100).toFixed(2) 
    : (isRecharge && transaction.commissionEarnedPaise)
      ? ((transaction.amountPaise - transaction.commissionEarnedPaise) / 100).toFixed(2)
      : grossAmount;
  const balanceAfter = transaction.closingBalancePaise !== null && transaction.closingBalancePaise !== undefined
    ? (transaction.closingBalancePaise / 100).toFixed(2)
    : null;

  const user = transaction.userId;
  const accType = transaction.accountType || user?.accountType || 'RETAILER';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 transition-opacity" 
        onClick={onClose} 
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-slate-950 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Transaction Details
              </h2>
              <Badge variant={
                transaction.status === 'success' ? 'success' :
                transaction.status === 'failed' ? 'error' :
                transaction.status === 'refunded' ? 'secondary' :
                transaction.status === 'reversed' ? 'warning' : 'info'
              } className="uppercase text-[10px] font-bold">
                {transaction.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Ref / Order: <span className="font-semibold text-slate-800 dark:text-slate-200">{transaction.orderId || transaction.referenceId}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. Primary Amount Highlight Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isRecharge ? 'Gross Recharge Amount' : isCredit ? 'Total Credit Amount' : 'Total Debit Amount'}
              </span>
              <span className={`text-2xl sm:text-3xl font-mono font-extrabold mt-0.5 ${
                isCredit 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : transaction.transactionType === 'ADMIN_DEBIT'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
              }`}>
                {isCredit ? '+' : '-'}₹{grossAmount}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Payment Method
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 mt-1 uppercase">
                {transaction.transactionType === 'ADMIN_DEBIT' || transaction.service === 'manual_debit' || transaction.paymentMethod === 'ADMIN_ADJUSTMENT' || transaction.paymentMethod === 'ADMIN_DEBIT'
                  ? 'Admin Adjustment'
                  : transaction.paymentStatus === 'UNPAID' || transaction.paymentMethod === 'NOT_SET' || transaction.paymentMethod === 'NOT_SPECIFIED'
                  ? 'Not Paid'
                  : transaction.paymentMethod === 'BANK_TRANSFER'
                  ? 'Bank Transfer'
                  : transaction.paymentMethod || 'WALLET'}
              </span>
            </div>
          </div>

          {/* 2. Financial Accounting Breakdown (Core requirement) */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/40 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-primary" /> Authoritative Accounting Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Gross Amount */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted-foreground block">Gross Amount</span>
                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  ₹{grossAmount}
                </span>
              </div>

              {/* Commission (if recharge) */}
              {isRecharge && (
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Commission Earned</span>
                  <span className="font-mono font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                    +₹{commission}
                  </span>
                </div>
              )}

              {/* Net Wallet Debit (for wallet recharges) */}
              {isRecharge && (
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                  <span className="text-[11px] text-blue-700 dark:text-blue-400 block font-medium">Net Wallet Debit</span>
                  <span className="font-mono font-bold text-sm sm:text-base text-blue-600 dark:text-blue-400">
                    -₹{netDebit}
                  </span>
                </div>
              )}

              {/* Wallet Balance After */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted-foreground block">Balance After Debit</span>
                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {balanceAfter ? `₹${balanceAfter}` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Explanatory note */}
            {isRecharge && (
              <p className="text-[11px] text-muted-foreground bg-slate-50/80 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Accounting Formula:</span> Gross Recharge (₹{grossAmount}) - Commission (₹{commission}) = Net Wallet Debited (₹{netDebit}). Exactly one net debit movement of ₹{netDebit} was recorded in the authoritative wallet ledger.
              </p>
            )}
          </div>

          {/* 3. Retailer Profile Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-primary" /> Retailer Information
              </h3>
              {user?._id && (
                <Link
                  href={`/dashboard/retailers/${user._id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  View Profile <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Retailer Name</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {user?.name || 'Unknown Retailer'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Retailer ID</span>
                <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {user?.retailerId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Phone Number</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  {user?.phone || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Account Classification</span>
                <AccountTypeBadge type={accType} size="sm" />
              </div>
            </div>
          </div>

          {/* 4. Service / Operator / Network Processing */}
          {(isRecharge || transaction.operatorName || transaction.mobileNumber) && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/40 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-primary" /> Recharge & Network Processing
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Target Number</span>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {transaction.mobileNumber || transaction.targetIdentifier || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Operator</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {transaction.operatorName || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Service Type</span>
                  <span className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                    {transaction.service || 'Mobile'}
                  </span>
                </div>
                {transaction.providerTransactionId && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Provider Transaction ID</span>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {transaction.providerTransactionId}
                    </span>
                  </div>
                )}
                {transaction.orderId && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Internal Order ID</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate block" title={transaction.orderId}>
                      {transaction.orderId}
                    </span>
                  </div>
                )}
                {transaction.referenceId && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Database Reference ID</span>
                    <span className="font-mono text-[11px] text-muted-foreground truncate block" title={transaction.referenceId}>
                      {transaction.referenceId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Admin Adjustment Context (for manual credit/debit) */}
          {isAdminAdj && (
            <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-5 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" /> Admin Adjustment Audit
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-amber-800/70 dark:text-amber-400 block">Authenticated Admin</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {transaction.performedBy || transaction.adminName || 'Admin'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-amber-800/70 dark:text-amber-400 block">Source</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    {transaction.source || 'ADMIN'}
                  </span>
                </div>
              </div>

              {transaction.reason && (
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 block mb-0.5">
                    Exact Admin Reason:
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 break-words">
                    {transaction.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 6. UPI / Razorpay Gateway Details */}
          {(isTopup || transaction.upiDetails?.gatewayPaymentId) && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/40 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-primary" /> Gateway & Payment Details
              </h3>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                {transaction.upiDetails?.gatewayPaymentId && (
                  <div>
                    <span className="text-[11px] font-sans text-muted-foreground block">Payment ID</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {transaction.upiDetails.gatewayPaymentId}
                    </span>
                  </div>
                )}
                {transaction.upiDetails?.gatewayOrderId && (
                  <div>
                    <span className="text-[11px] font-sans text-muted-foreground block">Gateway Order ID</span>
                    <span className="text-slate-700 dark:text-slate-300 truncate block">
                      {transaction.upiDetails.gatewayOrderId}
                    </span>
                  </div>
                )}
                {transaction.upiDetails?.utr && (
                  <div>
                    <span className="text-[11px] font-sans text-muted-foreground block">Bank UTR</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {transaction.upiDetails.utr}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[11px] font-sans text-muted-foreground block">Source Gateway</span>
                  <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
                    {transaction.source || 'Razorpay'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 7. Timestamp & Audit Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-2 py-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(transaction.createdAt).toLocaleString()}
            </span>
            <span className="font-mono text-[11px]">
              ID: {transaction._id}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Details
          </button>
        </div>

      </div>
    </>
  );
}
