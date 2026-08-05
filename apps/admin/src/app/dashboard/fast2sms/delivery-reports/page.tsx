"use client";

import { useState } from "react";
import { useWhatsAppDeliveryReport } from "@/hooks/useWhatsAppBusiness";
import { 
  FileCheck2, Search, RefreshCw, CheckCircle2, 
  Clock, AlertCircle, Eye, ShieldCheck, Loader2, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DeliveryReportsPage() {
  const [requestIdInput, setRequestIdInput] = useState("");
  const [activeRequestId, setActiveRequestId] = useState("");
  const [autoPoll, setAutoPoll] = useState(false);

  const { data: reportData, isLoading, refetch } = useWhatsAppDeliveryReport(
    activeRequestId || undefined,
    autoPoll
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestIdInput.trim()) {
      setActiveRequestId(requestIdInput.trim());
    }
  };

  const report = reportData?.report;
  const localLog = reportData?.localLog;
  const currentStatus = (report?.status || localLog?.status || 'PENDING').toUpperCase();

  const timelineSteps = [
    { key: 'QUEUED', label: 'Queued' },
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'READ', label: 'Read' },
  ];

  const getStepIndex = (statusStr: string) => {
    if (statusStr.includes('READ')) return 3;
    if (statusStr.includes('DELIVERED')) return 2;
    if (statusStr.includes('ACCEPTED')) return 1;
    return 0;
  };

  const currentStepIdx = getStepIndex(currentStatus);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-6 h-6 text-indigo-600" /> WhatsApp Live Delivery Reports
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Fetch live delivery status timeline directly from Fast2SMS WABA Cloud API (`GET /dev/whatsapp/{`{REQUEST_ID}`}`).
        </p>
      </div>

      {/* Search Bar Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input 
              type="text"
              required
              placeholder="Enter Fast2SMS Request ID (e.g. WA_REQ_TEST_9901 or 26992)..."
              value={requestIdInput}
              onChange={(e) => setRequestIdInput(e.target.value)}
              className="pl-10 h-11 text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={autoPoll}
                onChange={(e) => setAutoPoll(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              Auto-Poll (15s)
            </label>

            <Button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl text-xs gap-2 shrink-0 shadow-lg shadow-indigo-600/20"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Fetch Report
            </Button>
          </div>
        </form>
      </div>

      {/* Delivery Report Output */}
      {activeRequestId && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Request ID: {activeRequestId}
                </h3>
                {currentStatus.includes('DELIVERED') || currentStatus.includes('READ') ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {currentStatus}
                  </Badge>
                ) : currentStatus.includes('FAILED') ? (
                  <Badge variant="destructive" className="font-bold text-xs gap-1">
                    <AlertCircle className="w-3 h-3" /> FAILED
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white font-bold text-xs gap-1">
                    <Clock className="w-3 h-3" /> {currentStatus}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Target: {localLog?.recipients?.join(', ') || "Live Fast2SMS API Query"}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => refetch()}
              className="h-10 px-4 text-xs font-bold gap-2 rounded-xl shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Report
            </Button>
          </div>

          {/* STATUS TIMELINE PROGRESS */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Status Timeline</p>
            
            {currentStatus.includes('FAILED') ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900/40 flex items-center gap-3 text-red-700 dark:text-red-300 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                <span>Delivery Failed: {report?.error || localLog?.errorDetails || "Invalid recipient number or rejected by WhatsApp server."}</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 pt-2">
                {timelineSteps.map((step, idx) => {
                  const isDone = currentStepIdx >= idx;
                  return (
                    <div 
                      key={step.key} 
                      className={`p-4 rounded-2xl border transition-all text-center space-y-1 ${
                        isDone 
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200' 
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mx-auto ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : (idx + 1)}
                      </div>
                      <p className="font-extrabold text-xs">{step.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Template Used</span>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm">{localLog?.templateName || "Fast2SMS WABA Template"}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sent Timestamp</span>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                {localLog?.createdAt ? format(new Date(localLog.createdAt), 'MMM dd, yyyy HH:mm:ss') : "Live API"}
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
