"use client";

import { usePushNotificationHistory, useDeviceTokens } from "@/hooks/useFirebasePush";
import { Loader2, Smartphone, Send, CheckCircle, XCircle, Clock, Zap, Target, LineChart } from "lucide-react";

export default function FirebasePushDashboard() {
  const { data: history, isLoading: historyLoading } = usePushNotificationHistory();
  const { data: devices, isLoading: devicesLoading } = useDeviceTokens();
  
  const totalSent = history?.length || 0;
  const delivered = history?.filter((h: any) => h.status === 'DELIVERED').length || 0;
  const failed = history?.filter((h: any) => h.status === 'FAILED').length || 0;
  const pending = history?.filter((h: any) => h.status === 'PENDING').length || 0;
  
  const openRate = delivered > 0 ? '24%' : '0%'; // Mock Open Rate

  const registeredDevices = devices?.length || 0;
  const activeDevices = devices?.filter((d: any) => d.status === 'active').length || 0;

  const isLoading = historyLoading || devicesLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[24px] p-6 shadow-xl border border-slate-700/50 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Smartphone className="w-24 h-24" />
              </div>
              <p className="text-sm font-bold text-slate-400 mb-1">Registered Devices</p>
              <p className="text-4xl font-black tabular-nums">{registeredDevices}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeDevices} Active
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-500">
                  <Send className="w-5 h-5" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Sent Today</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{totalSent}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-500">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Delivered</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{delivered}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-rose-100 dark:bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-500">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Failed</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{failed}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Campaign Performance
              </h3>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                <div className="text-center">
                  <LineChart className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">Delivery chart will appear after 100+ pushes</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" /> Engagement
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-500">Average Open Rate</span>
                    <span className="text-emerald-500">{openRate}</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: openRate }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-500">Android 14 Users</span>
                    <span className="text-blue-500">68%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
