import React, { useState } from 'react';
import { X, Loader2, Clock, Smartphone, Wallet, Server, ShieldAlert, History, Activity, FileJson, Lock, Unlock, FileText } from 'lucide-react';
import { useRechargeDetails } from '@/hooks/useTransactions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPaymentMethod, getPaymentStatus } from '@/lib/paymentUtils';
import { AccountTypeBadge } from '@/components/ui/account-type-badge';

export function TransactionDetailsDrawer({ orderId, onClose }: { orderId: string | null, onClose: () => void }) {
  const { data, isLoading } = useRechargeDetails(orderId || '');
  const [showJson, setShowJson] = useState(false);

  if (!orderId) return null;

  const maskPhone = (phone?: string) => {
    if (!phone) return '-';
    return phone.length > 5 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-slate-950 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transaction Control & Audit</h2>
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
              <p className="font-medium text-sm">Fetching transaction audit details...</p>
            </div>
          ) : !data ? (
            <div className="text-center text-rose-500 py-12 font-semibold">Failed to load details.</div>
          ) : (
            <>
              {/* Recharge Information */}
              <section>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  <Smartphone className="w-4 h-4" /> Recharge Overview
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transaction Status</p>
                    <Badge variant={
                      data.recharge.status === 'SUCCESS' ? 'success' :
                      data.recharge.status === 'FAILED' ? 'error' :
                      data.recharge.status === 'REFUNDED' ? 'warning' : 'info'
                    } className="uppercase font-bold">{data.recharge.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Account Type</p>
                    <AccountTypeBadge type={data.recharge.accountType || data.recharge.userId?.accountType} size="sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Recharge Amount</p>
                    <p className="font-mono font-bold text-lg text-slate-900 dark:text-white">₹{data.recharge.amount?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mobile / DTH Number</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">{maskPhone(data.recharge.mobileNumber)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Operator & Circle</p>
                    <p className="font-bold text-slate-900 dark:text-white">{data.recharge.operatorCode} / {data.recharge.circleCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                    <div className="font-bold text-slate-900 dark:text-white capitalize flex items-center gap-1.5">
                      {(() => {
                        const pm = getPaymentMethod(data.recharge);
                        let badgeColor = "border-slate-300 text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300";
                        if (pm === 'WALLET') badgeColor = "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400";
                        if (pm === 'UPI') badgeColor = "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400";
                        if (pm === 'BANK_TRANSFER') badgeColor = "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400";
                        return (
                          <Badge variant="outline" className={`uppercase font-bold text-[11px] ${badgeColor}`}>
                            {pm}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {getPaymentStatus(data.recharge)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Hold Status</p>
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      {data.recharge.reservedAmount > 0 ? (
                        <span className="text-amber-600 flex items-center gap-1 text-xs font-bold"><Lock className="w-3 h-3" /> ₹{data.recharge.reservedAmount} HELD</span>
                      ) : (
                        <span className="text-slate-500 text-xs font-normal">RELEASED / NONE</span>
                      )}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-muted-foreground mb-1">Retailer</p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {data.recharge.userId?.name} <span className="text-muted-foreground font-normal">({data.recharge.userId?.retailerId})</span>
                    </p>
                  </div>
                </div>

                {/* Factual Payment Audit Box */}
                <div className="mt-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                    <span>Payment Audit Details</span>
                    <span className="font-mono text-[10px] text-muted-foreground">Backend Source of Truth</span>
                  </div>
                  {(() => {
                    const pm = getPaymentMethod(data.recharge);
                    const rawStatus = getPaymentStatus(data.recharge);

                    if (pm === 'UPI') {
                      const utr = data.walletTransaction?.upiDetails?.utr || data.recharge?.upiDetails?.utr || 'Not Available';
                      const gateway = data.walletTransaction?.upiDetails?.gateway || 'UPI Gateway';
                      const pgOrderId = data.walletTransaction?.upiDetails?.gatewayOrderId || data.recharge?.razorpayOrderId || 'Not Available';
                      return (
                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 font-mono">
                          <div>Payment Method: <span className="font-bold text-emerald-600 dark:text-emerald-400">UPI</span></div>
                          <div>Payment Status: <span className="font-bold text-slate-900 dark:text-white">{rawStatus}</span></div>
                          <div>UTR / UPI ID: <span className="font-bold text-slate-900 dark:text-white">{utr}</span></div>
                          <div>Gateway: <span className="font-bold text-slate-900 dark:text-white">{gateway}</span></div>
                          <div className="col-span-2">PG Order Ref: <span className="font-bold text-slate-900 dark:text-white">{pgOrderId}</span></div>
                        </div>
                      );
                    } else if (pm === 'WALLET') {
                      const closingBal = data.walletTransaction?.closingBalancePaise 
                        ? `₹${(data.walletTransaction.closingBalancePaise / 100).toFixed(2)}` 
                        : 'Recorded in Ledger';
                      return (
                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 font-mono">
                          <div>Payment Method: <span className="font-bold text-blue-600 dark:text-blue-400">WALLET</span></div>
                          <div>Payment Status: <span className="font-bold text-slate-900 dark:text-white">{rawStatus}</span></div>
                          <div className="col-span-2">Closing Balance: <span className="font-bold text-slate-900 dark:text-white">{closingBal}</span></div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-1 text-slate-600 dark:text-slate-400 font-mono">
                          <div>Payment Method: <span className="font-bold text-slate-900 dark:text-white">{pm}</span></div>
                          <div>Payment Status: <span className="font-bold text-slate-900 dark:text-white">{rawStatus}</span></div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </section>

              {/* Wallet Information */}
              <section>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  <Wallet className="w-4 h-4" /> Retailer Real Wallet Balance & Ledger
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Available</p>
                      <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {data.wallet ? `₹${data.wallet.balance.toFixed(2)}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Currently Held</p>
                      <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {data.wallet ? `₹${data.wallet.onHold.toFixed(2)}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Wallet Debited</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">
                        {data.walletTransaction ? `₹${(data.walletTransaction.amountPaise / 100).toFixed(2)}` : '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Refund Status</p>
                      <p className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        {data.recharge.refundStatus ? 'YES (REFUNDED)' : 'NO'}
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

              {/* Wallet Ledger Entries */}
              {data.walletLedgers && data.walletLedgers.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    <FileText className="w-4 h-4" /> Wallet Ledger Entries
                  </h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-3">
                    {data.walletLedgers.map((ledger: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0 text-xs">
                        <div>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase mr-2 ${ledger.transactionType === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {ledger.referenceType || ledger.transactionType}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">{ledger.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">₹{ledger.amount?.toFixed(2)}</span>
                          <p className="text-[10px] text-muted-foreground">Bal: ₹{ledger.balanceAfter?.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Provider Information */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Server className="w-4 h-4" /> Provider Details & Raw API Response
                  </h3>
                  <button onClick={() => setShowJson(!showJson)} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                    <FileJson className="w-3.5 h-3.5" /> {showJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                  </button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider Route</p>
                      <p className="font-bold text-slate-900 dark:text-white">{data.recharge.providerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider Reference ID</p>
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
                      <p className="text-xs text-muted-foreground mb-2">Raw Provider Response</p>
                      <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                        {JSON.stringify(data.recharge.providerResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </section>

              {/* Admin Action & Audit History Timeline */}
              <section>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  <History className="w-4 h-4" /> Admin Action & Audit Timeline
                </h3>
                {(!data.actionLogs || data.actionLogs.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No manual admin actions logged for this transaction yet.</p>
                ) : (
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
                            By: <span className="font-medium text-slate-700 dark:text-slate-300">{log.adminId?.name || 'Admin'}</span> ({log.adminId?.role || 'Admin'})
                          </p>
                          <p className="text-sm text-slate-800 dark:text-slate-200 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-md border border-slate-100 dark:border-slate-800/60 font-medium">
                            {log.remarks}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
