"use client";

import { useState } from "react";
import { 
  useFast2SMSWalletLedgerTransactions, 
  useFast2SMSWalletLedgerStats 
} from "@/hooks/useWhatsAppBusiness";
import { 
  Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Megaphone, Wrench, ShieldCheck, 
  Search, Download, RefreshCw, Loader2, ChevronLeft, ChevronRight, X, Eye, 
  MessageSquare, FileText, CheckCircle2, AlertTriangle, Clock, Layers, Sparkles
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Fast2SMSWalletTransactionsPage() {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "ALL">("today");
  const [category, setCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useFast2SMSWalletLedgerStats();
  const { data: txData, isLoading: txLoading, refetch: refetchTx, isFetching } = useFast2SMSWalletLedgerTransactions({
    page,
    limit: 25,
    period,
    category,
    status: statusFilter,
    search
  });

  const formatDateSafe = (dateVal: any, formatStr = "MMM dd, yyyy hh:mm a") => {
    if (!dateVal) return "N/A";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "N/A";
    try {
      return format(d, formatStr);
    } catch (e) {
      return "N/A";
    }
  };

  const getTypeBadge = (type: string, categoryName: string) => {
    const t = (type || categoryName || '').toUpperCase();
    if (t.includes('MARKETING')) {
      return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold border-purple-200 gap-1 text-[10px]"><Megaphone className="w-3 h-3" /> 📣 Marketing Message</Badge>;
    }
    if (t.includes('UTILITY')) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border-blue-200 gap-1 text-[10px]"><Wrench className="w-3 h-3" /> 🛠 Utility Message</Badge>;
    }
    if (t.includes('AUTH')) {
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border-emerald-200 gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" /> 🔐 Authentication Message</Badge>;
    }
    if (t.includes('CREDIT')) {
      return <Badge className="bg-emerald-500 text-white font-bold gap-1 text-[10px]"><ArrowDownRight className="w-3 h-3" /> 💰 Wallet Credit</Badge>;
    }
    if (t.includes('REFUND')) {
      return <Badge className="bg-amber-500 text-white font-bold gap-1 text-[10px]">💸 Refund</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold gap-1 text-[10px]"><MessageSquare className="w-3 h-3" /> 💬 WhatsApp Template</Badge>;
  };

  const handleExportCSV = () => {
    if (!txData?.data || txData.data.length === 0) return;
    const headers = ["Date", "Type", "Category", "Template Name", "Recipients", "Rate", "Total Debit (INR)", "Balance Before", "Balance After", "Request ID", "Status", "Created By"];
    const rows = txData.data.map((tx: any) => [
      formatDateSafe(tx.createdAt),
      tx.type,
      tx.category,
      `"${tx.templateName}"`,
      tx.recipientCount,
      tx.ratePerMessage,
      tx.totalDebit,
      tx.balanceBefore,
      tx.balanceAfter,
      tx.requestId || 'N/A',
      tx.status,
      tx.createdByName || 'Admin'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Fast2SMS_Wallet_Ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-indigo-600" /> Fast2SMS Wallet Transactions & Financial Ledger
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Complete audit trail of every balance credit, message debit, category rates, and wallet balances before & after dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => { refetchStats(); refetchTx(); }}
            variant="outline"
            disabled={isFetching}
            className="gap-2 h-10 px-4 rounded-xl text-xs font-bold"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <RefreshCw className="w-4 h-4" />}
            Refresh Ledger
          </Button>

          <Button
            onClick={handleExportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 px-4 rounded-xl text-xs font-bold shadow-md"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Current Wallet Balance */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Wallet Balance</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            ₹{statsLoading ? "..." : (stats?.currentWalletBalance !== undefined ? Number(stats.currentWalletBalance).toFixed(2) : "500.00")} INR
          </div>
          <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fast2SMS Live Credit
          </p>
        </div>

        {/* Card 2: Today's Spend */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Spend</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            ₹{statsLoading ? "..." : (stats?.todaysSpend !== undefined ? Number(stats.todaysSpend).toFixed(2) : "0.00")}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Daily Outflow</p>
        </div>

        {/* Card 3: This Month's Spend */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month's Spend</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            ₹{statsLoading ? "..." : (stats?.thisMonthsSpend !== undefined ? Number(stats.thisMonthsSpend).toFixed(2) : "0.00")}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Monthly Outflow</p>
        </div>

        {/* Card 4: Category Breakdown */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category Spend Breakdown</span>
          <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
            <span>📣 Marketing (₹0.95):</span>
            <span className="font-mono font-bold text-purple-600">₹{stats?.marketingSpend ? Number(stats.marketingSpend).toFixed(2) : '0.00'}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
            <span>🛠 Utility (₹0.25):</span>
            <span className="font-mono font-bold text-blue-600">₹{stats?.utilitySpend ? Number(stats.utilitySpend).toFixed(2) : '0.00'}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
            <span>🔐 Auth (₹0.25):</span>
            <span className="font-mono font-bold text-emerald-600">₹{stats?.authSpend ? Number(stats.authSpend).toFixed(2) : '0.00'}</span>
          </div>
        </div>

      </div>

      {/* FILTERS & SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Period & Category Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
            {(['today', '7d', '30d', 'ALL'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  period === p
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <select
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing (₹0.95)</option>
            <option value="UTILITY">Utility (₹0.25)</option>
            <option value="AUTHENTICATION">Authentication (₹0.25)</option>
            <option value="CREDIT">Wallet Credit</option>
            <option value="DEBIT">Wallet Debit</option>
          </select>

          <select
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {/* Right: Search Box */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <Input
            type="text"
            placeholder="Search Template, Request ID, Campaign..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-10 text-xs font-medium bg-slate-50 dark:bg-slate-950"
          />
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-4 md:p-6">
        
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" /> Fast2SMS Wallet Ledger
          </h3>
          <span className="text-xs text-slate-400 font-mono font-medium">
            {txData?.pagination?.total || 0} Transactions Found
          </span>
        </div>

        {txLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">Loading Fast2SMS wallet ledger...</p>
          </div>
        ) : !txData?.data || txData.data.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium">
            No Fast2SMS wallet transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Transaction Type</th>
                  <th className="py-3 px-3">Template Name</th>
                  <th className="py-3 px-3">Category / Rate</th>
                  <th className="py-3 px-3 text-center">Recipients</th>
                  <th className="py-3 px-3 text-right">Total Debit</th>
                  <th className="py-3 px-3 text-right">Balance Before</th>
                  <th className="py-3 px-3 text-right">Balance After</th>
                  <th className="py-3 px-3">Request ID</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {txData.data.map((tx: any) => (
                  <tr 
                    key={tx._id}
                    onClick={() => setSelectedTx(tx)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-950/60 cursor-pointer transition-colors"
                  >
                    
                    {/* Date & Time */}
                    <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {formatDateSafe(tx.createdAt)}
                    </td>

                    {/* Transaction Type */}
                    <td className="py-3.5 px-3">
                      {getTypeBadge(tx.type, tx.category)}
                    </td>

                    {/* Template Name */}
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white max-w-[180px] truncate" title={tx.templateName}>
                      {tx.templateName}
                    </td>

                    {/* Category / Rate */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{tx.category}</span>
                      <span className="text-[10px] text-slate-400 font-mono">₹{Number(tx.ratePerMessage || 0.95).toFixed(4)} / msg</span>
                    </td>

                    {/* Recipients Count */}
                    <td className="py-3.5 px-3 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {tx.recipientCount}
                    </td>

                    {/* Total Debit */}
                    <td className="py-3.5 px-3 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                      -₹{Number(tx.totalDebit).toFixed(2)}
                    </td>

                    {/* Balance Before */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                      ₹{Number(tx.balanceBefore).toFixed(2)}
                    </td>

                    {/* Balance After */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(tx.balanceAfter).toFixed(2)}
                    </td>

                    {/* Request ID */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={tx.requestId}>
                      {tx.requestId || 'N/A'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center">
                      <Badge className={tx.status === 'SUCCESS' ? 'bg-emerald-500 text-white font-bold text-[10px]' : tx.status === 'FAILED' ? 'bg-rose-500 text-white font-bold text-[10px]' : 'bg-amber-500 text-white font-bold text-[10px]'}>
                        {tx.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }} className="h-8 w-8 p-0">
                        <Eye className="w-4 h-4 text-indigo-600" />
                      </Button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {txData?.pagination && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
            <span>
              Page {txData.pagination.page} of {txData.pagination.pages} ({txData.pagination.total} Records)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="h-8 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= txData.pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="h-8 text-xs font-bold"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* TRANSACTION DETAIL DRAWER / MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 flex flex-col relative overflow-y-auto custom-scrollbar">
            
            <button 
              onClick={() => setSelectedTx(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getTypeBadge(selectedTx.type, selectedTx.category)}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white pt-1">
                {selectedTx.templateName}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Request ID: {selectedTx.requestId || 'N/A'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Message Category:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedTx.category}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Rate Per Message:</span>
                <span className="font-mono font-bold text-indigo-600">₹{Number(selectedTx.ratePerMessage).toFixed(4)} / msg</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Recipient Count:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedTx.recipientCount} Recipients</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Total Cost / Debit:</span>
                <span className="font-mono font-black text-rose-600 text-sm">₹{Number(selectedTx.totalDebit).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Wallet Balance Before:</span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-400">₹{Number(selectedTx.balanceBefore).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Wallet Balance After:</span>
                <span className="font-mono font-black text-emerald-600">₹{Number(selectedTx.balanceAfter).toFixed(2)}</span>
              </div>
            </div>

            {/* Recipient List Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Recipient Mobile List ({selectedTx.recipientList?.length || selectedTx.recipientCount})
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto custom-scrollbar text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
                {selectedTx.recipientList && selectedTx.recipientList.length > 0 ? (
                  selectedTx.recipientList.map((num: string, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>#{idx + 1}</span>
                      <span>{num}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">No recipient mobile numbers recorded for this transaction.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedTx(null)} className="h-10 px-6 rounded-xl font-bold text-xs">
                Close Drawer
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
