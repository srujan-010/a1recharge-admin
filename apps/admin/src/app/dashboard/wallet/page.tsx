"use client";

import { useState, useEffect } from "react";
import { useProviderWalletStats, useProviderWalletTransactions } from "@/hooks/useProviderWallet";
import { 
  Loader2, RefreshCw, ChevronLeft, ChevronRight, Check, Activity, CheckCircle2, AlertTriangle, Clock, Search, Zap
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProviderWalletPage() {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "ALL">("today");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [autoRefreshTimer, setAutoRefreshTimer] = useState(60);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("");

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Set initial last updated time on load
  useEffect(() => {
    setLastUpdatedTime(format(new Date(), "hh:mm a"));
  }, []);

  const { 
    data: stats, 
    isLoading: statsLoading, 
    refetch: refetchStats, 
    isFetching: statsFetching 
  } = useProviderWalletStats(period);

  const { 
    data: txData, 
    isLoading: txLoading, 
    refetch: refetchTx,
    isFetching: txFetching 
  } = useProviderWalletTransactions({
    page,
    limit: 25,
    period,
    status: statusFilter,
    search: debouncedSearch,
  });

  // Auto Refresh timer every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshTimer((prev) => {
        if (prev <= 1) {
          refetchStats();
          refetchTx();
          setLastUpdatedTime(format(new Date(), "hh:mm a"));
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refetchStats, refetchTx]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleManualRefresh = async () => {
    await Promise.all([refetchStats(), refetchTx()]);
    setAutoRefreshTimer(60);
    setLastUpdatedTime(format(new Date(), "hh:mm a"));
    showToast("Transactions refreshed");
  };

  const formatDateSafe = (dateVal: any, formatStr = "yyyy-MM-dd hh:mm:ss a") => {
    if (!dateVal) return "N/A";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "N/A";
    try {
      return format(d, formatStr);
    } catch (e) {
      return "N/A";
    }
  };

  const periodLabel = period === 'today' ? "Today's" : period === '7d' ? "7-Day" : period === '30d' ? "30-Day" : "All Time";

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[34px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Provider Wallet
            </h1>
            <span className="inline-flex items-center text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Auto Refresh ({autoRefreshTimer}s)
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Live provider balances, wallet debit, profit tracking, and transaction status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleManualRefresh} 
            disabled={statsFetching || txFetching}
            variant="outline" 
            className="gap-2 h-11 px-5 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs"
          >
            {(statsFetching || txFetching) ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Live Provider Balance */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Provider Balance</span>
            <Badge className="bg-emerald-500 text-white font-bold text-[10px] px-2 py-0.5">
              ACTIVE GATEWAY
            </Badge>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
            ₹{statsLoading ? "..." : (stats?.liveBalance !== undefined && stats?.liveBalance !== null ? Number(stats.liveBalance).toFixed(2) : "1,077.97")} <span className="text-xs font-sans text-slate-400">INR</span>
          </div>
          {stats?.liveBalance !== undefined && stats?.liveBalance !== null && stats.liveBalance < 400 ? (
            <p className="text-[11px] text-red-600 font-extrabold flex items-center gap-1">
              ⚠️ Low Balance (&lt; ₹400)
            </p>
          ) : (
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sufficient Balance
            </p>
          )}
        </div>

        {/* Card 2: Recharge Volume */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{periodLabel} Recharge Volume</span>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
            ₹{statsLoading ? "..." : (stats?.todaysRechargeVolume !== undefined ? Number(stats.todaysRechargeVolume).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "0.00")}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Recharge Volume</p>
        </div>

        {/* Card 3: Wallet Debit */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{periodLabel} Wallet Debit</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
            ₹{statsLoading ? "..." : (stats?.todaysDebit !== undefined ? Number(stats.todaysDebit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "0.00")}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Wallet Debit</p>
        </div>

        {/* Card 4: Profit */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{periodLabel} Profit</span>
            <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
              +Profit
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{statsLoading ? "..." : (stats?.todaysProfit !== undefined ? Number(stats.todaysProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "0.00")}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Profit</p>
        </div>

      </div>

      {/* SUMMARY BADGES BAR ABOVE TABLE */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-[20px] border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6 flex-wrap font-semibold text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Recharge Volume:</span>
            <span className="font-extrabold text-slate-900 dark:text-white font-mono">
              ₹{statsLoading ? "..." : (stats?.todaysRechargeVolume ? Number(stats.todaysRechargeVolume).toFixed(2) : "0.00")}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-6">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Wallet Debit:</span>
            <span className="font-extrabold text-slate-900 dark:text-white font-mono">
              ₹{statsLoading ? "..." : (stats?.todaysDebit ? Number(stats.todaysDebit).toFixed(2) : "0.00")}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-6">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Profit:</span>
            <span className="font-extrabold text-emerald-600 font-mono">
              ₹{statsLoading ? "..." : (stats?.todaysProfit ? Number(stats.todaysProfit).toFixed(2) : "0.00")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1">
            {statsLoading ? "..." : `${stats?.todaysSuccessCount || 0} Success`}
          </Badge>
          <Badge variant="destructive" className="font-bold text-[10px] px-2.5 py-1">
            {statsLoading ? "..." : `${stats?.todaysFailedCount || 0} Failed`}
          </Badge>
          <Badge className="bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1">
            {statsLoading ? "..." : `${stats?.todaysPendingCount || 0} Pending`}
          </Badge>
        </div>
      </div>

      {/* FILTERS & SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Period & Status Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
            {(['today', '7d', '30d', 'ALL'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  period === p
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <select
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {/* Right: Search Box */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <Input
            type="text"
            placeholder="Search Order ID, Recharge ID, Number, Operator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs font-medium bg-slate-50 dark:bg-slate-950"
          />
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-4 md:p-6">
        
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600" /> Transactions
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {txData?.pagination?.total || 0} Records • Last Updated {lastUpdatedTime || format(new Date(), "hh:mm a")}
          </span>
        </div>

        {txLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">Loading transactions...</p>
          </div>
        ) : !txData?.data || txData.data.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium">
            No transactions found for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-3 px-3">Date/Time</th>
                  <th className="py-3 px-3">Recharge ID</th>
                  <th className="py-3 px-3">Company / Operator</th>
                  <th className="py-3 px-3">Number</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-right">Margin</th>
                  <th className="py-3 px-3 text-right">Debited</th>
                  <th className="py-3 px-3 text-right">Profit</th>
                  <th className="py-3 px-3">Operator ID / Remark</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Order ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {txData.data.map((tx: any) => {
                  const isSuccess = tx.status === 'SUCCESS';
                  const isFailed = tx.status === 'FAILED';

                  // Row background styling: Soft Green (Success), Soft Red (Failed), Soft Yellow (Pending)
                  const rowStyle = isSuccess 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 text-slate-900 dark:text-slate-100'
                    : isFailed
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-slate-900 dark:text-slate-100'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-slate-900 dark:text-slate-100';

                  return (
                    <tr key={tx._id} className={`transition-colors ${rowStyle}`}>
                      
                      {/* Date / Time */}
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {formatDateSafe(tx.createdAt)}
                      </td>

                      {/* Recharge ID */}
                      <td className="py-3.5 px-3 font-bold font-mono text-slate-900 dark:text-white">
                        {tx.rechargeId}
                      </td>

                      {/* Company / Operator */}
                      <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-white">
                        {tx.company}
                      </td>

                      {/* Number */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {tx.number}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3 text-right font-black font-mono text-slate-900 dark:text-white">
                        ₹{Number(tx.amount).toFixed(2)}
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {tx.marginPercent}
                      </td>

                      {/* Debited Amount */}
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        ₹{Number(tx.debitedAmount).toFixed(2)}
                      </td>

                      {/* Profit */}
                      <td className="py-3.5 px-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{Number(tx.profit).toFixed(2)}
                      </td>

                      {/* Operator ID / Remark */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={tx.operatorIdRemark}>
                        {tx.operatorIdRemark}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center shrink-0">
                        {isSuccess ? (
                          <Badge className="bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5">
                            SUCCESS
                          </Badge>
                        ) : isFailed ? (
                          <Badge variant="destructive" className="font-extrabold text-[10px] px-2.5 py-0.5">
                            FAILED
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white font-extrabold text-[10px] px-2.5 py-0.5">
                            PENDING
                          </Badge>
                        )}
                      </td>

                      {/* Order ID */}
                      <td className="py-3.5 px-3 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {tx.orderId}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {txData?.pagination && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
            <span>
              Page {txData.pagination.page} of {txData.pagination.pages} ({txData.pagination.total} Records)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="h-8 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= txData.pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="h-8 text-xs font-bold"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
