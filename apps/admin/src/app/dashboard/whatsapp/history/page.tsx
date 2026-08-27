"use client";

import { useState } from "react";
import { useWhatsAppHistory, WhatsAppCampaignLog } from "@/hooks/useWhatsAppBusiness";
import { Search, Clock, CheckCircle2, AlertCircle, RefreshCw, FileText, Filter, Eye, X, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function WhatsAppHistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<WhatsAppCampaignLog | null>(null);

  const { data, isLoading, isError, refetch } = useWhatsAppHistory({
    page,
    limit: 25,
    search: search || undefined,
    status: selectedStatus !== "ALL" ? selectedStatus : undefined,
    source: selectedSource !== "ALL" ? selectedSource : undefined,
    period: selectedPeriod !== "ALL" ? selectedPeriod : undefined,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, pages: 1, hasMore: false };

  const getSourceBadge = (src?: string) => {
    const s = (src || 'PORTAL').toUpperCase();
    if (s === 'API') {
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">API</Badge>;
    }
    if (s === 'AUTOMATION' || s === 'AUTOMATIC') {
      return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">AUTOMATION</Badge>;
    }
    if (s === 'CAMPAIGN') {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">CAMPAIGN</Badge>;
    }
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">PORTAL</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-500" /> WhatsApp Communication History
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Unified audit log for all WhatsApp Business messages sent via Admin Portal, REST API, campaigns, and automated triggers.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh Log
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search history by recipient phone, template, request ID, or variable values..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
          />
        </div>

        {/* Source Filter */}
        <select
          className="w-full md:w-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedSource}
          onChange={(e) => { setSelectedSource(e.target.value); setPage(1); }}
        >
          <option value="ALL">All Sources</option>
          <option value="PORTAL">Portal</option>
          <option value="API">API</option>
          <option value="CAMPAIGN">Campaign</option>
          <option value="AUTOMATION">Automation</option>
        </select>

        {/* Status Filter */}
        <select
          className="w-full md:w-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedStatus}
          onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
        >
          <option value="ALL">All Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Pending</option>
          <option value="READ">Read</option>
        </select>

        {/* Period Filter */}
        <select
          className="w-full md:w-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedPeriod}
          onChange={(e) => { setSelectedPeriod(e.target.value); setPage(1); }}
        >
          <option value="ALL">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Campaign Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium">
            Loading message history...
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">Unable to load message history</p>
            <p className="text-xs">There was an issue communicating with the backend history API.</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="h-9 px-4 font-bold text-xs">
              Retry Load
            </Button>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No WhatsApp Messages Found</p>
            <p className="text-xs">No history records match your search and filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 px-3">Sent Time</th>
                    <th className="pb-3 px-3">Source</th>
                    <th className="pb-3 px-3">Template Name</th>
                    <th className="pb-3 px-3">Recipients</th>
                    <th className="pb-3 px-3">Pipe Variables (`variables_values`)</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Request ID</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                      <td className="py-4 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="py-4 px-3">
                        {getSourceBadge(log.source)}
                      </td>
                      <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-200">
                        <div>{log.templateName || "Unknown"}</div>
                        <div className="text-[10px] font-mono text-slate-400 font-normal">Msg ID: {log.messageId}</div>
                      </td>
                      <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-400">
                        {log.recipients && log.recipients.length > 0 ? (
                          <div title={log.recipients.join(', ')}>
                            {log.recipients[0]}
                            {log.recipients.length > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1">(+{log.recipients.length - 1} more)</span>
                            )}
                          </div>
                        ) : (
                          `${log.recipientCount} device(s)`
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 max-w-[220px] truncate" title={log.variablesValues}>
                        {log.variablesValues || "None"}
                      </td>
                      <td className="py-4 px-3">
                        {(log.status as string) === 'DELIVERED' || (log.status as string) === 'READ' || (log.status as string) === 'SENT' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                            {log.status}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            {log.status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono text-[11px] text-slate-400">
                        {log.requestId || "N/A"}
                      </td>
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium">
                  Showing page <span className="font-bold text-slate-900 dark:text-white">{pagination.page}</span> of <span className="font-bold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} total records)
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    className="h-9 px-3 text-xs font-bold gap-1 rounded-xl"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasMore}
                    onClick={() => setPage(prev => prev + 1)}
                    className="h-9 px-3 text-xs font-bold gap-1 rounded-xl"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MESSAGE DETAILS DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 h-full max-w-md w-full border-l border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xl overflow-y-auto relative">
            <button 
              onClick={() => setSelectedLog(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getSourceBadge(selectedLog.source)}
                <Badge className={selectedLog.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                  {selectedLog.status}
                </Badge>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white pt-1">{selectedLog.templateName}</h3>
              <p className="text-xs font-mono text-slate-400">Req ID: {selectedLog.requestId || "N/A"}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Dispatch Time</span>
                <p className="font-bold text-slate-900 dark:text-white">{format(new Date(selectedLog.createdAt), 'EEEE, MMM dd, yyyy HH:mm:ss')}</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recipients ({selectedLog.recipients?.length || selectedLog.recipientCount})</span>
                <p className="font-mono text-slate-900 dark:text-white break-all">
                  {selectedLog.recipients && selectedLog.recipients.length > 0 ? selectedLog.recipients.join(', ') : `${selectedLog.recipientCount} device(s)`}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Pipe Variables (`variables_values`)</span>
                <p className="font-mono text-emerald-600 dark:text-emerald-400 break-all">{selectedLog.variablesValues || "None"}</p>
              </div>

              {selectedLog.errorDetails && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl space-y-1 border border-rose-200 dark:border-rose-900/50">
                  <span className="font-bold text-rose-500 uppercase tracking-wider text-[10px]">Error Details</span>
                  <p className="font-mono text-rose-700 dark:text-rose-400">{selectedLog.errorDetails}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setSelectedLog(null)} className="w-full h-10 font-bold text-xs">
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
