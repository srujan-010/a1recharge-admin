"use client";

import { useWabaStatus } from "@/hooks/useWhatsAppBusiness";
import { MessageSquare, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Phone, Layers, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Fast2SMSWhatsAppSubtab() {
  const { data: statusData, isLoading, refetch } = useWabaStatus();

  const waba = statusData?.waba;
  const isConnected = waba?.connection_status === 'CONNECTED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-500" /> Meta WABA Account & Connection
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            WhatsApp Business Account details fetched live from Fast2SMS WABA Cloud API (`/dev/dlt_manager/whatsapp?type=number`).
          </p>
        </div>

        <Button
          onClick={() => refetch()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5 rounded-xl text-xs gap-2 shrink-0 shadow-lg shadow-emerald-600/20"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh WABA Details
        </Button>
      </div>

      {/* Details Card */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-emerald-500/20">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{waba?.verified_name || "A1recharge"}</h3>
                {isConnected ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3" /> CONNECTED
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-bold text-xs gap-1">
                    <AlertCircle className="w-3 h-3" /> DISCONNECTED
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Connected Mobile: {waba?.number || "+919975600499"}
              </p>
            </div>
          </div>
        </div>

        {/* Technical Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          
          <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WABA ID</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white">{waba?.waba_id || "988843927460634"}</p>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number ID</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white">{waba?.phone_number_id || "1294250930429862"}</p>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Messaging Tier Limit</span>
            <p className="font-black text-slate-900 dark:text-white text-base">{waba?.messaging_limit || "TIER_2K"}</p>
            <p className="text-xs text-slate-500 font-medium">Up to 2,000 unique business-initiated conversations / 24 hours</p>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Rating & Platform</span>
            <p className="font-black text-slate-900 dark:text-white text-base">{waba?.quality_rating || "UNKNOWN"}</p>
            <p className="text-xs text-slate-500 font-medium">Platform: {waba?.platform_type || "CLOUD_API"}</p>
          </div>

        </div>

      </div>

    </div>
  );
}
