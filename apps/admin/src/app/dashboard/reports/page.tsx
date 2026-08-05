"use client";

import { useState } from "react";
import { useTransactionReport, useLedgerReport, TransactionReportRow, LedgerReportRow } from "@/hooks/useReports";
import { FileSpreadsheet, Download, Calendar, Loader2, PieChart, Activity } from "lucide-react";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { data: txData, isLoading: txLoading, isFetching: txFetching } = useTransactionReport(startDate, endDate);
  const { data: ledgerData, isLoading: ledgerLoading, isFetching: ledgerFetching } = useLedgerReport(startDate, endDate);

  // --- CSV Export Logic ---
  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(String).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTransactions = () => {
    if (!txData) return;
    const headers = ["Date", "Service", "Status", "Total Count", "Total Amount (Rupees)", "Total Commission (Rupees)"];
    const rows = txData.map((row: TransactionReportRow) => [
      row.date,
      row.service,
      row.status,
      row.totalCount,
      (row.totalAmountPaise / 100).toFixed(2),
      (row.totalCommissionPaise / 100).toFixed(2)
    ]);
    downloadCSV("transactions_report", headers, rows);
  };

  const exportLedger = () => {
    if (!ledgerData) return;
    const headers = ["Date", "Type", "Transaction Type", "Total Count", "Total Amount (Rupees)"];
    const rows = ledgerData.map((row: LedgerReportRow) => [
      row.date,
      row.type.toUpperCase(),
      row.transactionType,
      row.totalCount,
      (row.totalAmountPaise / 100).toFixed(2)
    ]);
    downloadCSV("ledger_report", headers, rows);
  };

  // --- Calculate Summaries ---
  const totalTxVolume = txData?.reduce((sum, r) => sum + r.totalAmountPaise, 0) || 0;
  const totalCommEarned = txData?.reduce((sum, r) => sum + r.totalCommissionPaise, 0) || 0;
  const totalCredits = ledgerData?.filter(r => r.type === 'credit').reduce((sum, r) => sum + r.totalAmountPaise, 0) || 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <PageHeader 
          title="Financial Reports"
          description="Generate aggregated reports for reconciliation and export to CSV."
        />

        {/* Date Range Selector */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-0 cursor-pointer font-medium"
            />
          </div>
          <span className="text-muted-foreground text-sm font-medium px-2">to</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-0 cursor-pointer font-medium"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
          <div className="absolute -top-4 -right-4 p-6 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <Activity className="w-24 h-24 text-primary" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Recharge Volume</p>
          <p className="text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">
            ₹{(totalTxVolume / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
          <div className="absolute -top-4 -right-4 p-6 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <PieChart className="w-24 h-24 text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Commission Earned</p>
          <p className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            ₹{(totalCommEarned / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
          <div className="absolute -top-4 -right-4 p-6 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <FileSpreadsheet className="w-24 h-24 text-purple-500" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Total Wallet Deposits (Credits)</p>
          <p className="text-3xl font-mono font-bold text-purple-600 dark:text-purple-400 tracking-tight">
            ₹{(totalCredits / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Export Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transactions Report */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between h-full">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              Transactions Report
            </h3>
            <p className="text-muted-foreground font-medium text-sm leading-relaxed mb-8">
              Daily aggregated totals of all Recharges and Bill Payments within the selected date range. Grouped by service type and success/failure status. Includes total platform volume and total commission generated per day.
            </p>
          </div>
          <Button
            onClick={exportTransactions}
            disabled={txLoading || txFetching || !txData || txData.length === 0}
            className="w-full"
            size="lg"
          >
            {txFetching ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
            Download CSV Export
          </Button>
        </div>

        {/* Ledger Report */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between h-full">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Wallet Ledger Report
            </h3>
            <p className="text-muted-foreground font-medium text-sm leading-relaxed mb-8">
              Daily aggregated totals of all internal money movements. Groups every Credit and Debit happening on the platform (Recharges, Refunds, Offline Deposits, Commissions) by day and transaction type.
            </p>
          </div>
          <Button
            onClick={exportLedger}
            disabled={ledgerLoading || ledgerFetching || !ledgerData || ledgerData.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            size="lg"
          >
            {ledgerFetching ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
            Download CSV Export
          </Button>
        </div>
      </div>
    </div>
  );
}
