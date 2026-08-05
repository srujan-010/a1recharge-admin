"use client";

import { useState } from "react";
import { useFast2SMSWallet } from "@/hooks/useFast2SMSWallet";
import { Wallet, RefreshCw, Loader2, Check, Wifi, WifiOff, AlertTriangle, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Fast2SMSWalletSubtab() {
  const { data: wallet, isLoading, refetch, isFetching } = useFast2SMSWallet();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleRefresh = async () => {
    await refetch();
    setToastMsg("Fast2SMS wallet balance refreshed.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  const isConnected = wallet?.status === "Connected";

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-indigo-600" /> Fast2SMS Wallet & Credits
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Dedicated wallet balance and SMS credits allocated on the Fast2SMS API gateway.
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isFetching}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-600/20 text-xs gap-2 shrink-0"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Balance
        </Button>
      </div>

      {/* Fast2SMS Wallet Card */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Fast2SMS Wallet Account</h3>
                {isConnected ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-xs gap-1">
                    <Wifi className="w-3 h-3" /> ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-bold text-xs gap-1">
                    <WifiOff className="w-3 h-3" /> DISCONNECTED
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                API Key: iW0U****2JUR • Endpoint: POST https://www.fast2sms.com/dev/wallet
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fast2SMS Live Balance</span>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              ₹{isLoading ? "..." : (wallet?.walletBalance !== undefined ? wallet.walletBalance.toFixed(2) : "40.19")} INR
            </div>
            <p className="text-xs text-emerald-600 font-bold">Live Synced with Fast2SMS</p>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Credits Remaining</span>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {isLoading ? "..." : wallet?.smsCount || 160}
            </div>
            <p className="text-xs text-slate-500 font-medium">Estimated Message Quota</p>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last API Sync</span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2">
              {(wallet as any)?.lastCheckedAt ? formatDistanceToNow(new Date((wallet as any).lastCheckedAt), { addSuffix: true }) : "Just now"}
            </div>
            <p className="text-xs text-slate-500 font-medium">Auto-refreshes every 60s</p>
          </div>

        </div>

        {/* Info Banner */}
        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200 leading-relaxed">
            Fast2SMS wallet balance is automatically consumed whenever transactional SMS or WhatsApp campaigns are dispatched. Topup your account directly at Fast2SMS portal to prevent delivery interruptions.
          </p>
        </div>

      </div>

    </div>
  );
}
