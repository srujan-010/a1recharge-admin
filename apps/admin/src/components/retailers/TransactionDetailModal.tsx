'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReceiptText, IndianRupee, Phone, Calendar, Hash, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  onCheckStatus?: (orderId: string) => Promise<void>;
  onRefund?: (orderId: string) => Promise<void>;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  onCheckStatus,
  onRefund,
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const normStatus = (transaction.status || '').toUpperCase();
  const amount = transaction.amountPaise !== undefined && transaction.amountPaise !== null
    ? transaction.amountPaise / 100
    : Number(transaction.amount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-indigo-500" />
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Transaction Audit Breakdown
              </DialogTitle>
            </div>
            <Badge
              variant={normStatus === 'SUCCESS' ? 'success' : normStatus === 'FAILED' ? 'error' : 'warning'}
              className="text-xs uppercase font-bold px-3 py-1"
            >
              {normStatus}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 text-sm">
          {/* Top Summary Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 font-medium">Recharge Amount</p>
              <p className="text-2xl font-black font-mono text-slate-900 dark:text-white flex items-center">
                ₹{(Number(amount) || 0).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-medium">Service & Operator</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {transaction.operatorName || transaction.internalOperatorName || 'Recharge'} ({transaction.serviceType || transaction.service || 'mobile'})
              </p>
            </div>
          </div>

          {/* Details Table Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
              <span className="text-slate-400 font-medium block">Order Reference ID</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{transaction.referenceId || transaction.orderId}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
              <span className="text-slate-400 font-medium block">Mobile Number</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{transaction.mobileNumber || 'N/A'}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
              <span className="text-slate-400 font-medium block">Provider Txn ID</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{transaction.providerTransactionId || 'N/A'}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
              <span className="text-slate-400 font-medium block">Operator Reference</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{transaction.operatorReference || 'N/A'}</span>
            </div>
          </div>

          {/* Financial Breakdown Section */}
          <div className="border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl space-y-2">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              Financial Breakdown (Rupees)
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block">Provider Comm.</span>
                <span className="font-mono font-bold text-indigo-600">
                  ₹{(Number(transaction.providerCommissionAmount) || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Retailer Comm.</span>
                <span className="font-mono font-bold text-rose-500">
                  ₹{(Number(transaction.retailerCommissionAmount) || Number(transaction.commissionEarnedPaise ? transaction.commissionEarnedPaise / 100 : 0) || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Net Company Profit</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{(Number(transaction.companyProfitAmount) || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps & Account info */}
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>Created: {new Date(transaction.createdAt).toLocaleString('en-IN')}</span>
            <span>Account Type: <strong className="uppercase">{transaction.accountType || 'PERSONAL'}</strong></span>
          </div>
        </div>

        <DialogFooter className="pt-2 flex justify-between items-center gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl h-10">
            Close
          </Button>

          <div className="flex gap-2">
            {normStatus === 'PENDING' && onCheckStatus && (
              <Button
                onClick={() => onCheckStatus(transaction.orderId || transaction.referenceId)}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 font-bold"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Check Status
              </Button>
            )}
            {normStatus === 'SUCCESS' && onRefund && (
              <Button
                onClick={() => onRefund(transaction.orderId || transaction.referenceId)}
                variant="outline"
                className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl h-10 font-bold"
              >
                <Undo2 className="w-4 h-4 mr-1.5" /> Trigger Refund
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
