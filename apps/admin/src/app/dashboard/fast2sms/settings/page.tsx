"use client";

import { useState } from "react";
import { 
  useWabaStatus, 
  useSyncWhatsAppTemplates, 
  useSendWhatsAppCampaign 
} from "@/hooks/useWhatsAppBusiness";
import { 
  Settings, ShieldCheck, Wallet, RefreshCw, Send, 
  Check, Phone, Info, Loader2, Sparkles 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Fast2SMSSettingsSubtab() {
  const { data: statusData, isLoading, refetch } = useWabaStatus();
  const { mutate: syncTemplates, isPending: isSyncing } = useSyncWhatsAppTemplates();
  const { mutate: sendCampaign, isPending: isSendingTest } = useSendWhatsAppCampaign();

  const [testMobile, setTestMobile] = useState("9100329521");
  const [testMessageId, setTestMessageId] = useState("26992");
  const [testVars, setTestVars] = useState("Srujan|9100329521|199|Airtel|TXN1000921");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const waba = statusData?.waba;
  const wallet = statusData?.wallet;
  const isConnected = waba?.connection_status === 'CONNECTED';

  const handleTestSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMobile || !testMessageId) return;

    sendCampaign({
      recipients: 'SINGLE',
      targetMobile: testMobile,
      messageId: parseInt(testMessageId, 10),
      variablesValues: testVars,
    }, {
      onSuccess: (data) => {
        setToastMsg(data.message || "Test Fast2SMS message sent successfully!");
        setTimeout(() => setToastMsg(null), 3500);
      },
      onError: (err: any) => {
        setToastMsg(err?.response?.data?.message || err.message);
        setTimeout(() => setToastMsg(null), 4000);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" /> Fast2SMS API Gateway Settings
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Fast2SMS API credentials, live WABA account status, and message test dispatcher.
        </p>
      </div>

      {/* Connection Info Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Fast2SMS API Credentials</h3>
              <p className="text-xs text-slate-500">Configured in apps/api/.env (FAST2SMS_API_KEY)</p>
            </div>
          </div>

          <Badge className={isConnected ? "bg-emerald-500 text-white font-bold" : "bg-red-500 text-white font-bold"}>
            {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Verified Business Name</span>
            <p className="font-black text-sm text-slate-900 dark:text-white">{waba?.verified_name || "A1recharge"}</p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Connected Phone Number</span>
            <p className="font-black text-sm text-slate-900 dark:text-white">{waba?.number || "+919975600499"}</p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">WABA ID</span>
            <p className="font-mono text-xs text-slate-700 dark:text-slate-300">{waba?.waba_id || "988843927460634"}</p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Phone Number ID</span>
            <p className="font-mono text-xs text-slate-700 dark:text-slate-300">{waba?.phone_number_id || "1294250930429862"}</p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Messaging Limit</span>
            <p className="font-bold text-slate-900 dark:text-white">{waba?.messaging_limit || "TIER_2K"}</p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Fast2SMS Wallet Balance</span>
            <p className="font-black text-sm text-indigo-600 dark:text-indigo-400">
              ₹{wallet?.walletBalance !== undefined ? wallet.walletBalance.toFixed(2) : "40.19"} INR ({wallet?.smsCount || 160} Credits)
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Button variant="outline" onClick={() => refetch()} className="h-10 px-4 text-xs font-bold gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh WABA Status
          </Button>
          <Button onClick={() => syncTemplates()} disabled={isSyncing} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 text-xs gap-2">
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Templates
          </Button>
        </div>
      </div>

      {/* Test Message Dispatcher Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> Dispatch Test Message
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Test live Fast2SMS message delivery to a single mobile number.
          </p>
        </div>

        <form onSubmit={handleTestSend} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Test Mobile Number *</label>
              <Input 
                type="tel"
                required
                placeholder="9100329521"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
                className="h-11 font-semibold text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Message ID (Fast2SMS) *</label>
              <Input 
                type="number"
                required
                placeholder="26992"
                value={testMessageId}
                onChange={(e) => setTestMessageId(e.target.value)}
                className="h-11 font-semibold text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Pipe Variables (`val1|val2`)</label>
              <Input 
                type="text"
                placeholder="Srujan|9100329521|199|Airtel|TXN1000921"
                value={testVars}
                onChange={(e) => setTestVars(e.target.value)}
                className="h-11 font-semibold text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={isSendingTest}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-7 rounded-xl text-xs gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Dispatch Test Message
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
}
