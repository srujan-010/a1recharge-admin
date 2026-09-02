"use client";

import { useState } from "react";
import { 
  useExecutiveDashboardReport, 
  useLedgerReport,
  usePaymentOverview,
  OperatorPerformanceRow,
  DailyPerformanceRow 
} from "@/hooks/useReports";
import { 
  FileSpreadsheet, Download, Calendar, Loader2, Activity, 
  TrendingUp, Wallet, ShieldCheck, RefreshCw, ArrowUpRight, 
  ArrowDownRight, Layers, BarChart3, PieChart, Users, Building2,
  CheckCircle2, XCircle, Clock, Zap, Award, CreditCard, QrCode
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountTypeFilter, AccountTypeFilterValue } from "@/components/ui/account-type-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, BarChart, Bar 
} from "recharts";

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilterValue>("all");

  const { 
    data, 
    isLoading, 
    isFetching, 
    isError, 
    refetch 
  } = useExecutiveDashboardReport({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    period,
    accountType: accountTypeFilter
  });

  const summary = data?.summary;
  const personalVsBusiness = data?.personalVsBusiness;
  const dailyPerformance = data?.dailyPerformance || [];
  const operatorPerformance = data?.operatorPerformance || [];
  const periodComparison = data?.periodComparison;

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
    setPeriod(""); // Clear period shortcut when using custom date range
  };

  // CSV Export Helpers
  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${accountTypeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Export Financial Summary
  const exportFinancialReport = () => {
    if (!summary) return;
    const headers = ["Metric", "Value"];
    const rows = [
      ["Recharge Volume (INR)", summary.rechargeVolume],
      ["Provider Commission Received (INR)", summary.providerCommission],
      ["Retailer Commission Paid (INR)", summary.retailerCommission],
      ["Net Company Profit (INR)", summary.netProfit],
      ["Personal Commission (INR)", summary.personalCommRupees],
      ["Business Commission (INR)", summary.businessCommRupees],
      ["Successful Recharges", summary.successCount],
      ["Failed Recharges", summary.failedCount],
      ["Pending Recharges", summary.pendingCount],
      ["Total Transactions", summary.totalCount],
      ["Success Rate (%)", `${summary.successRate}%`],
      ["Avg Profit per Success Tx (INR)", summary.avgProfitPerSuccessTx],
      ["Profit Margin (%)", `${summary.profitMarginPct}%`]
    ];
    downloadCSV("financial_executive_summary", headers, rows);
  };

  // 2. Export Daily Summary
  const exportDailySummary = () => {
    if (!dailyPerformance.length) return;
    const headers = ["Date", "Recharge Volume (INR)", "Provider Comm (INR)", "Retailer Comm (INR)", "Company Profit (INR)", "Successful", "Failed", "Pending", "Total", "Success Rate (%)"];
    const rows = dailyPerformance.map((row: DailyPerformanceRow) => [
      row.date,
      row.rechargeVolume,
      row.providerCommission,
      row.retailerCommission,
      row.companyProfit,
      row.successful,
      row.failed,
      row.pending,
      row.total,
      `${row.successRate}%`
    ]);
    downloadCSV("daily_financial_summary", headers, rows);
  };

  // 3. Export Operator Report
  const exportOperatorReport = () => {
    if (!operatorPerformance.length) return;
    const headers = ["Operator Code", "Operator Name", "Recharge Volume (INR)", "Total Tx", "Successful", "Failed", "Pending", "Success Rate (%)", "Provider Comm (INR)", "Retailer Comm (INR)", "Company Profit (INR)"];
    const rows = operatorPerformance.map((op: OperatorPerformanceRow) => [
      op.operatorCode,
      op.operatorName,
      op.rechargeVolume,
      op.total,
      op.successful,
      op.failed,
      op.pending,
      `${op.successRate}%`,
      op.providerCommission,
      op.retailerCommission,
      op.companyProfit
    ]);
    downloadCSV("operator_performance_report", headers, rows);
  };

  const { data: paymentOverview } = usePaymentOverview({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    period,
    accountType: accountTypeFilter
  });

  // 5. Export Payment Type Overview Report
  const exportPaymentReport = () => {
    if (!paymentOverview) return;
    const headers = ["Metric / Payment Type", "Transaction Count", "Volume (INR)"];
    const rows = [
      ["UPI Total Collections", paymentOverview.upiOverview.successCount, paymentOverview.upiOverview.totalCollectionsRupees],
      ["UPI Pending", paymentOverview.upiOverview.pendingCount, paymentOverview.upiOverview.pendingAmountRupees],
      ["UPI Failed", paymentOverview.upiOverview.failedCount, paymentOverview.upiOverview.failedAmountRupees],
      ["Wallet Total Credits", paymentOverview.walletOverview.totalCount, paymentOverview.walletOverview.totalCreditsRupees],
      ["Wallet Total Debits", paymentOverview.walletOverview.totalCount, paymentOverview.walletOverview.totalDebitsRupees],
      ["Wallet Net Movement", "-", paymentOverview.walletOverview.netMovementRupees],
      ...paymentOverview.paymentTypeBreakdown.map(b => [b.paymentType, b.count, b.volumeRupees])
    ];
    downloadCSV("payment_type_overview_report", headers, rows);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20 animate-in fade-in duration-300">
      
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Financial & Business Reports"
          description="Executive management dashboard, platform revenue analytics, operator performance, and net profitability metrics."
        />

        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-5 rounded-xl shadow-md shadow-indigo-600/20 text-xs gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh Report Data
        </Button>
      </div>

      {/* Control Bar: Account Type (Far Left) vs Day Filter & Date Range (Far Right) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Far Left: Account Scope Filter */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Account Scope:</span>
          <AccountTypeFilter
            value={accountTypeFilter}
            onChange={(val) => setAccountTypeFilter(val)}
            showAll={true}
          />
        </div>

        {/* Far Right: Day Filter Shortcuts + Custom Date Range */}
        <div className="flex flex-wrap items-center justify-start md:justify-end gap-3 w-full md:w-auto">
          
          {/* Quick Day Shortcuts */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p.id && !startDate
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-0.5" />

          {/* Custom Date Range */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
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
        </div>
      </div>

      {/* Error Banner State */}
      {isError ? (
        <div className="p-8 bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900/50 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-rose-800 dark:text-rose-300">Unable to Load Financial Report Data</h3>
          <p className="text-xs font-medium text-slate-500 max-w-md">There was a server exception retrieving executive financial metrics for the selected filters.</p>
          <Button onClick={() => refetch()} variant="outline" className="h-10 px-5 font-bold text-xs rounded-xl border-rose-300">
            Retry Loading
          </Button>
        </div>
      ) : (
        <>
          {/* Section 1: Financial Overview (4 Primary Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Total Recharge Volume */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Recharge Volume</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              {isLoading ? (
                <div className="py-2 text-slate-400 text-xs font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading...</div>
              ) : (
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white leading-none">
                    ₹{Number(summary?.rechargeVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Gross volume in selected period
                  </p>
                </div>
              )}
            </div>

            {/* Card 2: Provider Commission Received */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Provider Comm. Received</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              {isLoading ? (
                <div className="py-2 text-slate-400 text-xs font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Loading...</div>
              ) : (
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 leading-none">
                    ₹{Number(summary?.providerCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Total commission from providers
                  </p>
                </div>
              )}
            </div>

            {/* Card 3: Retailer Commission Paid */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Retailer Comm. Paid</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              {isLoading ? (
                <div className="py-2 text-slate-400 text-xs font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-amber-600" /> Loading...</div>
              ) : (
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 leading-none">
                    ₹{Number(summary?.retailerCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Commission paid out to retailers
                  </p>
                </div>
              )}
            </div>

            {/* Card 4: Net Company Profit */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-md shadow-emerald-500/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Net Company Profit</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              {isLoading ? (
                <div className="py-2 text-slate-400 text-xs font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading...</div>
              ) : (
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                    ₹{Number(summary?.netProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Provider comm. − Retailer comm.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Transaction Health / Operational Status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful</p>
                <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white leading-tight">{summary?.successCount || 0}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed</p>
                <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white leading-tight">{summary?.failedCount || 0}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white leading-tight">{summary?.pendingCount || 0}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recharges</p>
                <p className="text-lg font-extrabold font-mono text-slate-900 dark:text-white leading-tight">{summary?.totalCount || 0}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Success Rate</p>
                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight">{summary?.successRate || 0}%</p>
              </div>
            </div>
          </div>

          {/* Section 3: Personal vs Business Performance Comparison */}
          <div className="space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" /> Personal vs Business Performance
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Personal Accounts Panel */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">PERSONAL ACCOUNTS</h4>
                      <p className="text-xs text-slate-500 font-medium">Retailers with Personal KYC profile</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold px-2.5 py-1">
                    {personalVsBusiness?.PERSONAL?.successCount || 0} Tx
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Recharge Volume</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white leading-tight">
                      ₹{personalVsBusiness?.PERSONAL?.rechargeVolume?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Net Profit</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
                      ₹{personalVsBusiness?.PERSONAL?.companyProfit?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Provider Comm.</p>
                    <p className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                      ₹{personalVsBusiness?.PERSONAL?.providerCommission?.toFixed(2) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Retailer Comm.</p>
                    <p className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                      ₹{personalVsBusiness?.PERSONAL?.retailerCommission?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Accounts Panel */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">BUSINESS ACCOUNTS</h4>
                      <p className="text-xs text-slate-500 font-medium">Enterprise & GST Registered Retailers</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold px-2.5 py-1">
                    {personalVsBusiness?.BUSINESS?.successCount || 0} Tx
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Recharge Volume</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white leading-tight">
                      ₹{personalVsBusiness?.BUSINESS?.rechargeVolume?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Net Profit</p>
                    <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
                      ₹{personalVsBusiness?.BUSINESS?.companyProfit?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Provider Comm.</p>
                    <p className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                      ₹{personalVsBusiness?.BUSINESS?.providerCommission?.toFixed(2) || '0.00'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Retailer Comm.</p>
                    <p className="text-base font-bold font-mono text-purple-600 dark:text-purple-400">
                      ₹{personalVsBusiness?.BUSINESS?.retailerCommission?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 4: Daily Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Daily Financial Performance Area Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" /> Daily Financial Performance
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Recharge volume and net company profit trend across date range</p>
                </div>
              </div>

              <div className="h-[280px] w-full pt-2">
                {dailyPerformance.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No activity for chart in selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415515" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                        formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, '']}
                      />
                      <Area type="monotone" dataKey="rechargeVolume" name="Recharge Volume" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                      <Area type="monotone" dataKey="companyProfit" name="Net Company Profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Daily Transaction Volume Bar Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" /> Transaction Health
                </h3>
                <p className="text-xs text-slate-500 font-medium">Daily count of successful vs failed transactions</p>
              </div>

              <div className="h-[280px] w-full pt-2">
                {dailyPerformance.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No transactions in selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415515" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                      <Bar dataKey="successful" name="Successful" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="failed" name="Failed" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Profit Analysis & Period Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Profit Analysis Panel */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" /> Profitability & Margin Analysis
              </h3>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Average Profit / Tx</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ₹{summary?.avgProfitPerSuccessTx?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Per successful recharge</p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Platform Profit Margin</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {summary?.profitMarginPct || 0}%
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Net profit / total volume</p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Provider Comm. Earned</span>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
                    ₹{summary?.providerCommission || '0.00'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Retailer Comm. Payout</span>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                    ₹{summary?.retailerCommission || '0.00'}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Comparison Panel */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Period-over-Period Growth
                </h3>
                <span className="text-[11px] font-bold text-slate-400">vs Prior Equivalent Period</span>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { label: "Recharge Volume", metric: periodComparison?.rechargeVolume, prefix: "₹" },
                  { label: "Net Company Profit", metric: periodComparison?.companyProfit, prefix: "₹" },
                  { label: "Successful Transactions", metric: periodComparison?.transactions, prefix: "" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.label}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {item.prefix}{item.metric?.current?.toLocaleString('en-IN', { minimumFractionDigits: item.prefix ? 2 : 0 })} vs {item.prefix}{item.metric?.previous?.toLocaleString('en-IN', { minimumFractionDigits: item.prefix ? 2 : 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.metric?.diff !== undefined && (
                        <Badge className={`font-bold gap-1 ${
                          item.metric.diff >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {item.metric.diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {item.metric.pct >= 0 ? `+${item.metric.pct}%` : `${item.metric.pct}%`}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Section 6: Operator Performance Aggregated Management Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" /> Operator Performance & Volume Breakdown
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Aggregated metrics by mobile and DTH operator</p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {operatorPerformance.length} Operators Active
              </span>
            </div>

            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="font-semibold text-xs">Operator</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Recharge Volume (₹)</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Total Tx</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Success Rate</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Provider Comm. (₹)</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Retailer Comm. (₹)</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Net Profit (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold">Loading operator performance...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : operatorPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs italic">
                      No operator activity for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  operatorPerformance.map((op) => (
                    <TableRow key={op.operatorCode} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <TableCell className="font-bold text-xs text-slate-900 dark:text-white">
                        {op.operatorName} <span className="text-[10px] text-slate-400 font-mono ml-1">({op.operatorCode})</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                        ₹{op.rechargeVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{op.total}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.successRate >= 90 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                        }`}>
                          {op.successRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                        ₹{(Number(op.providerCommission) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ₹{(Number(op.retailerCommission) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{(Number(op.companyProfit) || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Section 7: Report Exports */}
          <div className="space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" /> Export Executive Reports
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Executive Summary Report</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">High-level financial KPIs & profit summary.</p>
                </div>
                <Button onClick={exportFinancialReport} disabled={!summary} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Financial CSV
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Daily Summary Report</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Date-wise volume, comm & profit breakdown.</p>
                </div>
                <Button onClick={exportDailySummary} disabled={!dailyPerformance.length} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Daily CSV
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Operator Performance Report</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Operator-wise volume & success rates.</p>
                </div>
                <Button onClick={exportOperatorReport} disabled={!operatorPerformance.length} className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Operator CSV
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Payment Method & Source Report</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Wallet vs UPI collections & payment source breakdown.</p>
                </div>
                <Button onClick={exportPaymentReport} disabled={!paymentOverview} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export Payment CSV
                </Button>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
