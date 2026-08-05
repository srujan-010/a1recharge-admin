"use client";

import { useWhatsAppAnalytics } from "@/hooks/useWhatsAppBusiness";
import { LineChart, CheckCircle2, AlertCircle, Send, Layers, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WhatsAppAnalyticsPage() {
  const { data: analytics, isLoading } = useWhatsAppAnalytics();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <LineChart className="w-6 h-6 text-emerald-500" /> WhatsApp Campaign Analytics
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Performance metrics, delivery success rates, and top template usage across your WhatsApp Business Cloud API.
        </p>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Campaigns</span>
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {isLoading ? "..." : analytics?.totalCampaigns || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Broadcasts & Event Messages</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Messages Sent</span>
            <Send className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {isLoading ? "..." : analytics?.totalSent || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Individual Retailer Deliveries</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Delivery Success Rate</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {isLoading ? "..." : `${analytics?.successRate || 100}%`}
          </div>
          <p className="text-xs text-slate-500 font-medium">Fast2SMS Cloud API Delivery</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Failed Deliveries</span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600 dark:text-red-400">
            {isLoading ? "..." : analytics?.failedCount || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Disconnected or Unregistered</p>
        </div>
      </div>

      {/* Top Templates Usage Breakdown */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" /> Most Used WhatsApp Templates
        </h3>

        {!analytics?.topTemplates || analytics.topTemplates.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-medium">
            No WhatsApp template usage data recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.topTemplates.map((item, idx) => (
              <div key={item._id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{item._id || "Unknown Template"}</h4>
                    <p className="text-xs text-slate-500 font-medium">{item.count} Campaign(s) Executed</p>
                  </div>
                </div>

                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-extrabold">
                  {item.totalSent} Total Delivered
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
