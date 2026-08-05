"use client";

import Link from "next/link";
import { 
  useWabaStatus, 
  useWhatsAppHistory, 
  useSyncWhatsAppTemplates 
} from "@/hooks/useWhatsAppBusiness";
import { 
  MessageSquare, CheckCircle2, AlertCircle, RefreshCw, Send, 
  LayoutTemplate, ShieldCheck, Phone, Wallet, Layers, Zap, Clock, ExternalLink, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function WhatsAppDashboardPage() {
  const { data: statusData, isLoading, refetch } = useWabaStatus();
  const { data: history } = useWhatsAppHistory({ limit: 10 });
  const { mutate: syncTemplates, isPending: isSyncing } = useSyncWhatsAppTemplates();

  const waba = statusData?.waba;
  const wallet = statusData?.wallet;
  const isConnected = waba?.connection_status === 'CONNECTED';

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-6 rounded-[24px] border border-emerald-100 dark:border-emerald-900/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {waba?.verified_name || "A1recharge"} WABA
              </h2>
              {isConnected ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-bold text-[10px] gap-1">
                  <AlertCircle className="w-3 h-3" /> Disconnected
                </Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Official WhatsApp Business Cloud API • Connected Number: {waba?.number || "+91 9975600499"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh Status
          </Button>

          <Button
            onClick={() => syncTemplates()}
            disabled={isSyncing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5 rounded-xl shadow-lg shadow-emerald-600/20 text-xs gap-2"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Templates
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Connection Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Connection Status</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              {isConnected ? "ACTIVE" : "OFFLINE"}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Platform: {waba?.platform_type || "CLOUD_API"}
            </p>
          </div>
        </div>

        {/* Card 2: Quality Rating & Tier */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Messaging Tier</span>
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {waba?.messaging_limit || "TIER_2K"}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Quality: {waba?.quality_rating || "UNKNOWN"}
            </p>
          </div>
        </div>

        {/* Card 3: Connected Phone */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Phone Number</span>
            <Phone className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-black text-slate-900 dark:text-white truncate">
              {waba?.number || "+919975600499"}
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              ID: {waba?.phone_number_id || "1294250930429862"}
            </p>
          </div>
        </div>

        {/* Card 4: Wallet Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Fast2SMS Balance</span>
            <Wallet className="w-5 h-5 text-teal-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-slate-900 dark:text-white">
              ₹{wallet?.walletBalance !== undefined ? wallet.walletBalance.toFixed(2) : "40.19"} INR
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Est. SMS Credits: {wallet?.smsCount || 160}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link 
          href="/dashboard/whatsapp/send"
          className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500 transition-all space-y-3 group"
        >
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
              Send WhatsApp Campaign
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Dispatch broadcast messages or single notifications using approved Fast2SMS templates.
            </p>
          </div>
        </Link>

        <Link 
          href="/dashboard/whatsapp/templates"
          className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500 transition-all space-y-3 group"
        >
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
              Manage Templates
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Sync Meta-approved templates from Fast2SMS, view dynamic variables, and chat card previews.
            </p>
          </div>
        </Link>

        <Link 
          href="/dashboard/whatsapp/history"
          className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500 transition-all space-y-3 group"
        >
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
              Campaign History
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Track sent WhatsApp messages, request IDs, pipe variable values, and delivery statuses.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Campaign Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" /> Recent Sent WhatsApp Campaigns
          </h3>
          <Link href="/dashboard/whatsapp/history" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            View All History <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!history || history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-medium">
            No WhatsApp campaigns sent yet. Send your first WhatsApp broadcast!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">Template Name</th>
                  <th className="pb-3 px-3">Recipients</th>
                  <th className="pb-3 px-3">Variables Used</th>
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
