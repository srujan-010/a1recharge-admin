"use client";

import { LineChart, BarChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full pb-10">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-6">
          <LineChart className="w-6 h-6 text-orange-500" /> Delivery Analytics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50 flex items-center justify-center">
            <div className="text-center">
              <BarChart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">Delivery Success vs Failure (Last 30 Days)</p>
            </div>
          </div>
          <div className="h-64 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50 flex items-center justify-center">
            <div className="text-center">
              <LineChart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">Notification Open Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
