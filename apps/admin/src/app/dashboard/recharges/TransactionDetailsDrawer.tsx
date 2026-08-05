import React, { useState } from 'react';
import { X, Loader2, Clock, Smartphone, Wallet, Server, ShieldAlert, History, Activity, FileJson } from 'lucide-react';
import { useRechargeDetails } from '@/hooks/useTransactions';
import { Badge } from '@/components/ui/badge';

export function TransactionDetailsDrawer({ orderId, onClose }: { orderId: string | null, onClose: () => void }) {
  const { data, isLoading } = useRechargeDetails(orderId || '');
  const [showJson, setShowJson] = useState(false);

  if (!orderId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-slate-950 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transaction Details</h2>
            <p className="text-sm font-mono text-muted-foreground mt-1">Order ID: {orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Loading comprehensive details...</p>
            </div>
          ) : !data ? (
            <div className="text-center text-rose-500">Failed to load details.</div>
          ) : (
            <>
              {/* Recharge Information */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                  <Smartphone className="w-4 h-4" /> Recharge Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transaction Status</p>
                    <Badge variant={
                      data.recharge.status === 'SUCCESS' ? 'success' :
                      data.recharge.status === 'FAILED' ? 'error' :
                      data.recharge.status === 'REFUNDED' ? 'warning' : 'info'
                    } className="uppercase">{data.recharge.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Recharge Amount</p>
                    <p className="font-mono font-bold text-lg text-slate-900 dark:text-white">₹{data.recharge.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mobile / DTH Number</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">{data.recharge.mobileNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Operator & Circle</p>
                    <p className="font-bold text-slate-900 dark:text-white">{data.recharge.operatorCode} / {data.recharge.circleCode}</p>
                  </div>
                  <div className="col-span-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-muted-foreground mb-1">Retailer</p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {data.recharge.userId?.name} <span className="text-muted-foreground font-normal">({data.recharge.userId?.retailerId})</span>
                    </p>
                  </div>
                </div>
              </section>

              {/* Wallet Information */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                  <Wallet className="w-4 h-4" /> Wallet & Commission
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Wallet Debited</p>
                      <p className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {data.walletTransaction ? `₹${(data.walletTransaction.amountPaise / 100).toFixed(2)}` : 'Pending/Failed'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Closing Balance</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">
                        {data.walletTransaction?.closingBalancePaise ? `₹${(data.walletTransaction.closingBalancePaise / 100).toFixed(2)}` : '-'}
                      </p>
                    </div>
                  </div>
                  {data.commissionHistory && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Retailer Comm.</p>
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{data.commissionHistory.retailerCommissionAmount.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{data.commissionHistory.retailerCommissionPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Provider Comm.</p>
                        <p className="font-mono font-bold text-blue-600 dark:text-blue-400">₹{data.commissionHistory.providerCommissionAmount.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{data.commissionHistory.providerCommissionPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Company Profit</p>
                        <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{data.commissionHistory.companyProfitAmount.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{data.commissionHistory.companyProfitPercentage}%</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Provider Information */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    <Server className="w-4 h-4" /> Provider Information
                  </h3>
                  <button onClick={() => setShowJson(!showJson)} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                    <FileJson className="w-3 h-3" /> {showJson ? 'Hide JSON' : 'View Raw JSON'}
                  </button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider Route</p>
                      <p className="font-bold text-slate-900 dark:text-white">{data.recharge.providerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider Order ID</p>
                      <p className="font-mono font-medium text-slate-900 dark:text-white break-all">{data.recharge.providerTransactionId || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Operator Reference (API)</p>
                      <p className="font-mono font-medium text-primary break-all">{data.recharge.operatorReference || 'Pending'}</p>
                    </div>
                    {data.recharge.failureReason && (
                      <div className="col-span-2 pt-2 border-t border-rose-100 dark:border-rose-900/30">
                        <p className="text-xs text-rose-500 mb-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Failure Reason</p>
                        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{data.recharge.failureReason}</p>
                      </div>
                    )}
                  </div>

                  {showJson && data.recharge.providerResponse && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-muted-foreground mb-2">Raw API Response</p>
                      <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                        {JSON.stringify(data.recharge.providerResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </section>

              {/* Action Logs Timeline */}
              {data.actionLogs && data.actionLogs.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                    <History className="w-4 h-4" /> Admin Action Logs
                  </h3>
                  <div className="space-y-4 pl-2">
                    {data.actionLogs.map((log: any, idx: number) => (
                      <div key={idx} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 pb-2">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            By: <span className="font-medium text-slate-700 dark:text-slate-300">{log.adminId?.name}</span> ({log.adminId?.role})
                          </p>
                          <p className="text-sm text-slate-800 dark:text-slate-200 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-md border border-slate-100 dark:border-slate-800/60">
                            {log.remarks}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
