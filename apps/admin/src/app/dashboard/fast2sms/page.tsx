"use client";

import Link from "next/link";
import { useWabaStatus, useSyncWhatsAppTemplates, useWhatsAppHistory } from "@/hooks/useWhatsAppBusiness";
import { useFast2SMSWallet } from "@/hooks/useFast2SMSWallet";
import { 
  Send, Wallet, MessageSquare, Smartphone, CheckCircle2, 
  AlertCircle, RefreshCw, ShieldCheck, Layers, Clock, ExternalLink, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Fast2SMSDashboardPage() {
  const { data: statusData, isLoading: wabaLoading, refetch: refetchWaba } = useWabaStatus();
  const { data: fast2smsWallet, isLoading: walletLoading, refetch: refetchWallet } = useFast2SMSWallet();
  const { data: history } = useWhatsAppHistory({ limit: 10 });
  const { mutate: syncTemplates, isPending: isSyncing } = useSyncWhatsAppTemplates();

  const waba = statusData?.waba;
  const isWabaConnected = waba?.connection_status === 'CONNECTED';

  const handleRefresh = async () => {
    await Promise.all([refetchWaba(), refetchWallet()]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-indigo-900/10 via-purple-900/10 to-pink-900/10 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-pink-950/20 p-6 rounded-[24px] border border-indigo-200/60 dark:border-indigo-800/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Fast2SMS Gateway Platform
              </h2>
              <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> API ACTIVE
              </Badge>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Official Fast2SMS DLT SMS & Meta WABA WhatsApp Gateway • Key: iW0U****2JUR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${wabaLoading || walletLoading ? "animate-spin" : ""}`} /> Refresh Status
          </Button>

          <Button
            onClick={() => syncTemplates()}
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-5 rounded-xl shadow-lg shadow-indigo-600/20 text-xs gap-2"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Templates
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Fast2SMS Wallet Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Fast2SMS Balance</span>
            <Wallet className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              ₹{fast2smsWallet?.walletBalance !== undefined ? fast2smsWallet.walletBalance.toFixed(2) : "40.19"} INR
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Est. SMS Credits: {fast2smsWallet?.smsCount || 160}
            </p>
          </div>
        </div>

        {/* Card 2: WhatsApp WABA Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Status</span>
            <MessageSquare className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              {isWabaConnected ? "CONNECTED" : "OFFLINE"}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {waba?.verified_name || "A1recharge"} ({waba?.messaging_limit || "TIER_2K"})
            </p>
          </div>
        </div>

        {/* Card 3: Connected WABA Phone */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Connected Number</span>
            <Smartphone className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-black text-slate-900 dark:text-white truncate">
              {waba?.number || "+919975600499"}
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              WABA ID: {waba?.waba_id || "988843927460634"}
            </p>
          </div>
        </div>

        {/* Card 4: Quality Rating */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Quality Rating</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {waba?.quality_rating || "UNKNOWN"}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Platform: {waba?.platform_type || "CLOUD_API"}
            </p>
          </div>
        </div>
      </div>

      {/* Module Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        <Link 
          href="/dashboard/fast2sms/wallet"
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 transition-all space-y-2 group"
        >
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
            Fast2SMS Wallet
          </h3>
          <p className="text-xs text-slate-500">Dedicated Fast2SMS wallet & credit management (`POST /dev/wallet`)</p>
        </Link>

        <Link 
          href="/dashboard/fast2sms/sms"
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 transition-all space-y-2 group"
        >
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
            Fast2SMS DLT SMS
          </h3>
          <p className="text-xs text-slate-500">Dispatch transactional DLT SMS messages</p>
        </Link>

        <Link 
          href="/dashboard/fast2sms/whatsapp"
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 transition-all space-y-2 group"
        >
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
            WhatsApp WABA
          </h3>
          <p className="text-xs text-slate-500">WABA account details & status monitoring</p>
        </Link>

        <Link 
          href="/dashboard/fast2sms/templates"
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 transition-all space-y-2 group"
        >
          <div className="w-10 h-10 bg-pink-50 dark:bg-pink-500/10 text-pink-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Send className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
            Approved Templates
          </h3>
          <p className="text-xs text-slate-500">Synced Meta WABA templates & variable mapping</p>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Recent Fast2SMS Campaigns
          </h3>
          <Link href="/dashboard/fast2sms/campaigns" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View All Campaigns <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!history || history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-medium">
            No Fast2SMS campaigns dispatched yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">Template</th>
                  <th className="pb-3 px-3">Recipients</th>
                  <th className="pb-3 px-3">Variables (`val1|val2`)</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {log.templateName || "Unknown"}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-400">
                      {log.recipientCount} device(s)
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                      {log.variablesValues || "None"}
                    </td>
                    <td className="py-3.5 px-3">
                      {log.status === 'DELIVERED' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                          DELIVERED
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          FAILED
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-400">
                      {log.requestId || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
