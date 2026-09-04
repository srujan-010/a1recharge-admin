"use client";

import React, { useState } from "react";
import { 
  useTopRetailers, 
  TopRetailerItem 
} from "@/hooks/useTopRetailers";
import { 
  Trophy, 
  TrendingUp, 
  CheckCircle2, 
  Coins, 
  Users, 
  Download, 
  RefreshCw, 
  Calendar, 
  ArrowUpDown, 
  ChevronRight, 
  Smartphone, 
  Radio, 
  Wallet, 
  AlertCircle,
  Award,
  BarChart3,
  Percent
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountTypeFilter, AccountTypeFilterValue } from "@/components/ui/account-type-filter";
import { AccountTypeBadge } from "@/components/ui/account-type-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell 
} from "recharts";
import { TopRetailerDetailDrawer } from "./TopRetailerDetailDrawer";

export default function TopRetailersPage() {
  const [period, setPeriod] = useState<string>("today");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<'volume' | 'count' | 'commission' | 'successRate'>("volume");
  const [limit, setLimit] = useState<number>(10);
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilterValue>("all");

  const [selectedRetailer, setSelectedRetailer] = useState<TopRetailerItem | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch
  } = useTopRetailers({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    period,
    sortBy,
    sortOrder: 'desc',
    limit,
    accountType: accountTypeFilter,
  });

  const summary = data?.summary;
  const topRetailer = data?.topRetailer;
  const retailers = data?.retailers || [];

  // Period Shortcut Handler
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    setStartDate("");
    setEndDate("");
  };

  // Custom Date Change Handler
  const handleDateChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') setStartDate(val);
    if (type === 'end') setEndDate(val);
    setPeriod("custom");
  };

  // CSV Export Handler
  const exportCSV = () => {
    if (!retailers.length) return;
    const headers = [
      "Rank",
      "Retailer Name",
      "Retailer ID",
      "Account Type",
      "Successful Recharges",
      "Failed Recharges",
      "Success Rate (%)",
      "Gross Recharge Volume (INR)",
      "Commission Earned (INR)",
      "Average Recharge (INR)",
      "Mobile Recharge Volume (INR)",
      "DTH Recharge Volume (INR)",
      "Last Recharge Date"
    ];

    const rows = retailers.map((r: TopRetailerItem) => [
      `#${r.rank}`,
      r.name,
      r.retailerCode,
      r.accountType,
      r.successfulRecharges,
      r.failedRecharges,
      `${r.successRate}%`,
      (r.rechargeVolumePaise / 100).toFixed(2),
      (r.commissionPaise / 100).toFixed(2),
      (r.averageRechargePaise / 100).toFixed(2),
      (r.serviceBreakdown.mobile.volumePaise / 100).toFixed(2),
      (r.serviceBreakdown.dth.volumePaise / 100).toFixed(2),
      r.lastRechargeAt ? new Date(r.lastRechargeAt).toISOString() : "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `top_retailers_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare data for horizontal bar chart
  const chartData = retailers.map(r => ({
    name: r.name.length > 15 ? `${r.name.slice(0, 14)}…` : r.name,
    fullName: r.name,
    retailerCode: r.retailerCode,
    volumeRupees: parseFloat((r.rechargeVolumePaise / 100).toFixed(2)),
    count: r.successfulRecharges,
    commissionRupees: parseFloat((r.commissionPaise / 100).toFixed(2)),
    rank: r.rank,
  })).reverse(); // reverse so Rank 1 appears at top of horizontal chart

  const formatPeriodLabel = (p: string) => {
    switch (p) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'this_year': return 'This Year';
      case 'all': return 'All Time';
      case 'custom': return 'Custom Range';
      default: return p;
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20 animate-in fade-in duration-300">
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Top Retailers"
          description="Track retailer performance and identify your highest-volume retailers."
        />

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <Button
            onClick={exportCSV}
            disabled={!retailers.length || isLoading}
            variant="outline"
            className="h-10 text-xs font-bold gap-2 rounded-xl"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-xs gap-2 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Control Bar: Period, Filters, Sorting, Limits */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Left: Account Scope Filter */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Account Scope:</span>
          <AccountTypeFilter
            value={accountTypeFilter}
            onChange={(val) => setAccountTypeFilter(val)}
            showAll={true}
          />
        </div>

        {/* Right: Period Shortcuts, Custom Date, Sorting, Top N Limit */}
        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">
          
          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p.id && !startDate
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-0.5" />

          {/* Custom Date Range */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer font-semibold"
            />
            <span className="text-slate-400 font-bold">→</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer font-semibold"
            />
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-0.5" />

          {/* Sort By Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="volume">Recharge Volume</option>
              <option value="count">Recharge Count</option>
              <option value="commission">Commission</option>
              <option value="successRate">Success Rate</option>
            </select>
          </div>

          {/* Limit Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[5, 10, 20, 50].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  limit === n
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Unable to load retailer analytics. Please try again or adjust your date range.</span>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm" 
            className="text-xs font-bold border-rose-300 text-rose-700 hover:bg-rose-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 3. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recharge Volume */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Recharge Volume
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-white">
              ₹{((summary?.totalRechargeVolumePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
            Gross successful volume for {formatPeriodLabel(period)}
          </span>
        </div>

        {/* Successful Recharges */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Successful Recharges
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-white">
              {(summary?.successfulRechargeCount || 0).toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
            Authoritative completed recharges
          </span>
        </div>

        {/* Commission Generated */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Commission Generated
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
              ₹{((summary?.totalCommissionPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
            Historical retailer earnings
          </span>
        </div>

        {/* Active Retailers */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Retailers
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-white">
              {(summary?.activeRetailerCount || 0).toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
            Retailers with successful volume
          </span>
        </div>
      </div>

      {/* 4. Top Retailer Highlight Spotlight Card (Rank #1) */}
      {topRetailer && (
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl border border-indigo-500/20">
          <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            
            {/* Left: Retailer Details */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold tracking-wider uppercase">
                <Trophy className="w-4 h-4 text-amber-300" />
                TOP RETAILER • RANK #1
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  {topRetailer.name}
                  <AccountTypeBadge type={topRetailer.accountType} size="sm" />
                </h3>
                <div className="flex items-center gap-2 text-indigo-200/80 text-xs sm:text-sm font-mono mt-1">
                  <span>ID: {topRetailer.retailerCode}</span>
                  <span>•</span>
                  <span>Period: {formatPeriodLabel(period)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={() => setSelectedRetailer(topRetailer)}
                  size="sm"
                  className="bg-white hover:bg-indigo-50 text-indigo-950 font-bold text-xs rounded-xl shadow-sm"
                >
                  View Performance Breakdown
                </Button>
              </div>
            </div>

            {/* Right: Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 shrink-0">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right">
                <span className="text-[11px] text-indigo-200 block uppercase tracking-wider font-semibold">
                  Recharge Volume
                </span>
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-white block mt-0.5">
                  ₹{((topRetailer.rechargeVolumePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right">
                <span className="text-[11px] text-indigo-200 block uppercase tracking-wider font-semibold">
                  Successful
                </span>
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-emerald-400 block mt-0.5">
                  {topRetailer.successfulRecharges}
                </span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right col-span-2 sm:col-span-1">
                <span className="text-[11px] text-indigo-200 block uppercase tracking-wider font-semibold">
                  Commission
                </span>
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-amber-300 block mt-0.5">
                  ₹{((topRetailer.commissionPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. Horizontal Ranking Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Top {limit} Retailers by Recharge Volume
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Horizontal ranking representation formatted in Indian Rupees (INR)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">
              {formatPeriodLabel(period)}
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  tickFormatter={(val) => `₹${val.toLocaleString()}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                  width={110}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Recharge Volume']}
                  labelFormatter={(label: any, items: any) => {
                    const item = items?.[0]?.payload;
                    return item ? `${item.fullName} (${item.retailerCode}) • Rank #${item.rank}` : label;
                  }}
                  contentStyle={{
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="volumeRupees" radius={[0, 8, 8, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.rank === 1 ? '#4f46e5' : entry.rank === 2 ? '#6366f1' : entry.rank === 3 ? '#818cf8' : '#94a3b8'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. Top Retailers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Retailer Performance Table
            </h3>
            <Badge variant="secondary" className="text-xs font-mono font-semibold ml-2">
              {retailers.length} Retailers Ranked
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Click any retailer row for detailed performance drill-down
          </span>
        </div>

        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="w-16 text-center font-bold">Rank</TableHead>
              <TableHead className="font-bold">Retailer</TableHead>
              <TableHead className="text-center font-bold">Recharge Count</TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap min-w-[130px]">Recharge Volume</TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">Commission</TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">Average Recharge</TableHead>
              <TableHead className="text-center font-bold min-w-[120px]">Success Rate</TableHead>
              <TableHead className="w-12 text-center"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 text-primary" />
                    <p className="font-medium text-sm">Aggregating authoritative retailer analytics...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : retailers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground max-w-md mx-auto">
                    <AlertCircle className="w-10 h-10 mb-3 text-slate-400" />
                    <p className="font-bold text-base text-slate-800 dark:text-slate-200">
                      No successful recharge transactions for this period.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try selecting another period like "7 Days", "This Month", or "All Time" to view top retailers.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              retailers.map((retailer) => {
                const vol = (retailer.rechargeVolumePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const comm = (retailer.commissionPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const avg = (retailer.averageRechargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                return (
                  <TableRow
                    key={retailer.retailerId}
                    onClick={() => setSelectedRetailer(retailer)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <TableCell className="text-center font-bold">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold ${
                        retailer.rank === 1 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                          : retailer.rank === 2
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : retailer.rank === 3
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                              : 'text-slate-500 font-semibold'
                      }`}>
                        #{retailer.rank}
                      </span>
                    </TableCell>

                    {/* Retailer */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {retailer.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono font-medium">
                            {retailer.retailerCode}
                          </span>
                          <AccountTypeBadge type={retailer.accountType} size="sm" />
                        </div>
                      </div>
                    </TableCell>

                    {/* Recharge Count */}
                    <TableCell className="text-center font-mono font-bold text-sm">
                      <span className="text-slate-900 dark:text-white">
                        {retailer.successfulRecharges}
                      </span>
                      {retailer.failedRecharges > 0 && (
                        <span className="text-[10px] text-rose-500 block font-sans font-normal">
                          ({retailer.failedRecharges} failed)
                        </span>
                      )}
                    </TableCell>

                    {/* Recharge Volume */}
                    <TableCell className="text-right font-mono font-extrabold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                      ₹{vol}
                    </TableCell>

                    {/* Commission */}
                    <TableCell className="text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +₹{comm}
                    </TableCell>

                    {/* Average Recharge */}
                    <TableCell className="text-right font-mono font-semibold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      ₹{avg}
                    </TableCell>

                    {/* Success Rate */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {retailer.successRate}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              retailer.successRate >= 90 ? 'bg-emerald-500' : retailer.successRate >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${retailer.successRate}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-center text-slate-400 group-hover:text-primary transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Table Footer */}
        {retailers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Showing top <span className="font-bold text-slate-900 dark:text-white">{retailers.length}</span> retailers for <span className="font-bold text-slate-900 dark:text-white">{formatPeriodLabel(period)}</span>
            </span>
            <span className="font-mono font-medium">
              Ranked by: {sortBy.toUpperCase()} (DESC)
            </span>
          </div>
        )}
      </div>

      {/* 7. Retailer Detail Drawer */}
      <TopRetailerDetailDrawer
        retailer={selectedRetailer}
        periodName={period}
        onClose={() => setSelectedRetailer(null)}
      />

    </div>
  );
}
