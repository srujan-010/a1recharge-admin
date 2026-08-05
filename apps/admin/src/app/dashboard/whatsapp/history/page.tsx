"use client";

import { useState } from "react";
import { useWhatsAppHistory } from "@/hooks/useWhatsAppBusiness";
import { Search, Clock, CheckCircle2, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function WhatsAppHistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const { data: history, isLoading, refetch } = useWhatsAppHistory({
    search: search || undefined,
    status: selectedStatus !== "ALL" ? selectedStatus : undefined,
    limit: 100,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-500" /> WhatsApp Campaign History
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Complete audit log of all WhatsApp messages dispatched via Fast2SMS Cloud API.
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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search campaign history by template, request ID, or variable values..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
          />
        </div>

        <select
          className="w-full sm:w-48 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Campaign Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium">
            Loading campaign logs...
          </div>
        ) : !history || history.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm font-medium space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No WhatsApp Campaign Logs Found</p>
            <p className="text-xs">No records match your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Sent Time</th>
                  <th className="pb-3 px-3">Template Name</th>
                  <th className="pb-3 px-3">Recipients</th>
                  <th className="pb-3 px-3">Pipe Variables (`variables_values`)</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Request ID</th>
                  <th className="pb-3 px-3">Sent By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="py-4 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="py-4 px-3 font-bold text-slate-800 dark:text-slate-200">
                      <div>{log.templateName || "Unknown"}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-normal">Msg ID: {log.messageId}</div>
                    </td>
                    <td className="py-4 px-3 font-semibold text-slate-600 dark:text-slate-400">
                      {log.recipientCount} device(s)
                    </td>
                    <td className="py-4 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 max-w-[240px] truncate" title={log.variablesValues}>
                      {log.variablesValues || "None"}
                    </td>
                    <td className="py-4 px-3">
                      {log.status === 'DELIVERED' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                          DELIVERED
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          FAILED
                        </Badge>
                      )}
                    </td>
                    <td className="py-4 px-3 font-mono text-[11px] text-slate-400">
                      {log.requestId || "N/A"}
                    </td>
                    <td className="py-4 px-3 text-slate-500 font-medium">
                      {log.source === 'AUTOMATIC' ? 'System Automated' : (log.sentBy?.name || 'Admin')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
