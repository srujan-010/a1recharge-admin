"use client";

import { Wallet, RefreshCw, ServerCrash, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useProviderBalance } from '@/hooks/useProviderBalance';
import { formatDistanceToNow } from 'date-fns';

export function LiveProviderCard({ providerName = 'A1Topup' }: { providerName?: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useProviderBalance(providerName);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden flex flex-col justify-between space-y-4">
      
      {/* Top Bar: Icon Container & Sync Button */}
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/40 shadow-2xs">
          <Wallet className="w-6 h-6" />
        </div>

        <div className="flex items-center gap-2">
          {data?.status === 'online' && (
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              ONLINE
            </span>
          )}
          {(data?.status === 'offline' || isError) && (
            <span className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
              OFFLINE
            </span>
          )}
          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sync Provider Balance"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Metric Section: Value FIRST, Label SECOND */}
      {isLoading ? (
        <div className="space-y-2 py-1">
          <div className="h-9 w-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : isError ? (
        <div className="space-y-1.5 py-1">
          <div className="flex items-center text-rose-500 gap-2">
            <ServerCrash className="h-5 w-5 shrink-0" />
            <span className="text-sm font-bold">Provider Offline</span>
          </div>
          <p className="text-xs text-slate-500 truncate" title={(error as any)?.response?.data?.message || error.message}>
            {(error as any)?.response?.data?.message || 'Network error or provider unreachable.'}
          </p>
        </div>
      ) : data?.success === false ? (
        <div className="space-y-1.5 py-1">
          <div className="flex items-center text-amber-600 gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-bold">Authentication Failed</span>
          </div>
          <p className="text-xs text-slate-500 truncate" title={data.message}>
            {data.message || 'Provider API error.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-3xl lg:text-4xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
            ₹{typeof data?.balance === 'number' 
              ? data.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : 'N/A'
            }
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {providerName} API Wallet
          </p>
        </div>
      )}

      {/* Footer Timestamp */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Live Balance
        </span>
        {data?.lastUpdated && (
          <span className="text-[11px] text-slate-400 font-mono">
            {formatDistanceToNow(new Date(data.lastUpdated), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
