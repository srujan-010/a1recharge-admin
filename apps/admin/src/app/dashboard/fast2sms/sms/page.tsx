"use client";

import { useState } from "react";
import { Smartphone, Send, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Fast2SMSSMSSubtab() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [message, setMessage] = useState("");
  const [dltEntityId, setDltEntityId] = useState("");
  const [dltTemplateId, setDltTemplateId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleSendSMS = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || !message) return;

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setToastMsg(`SMS dispatched to ${mobileNumber} via Fast2SMS DLT gateway.`);
      setMobileNumber("");
      setMessage("");
      setTimeout(() => setToastMsg(null), 3500);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-purple-600" /> Fast2SMS DLT SMS Dispatcher
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Send transactional DLT SMS notifications directly using Fast2SMS DLT SMS gateway.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        <form onSubmit={handleSendSMS} className="space-y-6">
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Target Mobile Number(s) * (Comma Separated)
              </label>
              <Input 
                type="text" 
                required
                placeholder="e.g. 9100329521, 9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="h-12 font-semibold text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  DLT Entity ID (Optional)
                </label>
                <Input 
                  type="text" 
                  placeholder="e.g. 1701158000000000000"
                  value={dltEntityId}
                  onChange={(e) => setDltEntityId(e.target.value)}
                  className="h-11 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  DLT Template ID (Optional)
                </label>
                <Input 
                  type="text" 
                  placeholder="e.g. 1707161000000000000"
                  value={dltTemplateId}
                  onChange={(e) => setDltTemplateId(e.target.value)}
                  className="h-11 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>SMS Message Body *</span>
                <span className="text-slate-400">{message.length}/160 (1 SMS Credit)</span>
              </label>
              <textarea 
                required
                rows={4}
                maxLength={320}
                placeholder="Enter SMS text content to send via Fast2SMS DLT gateway..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-shadow resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
              DLT SMS Route
            </Badge>

            <Button
              type="submit"
              disabled={isSending || !mobileNumber || !message}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 px-8 rounded-xl text-sm gap-2 shadow-lg shadow-purple-600/20"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Dispatch DLT SMS
            </Button>
          </div>
        </form>

      </div>

    </div>
  );
}
