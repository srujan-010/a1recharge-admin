"use client";

import { useState } from "react";
import { useWhatsAppLogs, useWhatsAppLogsSummary, WhatsAppCampaignLog } from "@/hooks/useWhatsAppBusiness";
import {
  ScrollText, Search, RefreshCw, Eye, X, FileSpreadsheet, Users, Copy, Check,
  Megaphone, Wrench, ShieldCheck, Loader2, MessageSquare, IndianRupee
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Fast2SMSLogsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<WhatsAppCampaignLog | null>(null);
  const [recipientDrawerLog, setRecipientDrawerLog] = useState<WhatsAppCampaignLog | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const { data: logs, isLoading, refetch } = useWhatsAppLogs({
    from: fromDate || undefined,
    to: toDate || undefined,
    search: search || undefined,
    status: selectedStatus !== "ALL" ? selectedStatus : undefined,
    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
    limit: 200,
  });

  const { data: summary } = useWhatsAppLogsSummary();

  const formatDateSafe = (dateVal: any, formatStr = "MMM dd, yyyy hh:mm a") => {
    if (!dateVal) return "N/A";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "N/A";
    try { return format(d, formatStr); } catch { return "N/A"; }
  };

  const getCategoryBadge = (category?: string) => {
    const cat = (category || "MARKETING").toUpperCase();
    if (cat === "MARKETING") return (
      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold gap-1 text-[10px] whitespace-nowrap">
        <Megaphone className="w-3 h-3" /> Marketing
      </Badge>
    );
    if (cat === "UTILITY") return (
      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold gap-1 text-[10px] whitespace-nowrap">
        <Wrench className="w-3 h-3" /> Utility
      </Badge>
    );
    if (cat === "AUTHENTICATION") return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold gap-1 text-[10px] whitespace-nowrap">
        <ShieldCheck className="w-3 h-3" /> Authentication
      </Badge>
    );
    return <Badge className="bg-slate-100 text-slate-600 font-bold text-[10px]">{cat}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "DELIVERED" || status === "READ") return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-bold">{status}</Badge>
    );
    if (status === "FAILED") return (
      <Badge variant="destructive" className="text-[10px] font-bold">FAILED</Badge>
    );
    return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[10px] font-bold">{status}</Badge>;
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 1500);
  };

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;
    const headers = ["Sent Time", "Template", "Category", "Recipients", "Rate (INR)", "Total Debit (INR)", "Status", "Request ID", "Variables", "Created By"];
    const rows = logs.map(l => [
      formatDateSafe(l.createdAt),
      `"${l.templateName || ''}"`,
      l.category || "MARKETING",
      l.recipientCount || (l.recipients?.length ?? 0),
      l.ratePerMessage ?? 0.95,
      l.totalCost ?? 0,
      l.status,
      `"${l.requestId || ''}"`,
      `"${l.variablesValues || ''}"`,
      `"${(l.sentBy as any)?.name || 'Admin'}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `WhatsApp_Logs_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecipients = (recipientDrawerLog?.recipients || []).filter(n =>
    !recipientSearch || n.includes(recipientSearch)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-indigo-600" /> WhatsApp Message Logs & Billing Audit
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Complete operational log with message category, recipient count, rate per message, and total wallet debit.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={() => refetch()} className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={!logs || logs.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5 rounded-xl text-xs gap-2 shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Messages</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{summary?.todaysMessages ?? 0}</div>
          <p className="text-[11px] text-slate-500 font-medium">Recipients Reached</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Spend</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">₹{summary?.todaysSpend?.toFixed(2) ?? '0.00'}</div>
          <p className="text-[11px] text-slate-500 font-medium">Fast2SMS Debit</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Marketing Spend</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">₹{summary?.marketingSpend?.toFixed(2) ?? '0.00'}</div>
          <p className="text-[11px] text-slate-400 font-medium">₹0.95 / msg</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Utility Spend</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">₹{summary?.utilitySpend?.toFixed(2) ?? '0.00'}</div>
          <p className="text-[11px] text-slate-400 font-medium">₹0.25 / msg</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Auth Spend</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">₹{summary?.authSpend?.toFixed(2) ?? '0.00'}</div>
          <p className="text-[11px] text-slate-400 font-medium">₹0.25 / msg</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search template, request ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold"
            />
          </div>

          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold" />

          <select
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none h-11"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing (₹0.95)</option>
            <option value="UTILITY">Utility (₹0.25)</option>
            <option value="AUTHENTICATION">Authentication (₹0.25)</option>
          </select>

          <select
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none h-11"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="READ">Read</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* LOGS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" /> Message Log
          </h3>
          <span className="text-xs text-slate-400 font-medium">{logs?.length ?? 0} records</span>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Loading logs...</p>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium space-y-2">
            <ScrollText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No WhatsApp Logs Found</p>
            <p className="text-xs">No records match your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 pt-2 px-3">Sent Time</th>
                  <th className="pb-3 pt-2 px-3">Template</th>
                  <th className="pb-3 pt-2 px-3">Category</th>
                  <th className="pb-3 pt-2 px-3">Recipients</th>
                  <th className="pb-3 pt-2 px-3 text-right">Rate / Msg</th>
                  <th className="pb-3 pt-2 px-3 text-right">Total Debit</th>
                  <th className="pb-3 pt-2 px-3 text-center">Status</th>
                  <th className="pb-3 pt-2 px-3">Request ID</th>
                  <th className="pb-3 pt-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => {
                  const count = log.recipientCount || log.recipients?.length || 0;
                  return (
                    <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                      {/* Sent Time */}
                      <td className="py-4 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateSafe(log.createdAt)}
                      </td>

                      {/* Template */}
                      <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-200 max-w-[160px] truncate" title={log.templateName}>
                        {log.templateName || "Unknown"}
                      </td>

                      {/* Category */}
                      <td className="py-4 px-3">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Recipients — clickable count */}
                      <td className="py-4 px-3">
                        <button
                          onClick={() => { setRecipientDrawerLog(log); setRecipientSearch(""); }}
                          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:underline transition-colors text-xs"
                          title="Click to view recipient list"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {count} Recipient{count !== 1 ? "s" : ""}
                        </button>
                      </td>

                      {/* Rate per message */}
                      <td className="py-4 px-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-400">
                        ₹{(log.ratePerMessage ?? 0.95).toFixed(2)}
                      </td>

                      {/* Total Debit */}
                      <td className="py-4 px-3 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                        ₹{(log.totalCost ?? 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3 text-center">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* Request ID */}
                      <td className="py-4 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold max-w-[100px] truncate" title={log.requestId}>
                        {log.requestId ? log.requestId.substring(0, 8) + "..." : "N/A"}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLog(log)}
                          className="h-8 px-3 text-[11px] font-bold rounded-lg gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECIPIENTS DRAWER */}
      {recipientDrawerLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" /> Recipients
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {recipientDrawerLog.templateName} · {recipientDrawerLog.recipients?.length || 0} numbers
                </p>
              </div>
              <button
                onClick={() => setRecipientDrawerLog(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search inside drawer */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search number..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Recipient List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {filteredRecipients.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-8">No recipients found.</p>
              ) : (
                filteredRecipients.map((num, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-xl px-3 py-2.5 border border-slate-200/60 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">{num}</p>
                    </div>
                    <button
                      onClick={() => handleCopyNumber(num)}
                      className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      title="Copy number"
                    >
                      {copiedNumber === num ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button variant="outline" onClick={() => setRecipientDrawerLog(null)} className="w-full h-10 rounded-xl font-bold text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-2xl w-full rounded-[28px] border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getCategoryBadge(selectedLog.category)}
                {getStatusBadge(selectedLog.status)}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedLog.templateName || "WhatsApp Message"}</h3>
              <p className="text-xs text-slate-400 font-mono">Request ID: {selectedLog.requestId || "N/A"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Category</span>
                <p className="font-extrabold text-slate-900 dark:text-white">{selectedLog.category || "MARKETING"}</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recipient Count</span>
                <p className="font-extrabold text-indigo-600 dark:text-indigo-400">{selectedLog.recipientCount || selectedLog.recipients?.length || 0} Recipients</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Rate Per Message</span>
                <p className="font-extrabold text-slate-900 dark:text-white font-mono">₹{(selectedLog.ratePerMessage ?? 0.95).toFixed(2)}</p>
              </div>

              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl space-y-1 border border-rose-200 dark:border-rose-900">
                <span className="font-bold text-rose-500 uppercase tracking-wider text-[10px]">Total Debit</span>
                <p className="font-extrabold text-rose-600 dark:text-rose-400 font-mono text-lg">₹{(selectedLog.totalCost ?? 0).toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Sent At</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{formatDateSafe(selectedLog.createdAt)}</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Created By</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{(selectedLog.sentBy as any)?.name || "Admin"}</p>
              </div>

              {selectedLog.variablesValues && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1 col-span-2 border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Variables Used</span>
                  <p className="font-mono text-indigo-600 dark:text-indigo-400 break-all">{selectedLog.variablesValues}</p>
                </div>
              )}

              {selectedLog.errorDetails && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-2xl space-y-1 col-span-2 border border-red-200">
                  <span className="font-bold text-red-600 uppercase tracking-wider text-[10px]">Error Details</span>
                  <p className="font-mono text-red-700 dark:text-red-300 text-xs">{selectedLog.errorDetails}</p>
                </div>
              )}

              {/* Recipient Count with drawer trigger */}
              <div className="col-span-2 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recipient List</span>
                <button
                  onClick={() => { setRecipientDrawerLog(selectedLog); setSelectedLog(null); setRecipientSearch(""); }}
                  className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-sm"
                >
                  <Users className="w-4 h-4" />
                  View {selectedLog.recipients?.length || selectedLog.recipientCount || 0} Recipients →
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedLog(null)} className="h-10 px-5 rounded-xl font-bold text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
