"use client";

import { useState } from "react";
import { 
  usePlanApiDashboard, 
  usePlanApiSyncLogs, 
  usePlanApiSettings, 
  useTriggerPlanApiRefresh, 
  useUpdatePlanApiSettings 
} from "@/hooks/usePlanApi";
import { 
  Cpu, Wallet, Activity, RefreshCw, CheckCircle2, AlertTriangle, 
  Clock, ShieldCheck, Download, Search, Settings, ArrowUpRight, 
  Bell, MessageSquare, Zap, Radio, Sliders, Loader2, FileSpreadsheet,
  AlertCircle, Server
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, LineChart, Line 
} from "recharts";

export default function PlanApiManagementCenter() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [triggeredFilter, setTriggeredFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Queries & Mutations
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = usePlanApiDashboard(period);
  const { data: logsData, isLoading: isLogsLoading } = usePlanApiSyncLogs({
    page,
    limit: 15,
    status: statusFilter,
    triggeredBy: triggeredFilter,
    search: searchTerm,
  });
  const { data: settingsData, refetch: refetchSettings } = usePlanApiSettings();

  const { mutate: refreshPlanApi, isPending: isRefreshing } = useTriggerPlanApiRefresh();
  const { mutate: updateSettings, isPending: isSavingSettings } = useUpdatePlanApiSettings();

  // Local state for settings form
  const [settingsForm, setSettingsForm] = useState<any>(null);

  const openSettingsDrawer = () => {
    if (settingsData) {
      setSettingsForm({
        lowBalanceWarning: settingsData.lowBalanceWarning,
        criticalBalance: settingsData.criticalBalance,
        lowRemainingHits: settingsData.lowRemainingHits,
        criticalRemainingHits: settingsData.criticalRemainingHits,
        enableWhatsAppAlerts: settingsData.enableWhatsAppAlerts,
        enablePushAlerts: settingsData.enablePushAlerts,
        enableInternalNotifications: settingsData.enableInternalNotifications,
        autoRefreshInterval: settingsData.autoRefreshInterval,
        alertRecipients: settingsData.alertRecipients.join(', '),
      });
    }
    setShowSettings(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;

    const recipientsArr = settingsForm.alertRecipients
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    updateSettings({
      lowBalanceWarning: Number(settingsForm.lowBalanceWarning),
      criticalBalance: Number(settingsForm.criticalBalance),
      lowRemainingHits: Number(settingsForm.lowRemainingHits),
      criticalRemainingHits: Number(settingsForm.criticalRemainingHits),
      enableWhatsAppAlerts: Boolean(settingsForm.enableWhatsAppAlerts),
      enablePushAlerts: Boolean(settingsForm.enablePushAlerts),
      enableInternalNotifications: Boolean(settingsForm.enableInternalNotifications),
      autoRefreshInterval: Number(settingsForm.autoRefreshInterval),
      alertRecipients: recipientsArr,
    }, {
      onSuccess: () => {
        toast.success('PlanAPI settings updated successfully');
        setShowSettings(false);
        refetchSettings();
      },
      onError: () => {
        toast.error('Failed to update PlanAPI settings');
      }
    });
  };

  const handleManualRefresh = () => {
    refreshPlanApi(undefined, {
      onSuccess: (data) => {
        if (data.data?.status === 'SUCCESS') {
          toast.success(`PlanAPI synced: Balance ₹${data.data.balance}, Hits ${data.data.remainingHits}`);
        } else {
          toast.error(data.message || 'PlanAPI sync failed');
        }
      },
      onError: () => {
        toast.error('Failed to trigger PlanAPI refresh');
      }
    });
  };

  // CSV Export Logic
  const handleExportCSV = () => {
    if (!logsData || !logsData.data) return;
    const headers = ["Synced Time", "Wallet Balance (₹)", "Remaining Hits", "Response Time (ms)", "Status", "Triggered By", "Error Message"];
    const rows = logsData.data.map((log) => [
      format(new Date(log.syncedAt), 'yyyy-MM-dd HH:mm:ss'),
      (Number(log.balance) || 0).toFixed(2),
      Number(log.remainingHits) || 0,
      Number(log.responseTime) || 0,
      log.status,
      log.triggeredBy,
      log.errorMessage ? `"${log.errorMessage.replace(/"/g, '""')}"` : ''
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `PlanAPI_Sync_History_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sync history exported to CSV');
  };

  // Safe metrics & statuses
  const latest = dashboardData?.latest;
  const stats = dashboardData?.stats;
  const settings = dashboardData?.settings;
  const history = dashboardData?.history || [];

  const isOnline = latest?.status === 'SUCCESS';
  const isOffline = latest?.status === 'OFFLINE';
  const balance = latest?.balance || 0;
  const remainingHits = latest?.remainingHits || 0;

  // Balance status indicator
  let balanceStatusPill = { label: 'Balance Healthy', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' };
  if (settings) {
    if (balance < settings.criticalBalance) {
      balanceStatusPill = { label: 'Critical Balance', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400' };
    } else if (balance < settings.lowBalanceWarning) {
      balanceStatusPill = { label: 'Low Balance Warning', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400' };
    }
  }

  // Remaining hits indicator & capacity
  const maxHitRef = Math.max(remainingHits, settings?.lowRemainingHits ? settings.lowRemainingHits * 5 : 50000);
  const hitPercentage = Math.min(100, Math.round((remainingHits / maxHitRef) * 100));

  let hitStatusPill = { label: 'Capacity Optimal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' };
  if (settings) {
    if (remainingHits < settings.criticalRemainingHits) {
      hitStatusPill = { label: 'Critical Capacity', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400' };
    } else if (remainingHits < settings.lowRemainingHits) {
      hitStatusPill = { label: 'Low Hits Warning', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400' };
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/20 p-6 rounded-[24px] border border-blue-200/60 dark:border-blue-800/40 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                PlanAPI Management Center
              </h1>
              {isOnline ? (
                <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 px-2.5 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> ONLINE
                </Badge>
              ) : isOffline ? (
                <Badge variant="destructive" className="font-bold text-[10px] gap-1 px-2.5 py-0.5">
                  <AlertTriangle className="w-3 h-3" /> OFFLINE
                </Badge>
              ) : (
                <Badge className="bg-amber-500 text-white font-bold text-[10px] gap-1 px-2.5 py-0.5">
                  <AlertCircle className="w-3 h-3" /> FAILED
                </Badge>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Independent Provider Module
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Real-time PlanAPI UserData API synchronization • 15-Minute Auto Refresh • Automated WhatsApp & Push Alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Button
            variant="outline"
            onClick={openSettingsDrawer}
            className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800 shadow-2xs"
          >
            <Sliders className="w-4 h-4 text-slate-500" /> Settings
          </Button>

          <Button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-5 rounded-xl shadow-lg shadow-blue-600/20 text-xs gap-2"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Top Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Wallet Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              PlanAPI Balance
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              ₹{(Number(balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge className={`text-[10px] font-bold ${balanceStatusPill.color}`}>
                {balanceStatusPill.label}
              </Badge>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Warning: ₹{settings?.lowBalanceWarning || 500}</span>
            <span>Critical: ₹{settings?.criticalBalance || 100}</span>
          </div>
        </div>

        {/* KPI 2: Remaining API Hits */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Remaining API Hits
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/40">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {(Number(remainingHits) || 0).toLocaleString('en-IN')}
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    remainingHits < (settings?.criticalRemainingHits || 200)
                      ? 'bg-rose-500'
                      : remainingHits < (settings?.lowRemainingHits || 1000)
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${hitPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>Usage Capacity</span>
                <span>{hitPercentage}% Est.</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <Badge className={`text-[10px] font-bold ${hitStatusPill.color}`}>
              {hitStatusPill.label}
            </Badge>
            <span>Limit: {settings?.lowRemainingHits || 1000}</span>
          </div>
        </div>

        {/* KPI 3: API Status & Connectivity */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              API Server Health
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/40">
              <Server className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {latest?.ipWhitelisted !== false ? "Server IP Whitelisted" : "IP Not Whitelisted"}
              </span>
              {latest?.ipWhitelisted !== false ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Credentials: <span className="font-bold text-slate-800 dark:text-slate-200">{latest?.credentialsValid !== false ? "Valid" : "Invalid"}</span> • Response: <span className="font-bold text-blue-600">{latest?.responseTime || 0} ms</span>
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Last Success:</span>
            <span className="font-bold text-emerald-600">
              {stats?.lastSuccessAt ? formatDistanceToNow(new Date(stats.lastSuccessAt), { addSuffix: true }) : "N/A"}
            </span>
          </div>
        </div>

        {/* KPI 4: Auto Sync Status */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Auto Sync Cycle
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/40">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
              {latest?.syncedAt ? formatDistanceToNow(new Date(latest.syncedAt), { addSuffix: true }) : "Never"}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Sync Mode: <span className="font-bold text-indigo-600">{latest?.triggeredBy || "AUTOMATIC"}</span>
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Interval: 15 Mins</span>
            <span className="text-emerald-600 font-bold">Cron Active</span>
          </div>
        </div>

      </div>

      {/* Quick Operational Stats Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today's Syncs</p>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
            {stats?.todaySyncsCount || 0}
          </p>
        </div>

        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Successful Syncs</p>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
            {stats?.successfulSyncsCount || 0}
          </p>
        </div>

        <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Failed Syncs</p>
          <p className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
            {stats?.failedSyncsCount || 0}
          </p>
        </div>

        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Avg Response Time</p>
          <p className="text-xl font-black text-blue-700 dark:text-blue-400 font-mono mt-0.5">
            {stats?.avgResponseTime || 0} ms
          </p>
        </div>

      </div>

      {/* Analytics Charts Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" /> PlanAPI Performance & History Analytics
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Historical wallet balance trends and remaining API hits capacity tracking
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                  period === p
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Chart 1: Balance History */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-500" /> Wallet Balance Trend (₹)
            </h3>
            <div className="h-[220px] w-full pt-2">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                  No sync history recorded for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="syncedAt" 
                      tickFormatter={(val: any) => val ? format(new Date(val), 'HH:mm') : ''}
                      stroke="#94a3b8" 
                      fontSize={10} 
                    />
                    <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip 
                      labelFormatter={(val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : ''}
                      formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Balance']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#balanceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Remaining Hits History */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" /> Remaining API Hits Trend
            </h3>
            <div className="h-[220px] w-full pt-2">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                  No sync history recorded for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="hitsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis 
                      dataKey="syncedAt" 
                      tickFormatter={(val: any) => val ? format(new Date(val), 'HH:mm') : ''}
                      stroke="#94a3b8" 
                      fontSize={10} 
                    />
                    <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip 
                      labelFormatter={(val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : ''}
                      formatter={(val: any) => [(Number(val) || 0).toLocaleString(), 'Remaining Hits']}
                    />
                    <Area type="monotone" dataKey="remainingHits" stroke="#9333ea" strokeWidth={2} fillOpacity={1} fill="url(#hitsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Sync History Logs Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-5">
        
        {/* Table Filters & Actions Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> PlanAPI Sync Logs & Audit History
          </h3>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search balance or error..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-9 h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>

            {/* Trigger Filter */}
            <select
              value={triggeredFilter}
              onChange={(e) => { setTriggeredFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Triggers</option>
              <option value="AUTOMATIC">AUTOMATIC</option>
              <option value="MANUAL">MANUAL</option>
            </select>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="h-10 px-4 font-bold text-xs gap-2 rounded-xl border-slate-200 dark:border-slate-800"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Table Content */}
        {isLogsLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Loading sync logs...</p>
          </div>
        ) : !logsData || logsData.data.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">
            No sync history records match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Sync Time</th>
                  <th className="pb-3 px-3">Wallet Balance</th>
                  <th className="pb-3 px-3">Remaining Hits</th>
                  <th className="pb-3 px-3">Response Time</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Triggered By</th>
                  <th className="pb-3 px-3">Notes / Error Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logsData.data.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  const isOffline = log.status === 'OFFLINE';

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/50 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {format(new Date(log.syncedAt), 'MMM dd, yyyy HH:mm:ss')}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        ₹{(Number(log.balance) || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {(Number(log.remainingHits) || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        {log.responseTime} ms
                      </td>
                      <td className="py-3.5 px-3">
                        {isSuccess ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> SUCCESS
                          </Badge>
                        ) : isOffline ? (
                          <Badge variant="destructive" className="text-[10px] font-bold gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> OFFLINE
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> FAILED
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          log.triggeredBy === 'MANUAL'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {log.triggeredBy}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-medium truncate max-w-[250px]">
                        {log.errorMessage || 'Successful synchronization'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {logsData && logsData.pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-semibold">
              Showing page {logsData.pagination.page} of {logsData.pagination.pages} ({logsData.pagination.total} total logs)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="h-8 text-xs font-bold rounded-lg"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= logsData.pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="h-8 text-xs font-bold rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Settings Modal / Drawer */}
      {showSettings && settingsForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" /> PlanAPI Threshold & Alert Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Low Balance Warning (₹)
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.lowBalanceWarning}
                    onChange={(e) => setSettingsForm({ ...settingsForm, lowBalanceWarning: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Critical Balance Threshold (₹)
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.criticalBalance}
                    onChange={(e) => setSettingsForm({ ...settingsForm, criticalBalance: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Low Remaining Hits Warning
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.lowRemainingHits}
                    onChange={(e) => setSettingsForm({ ...settingsForm, lowRemainingHits: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Critical Remaining Hits
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.criticalRemainingHits}
                    onChange={(e) => setSettingsForm({ ...settingsForm, criticalRemainingHits: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Auto Refresh Interval (Minutes)
                </label>
                <Input
                  type="number"
                  value={settingsForm.autoRefreshInterval}
                  onChange={(e) => setSettingsForm({ ...settingsForm, autoRefreshInterval: e.target.value })}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Notification Channels
                </p>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Fast2SMS WhatsApp Alerts</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.enableWhatsAppAlerts}
                    onChange={(e) => setSettingsForm({ ...settingsForm, enableWhatsAppAlerts: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Firebase Push Notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.enablePushAlerts}
                    onChange={(e) => setSettingsForm({ ...settingsForm, enablePushAlerts: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Internal Admin Notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.enableInternalNotifications}
                    onChange={(e) => setSettingsForm({ ...settingsForm, enableInternalNotifications: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alert Recipients (Comma Separated Phone Numbers)
                </label>
                <Input
                  value={settingsForm.alertRecipients}
                  onChange={(e) => setSettingsForm({ ...settingsForm, alertRecipients: e.target.value })}
                  placeholder="8275366399, 9100329521"
                  className="h-10 text-xs rounded-xl font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="h-10 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 text-xs rounded-xl shadow-md"
                >
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
