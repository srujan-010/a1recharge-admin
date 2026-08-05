"use client";

import { useState } from "react";
import { useWhatsAppSummary, useWhatsAppAnalytics } from "@/hooks/useWhatsAppBusiness";
import { 
  LineChart, CheckCircle2, AlertCircle, Send, Layers, 
  BarChart3, Clock, CheckCheck, Eye, RefreshCw 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Fast2SMSAnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data: summary, isLoading: summaryLoading, refetch } = useWhatsAppSummary(rangeDays);
  const { data: analytics } = useWhatsAppAnalytics();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <LineChart className="w-6 h-6 text-indigo-600" /> WhatsApp Campaign Analytics & Performance
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Real-time delivery rates, read rates, failure rates, and top template metrics across Fast2SMS WABA APIs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
            value={rangeDays}
            onChange={(e) => setRangeDays(parseInt(e.target.value, 10))}
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>

          <Button
            variant="outline"
            onClick={() => refetch()}
            className="h-11 px-4 text-xs font-bold gap-2 rounded-xl border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${summaryLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Calculated Rates Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[24px] text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">Delivery Rate</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-4xl font-black">
            {summaryLoading ? "..." : `${summary?.deliveryRate || 100}%`}
          </div>
          <p className="text-xs opacity-80 font-medium">Delivered to Retailer Handsets</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 rounded-[24px] text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">Read Rate</span>
            <Eye className="w-5 h-5" />
          </div>
          <div className="text-4xl font-black">
            {summaryLoading ? "..." : `${summary?.readRate || 0}%`}
          </div>
          <p className="text-xs opacity-80 font-medium font-sans">Opened & Viewed in WhatsApp</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 rounded-[24px] text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">Failure Rate</span>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="text-4xl font-black">
            {summaryLoading ? "..." : `${summary?.failureRate || 0}%`}
          </div>
          <p className="text-xs opacity-80 font-medium">Unreachable or Rejected Numbers</p>
        </div>

      </div>

      {/* Detailed Status Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Messages Sent</span>
            <Send className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {summaryLoading ? "..." : summary?.sent || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Total Messages Dispatched</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {summaryLoading ? "..." : summary?.delivered || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Handset Delivered</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Read by User</span>
            <CheckCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {summaryLoading ? "..." : summary?.read || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Blue Ticks Confirmed</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600 dark:text-red-400">
            {summaryLoading ? "..." : summary?.failed || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium">Delivery Failures</p>
        </div>

      </div>

      {/* Top Templates List */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Top WhatsApp Templates Performance
        </h3>

        {!summary?.topTemplates || summary.topTemplates.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-medium">
            No WhatsApp template usage data recorded for this time range.
          </div>
        ) : (
          <div className="space-y-3">
            {summary.topTemplates.map((item: any, idx: number) => (
              <div key={item._id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 font-black text-xs flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{item._id || "Unknown Template"}</h4>
                    <p className="text-xs text-slate-500 font-medium">{item.count} Campaign(s) Executed</p>
                  </div>
                </div>

                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-extrabold">
                  {item.totalSent} Delivered Messages
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
