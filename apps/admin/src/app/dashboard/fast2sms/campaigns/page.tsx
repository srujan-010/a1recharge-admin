"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWhatsAppHistory, WhatsAppCampaignLog } from "@/hooks/useWhatsAppBusiness";
import { Send, Clock, CheckCircle2, AlertCircle, RefreshCw, Search, Plus, Eye, X, ExternalLink, FileCheck2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Fast2SMSCampaignsSubtab() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState<WhatsAppCampaignLog | null>(null);

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
            <Send className="w-6 h-6 text-indigo-600" /> Fast2SMS Communication Campaigns
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track queued, delivered, and read status for all Fast2SMS broadcast campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="h-11 px-4 gap-2 font-bold text-xs rounded-xl border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            onClick={() => router.push('/dashboard/fast2sms/send')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl text-xs gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Create New Campaign
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search campaigns by template name, request ID, or pipe variables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
          />
        </div>

        <select
          className="w-full sm:w-48 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
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

      {/* Campaign Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading campaign history...</div>
        ) : !history || history.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No Fast2SMS Campaigns Recorded</p>
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
                  <th className="pb-3 px-3 text-right">Action</th>
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
                      {(log.status as string) === 'DELIVERED' || (log.status as string) === 'READ' ? (
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
                        onClick={() => setSelectedCampaign(log)}
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
        )}
      </div>

      {/* CAMPAIGN DETAILS DRAWER */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 h-full max-w-md w-full border-l border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xl overflow-y-auto relative">
            <button 
              onClick={() => setSelectedCampaign(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <Badge className="bg-indigo-600 text-white font-bold text-[10px]">CAMPAIGN DETAILS</Badge>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedCampaign.templateName}</h3>
              <p className="text-xs font-mono text-slate-400">Req ID: {selectedCampaign.requestId || "N/A"}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Dispatch Time</span>
                <p className="font-bold text-slate-900 dark:text-white">{format(new Date(selectedCampaign.createdAt), 'EEEE, MMM dd, yyyy HH:mm:ss')}</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recipients Count</span>
                <p className="font-black text-indigo-600 text-base">{selectedCampaign.recipientCount} Handset(s)</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Variables Values</span>
                <p className="font-mono text-indigo-600 dark:text-indigo-400">{selectedCampaign.variablesValues || "None"}</p>
              </div>

              {selectedCampaign.requestId && (
                <Button
                  onClick={() => {
                    const reqId = selectedCampaign.requestId;
                    setSelectedCampaign(null);
                    router.push(`/dashboard/fast2sms/delivery-reports?requestId=${reqId}`);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl text-xs gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <FileCheck2 className="w-4 h-4" /> View Live Delivery Report
                </Button>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setSelectedCampaign(null)} className="w-full h-10 font-bold text-xs">
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
