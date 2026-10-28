"use client";

import { useState, useEffect } from "react";
import { 
  useProvidersList, 
  useRefreshProviderBalance,
  useProviderAutomationSettings,
  useUpdateProviderAutomationSettings,
  useProviderAutomationLogs,
  useSendProviderAutomationTest,
  useCheckBalanceNow,
} from "@/hooks/useProviders";
import { 
  Loader2, Server, RefreshCw, AlertTriangle, ShieldCheck, Clock, 
  Zap, Bell, CheckCircle, XCircle, Send, Check, Phone, Settings, 
  History, Sliders, Info, MessageSquare, AlertCircle, ArrowUpRight,
  Radio, CheckCheck, ShieldAlert, Sparkles
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProvidersPage() {
  const [activeTab, setActiveTab] = useState<"automations" | "providers">("automations");
  const { data: providers, isLoading: isProvidersLoading } = useProvidersList();
  const { mutate: refreshBalance, isPending: isSyncingBalance } = useRefreshProviderBalance();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Automation Hooks
  const { data: autoSettings, isLoading: isSettingsLoading } = useProviderAutomationSettings();
  const { mutate: updateSettings, isPending: isUpdatingSettings } = useUpdateProviderAutomationSettings();
  const { mutate: checkBalanceNow, isPending: isCheckingBalanceNow } = useCheckBalanceNow();
  
  const [logPage, setLogPage] = useState(1);
  const { data: logsData, isLoading: isLogsLoading } = useProviderAutomationLogs(logPage, 15);
  const { mutate: sendTestAlert, isPending: isSendingTest } = useSendProviderAutomationTest();

  // Test Alert Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testNumberInput, setTestNumberInput] = useState("8275366399");
  const [testLevelInput, setTestLevelInput] = useState<"LOW_2000" | "LOW_1000" | "CRITICAL_500">("LOW_2000");
  const [testChannelInput, setTestChannelInput] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Editable Form State for Automations
  const [recipientsInput, setRecipientsInput] = useState<string>("8275366399, 9100329521");
  const [channelInput, setChannelInput] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [minRefreshInput, setMinRefreshInput] = useState<number>(60);
  const [reconcileIntervalInput, setReconcileIntervalInput] = useState<number>(15);

  useEffect(() => {
    if (autoSettings) {
      if (autoSettings.recipients && autoSettings.recipients.length > 0) {
        setRecipientsInput(autoSettings.recipients.join(", "));
      }
      if (autoSettings.channel) setChannelInput(autoSettings.channel);
      if (autoSettings.minRefreshSeconds) setMinRefreshInput(autoSettings.minRefreshSeconds);
      if (autoSettings.reconcileIntervalMinutes) setReconcileIntervalInput(autoSettings.reconcileIntervalMinutes);
    }
  }, [autoSettings]);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleSync = (providerId: string) => {
    setSyncingId(providerId);
    refreshBalance(providerId, {
      onSettled: () => setSyncingId(null)
    });
  };

  const handleManualRefresh = () => {
    checkBalanceNow({ force: true }, {
      onSuccess: (res: any) => {
        const d = res?.data;
        if (d?.status === "NORMAL") {
          showToast(`Balance refreshed: ₹${d.balance?.toFixed(2)} (Normal, Safe > ₹2,000)`);
        } else if (d?.status === "LOW_2000") {
          showToast(`Balance is ₹${d.balance?.toFixed(2)} (₹2,000 Warning Level). ${d.alertSent ? 'Alert dispatched!' : 'Duplicate suppressed.'}`, !d.alertSent ? false : true);
        } else if (d?.status === "LOW_1000") {
          showToast(`High-Priority: Balance is ₹${d.balance?.toFixed(2)} (₹1,000 Alert Level). ${d.alertSent ? 'Alert dispatched!' : 'Duplicate suppressed.'}`, true);
        } else if (d?.status === "CRITICAL_500") {
          showToast(`CRITICAL: Balance is ₹${d.balance?.toFixed(2)} (₹500 Critical Level). ${d.alertSent ? 'Critical alert dispatched!' : 'Duplicate suppressed.'}`, true);
        } else if (d?.status === "ERROR") {
          showToast(`Provider API error: ${d.error || "Unreachable"}`, true);
        } else {
          showToast("Balance refresh completed.");
        }
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message || "Manual refresh failed", true);
      }
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecipients = recipientsInput.split(",").map(s => s.trim().replace(/\D/g, "")).filter(s => s.length >= 10);
    if (cleanRecipients.length === 0) {
      showToast("At least one valid 10-digit recipient mobile number is required", true);
      return;
    }

    updateSettings({
      recipients: cleanRecipients,
      channel: channelInput,
      minRefreshSeconds: minRefreshInput,
      reconcileIntervalMinutes: reconcileIntervalInput,
    }, {
      onSuccess: () => showToast("A1Topup monitoring settings saved successfully!"),
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Failed to update settings", true)
    });
  };

  const handleToggleAutomation = (currentEnabled: boolean) => {
    updateSettings({ enabled: !currentEnabled }, {
      onSuccess: () => showToast(`Monitoring ${!currentEnabled ? "ENABLED" : "PAUSED"}`),
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Failed to toggle monitoring", true)
    });
  };

  const handleExecuteTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumberInput.trim()) return;

    sendTestAlert({
      testNumber: testNumberInput.trim(),
      level: testLevelInput,
      channel: testChannelInput,
    }, {
      onSuccess: () => {
        setIsTestModalOpen(false);
        showToast(`Test ${testChannelInput} preview for ${testLevelInput} sent to ${testNumberInput}`);
      },
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Test dispatch failed", true)
    });
  };

  const currentLevel = autoSettings?.currentThresholdState || 'NORMAL';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          toastMsg.isError ? 'bg-rose-950 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          {toastMsg.isError ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Providers & Gateway Monitoring"
          description="Event-driven balance monitoring with 15-minute fallback reconciliation and approved Fast2SMS WhatsApp templates."
        />

        {/* Tab Switcher */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl flex items-center gap-1 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("automations")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "automations"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>A1Topup Wallet Monitor (3 Templates)</span>
          </button>
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "providers"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-500" />
            <span>Gateway Overview ({providers?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LOW BALANCE AUTOMATIONS & LIVE MONITOR */}
      {activeTab === "automations" && (
        <div className="space-y-6">
          
          {/* Error Alert Banner if recent API or messaging error */}
          {(autoSettings?.lastCheckError || autoSettings?.lastMessagingError) && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <span className="font-bold">Recent Monitoring Alert:</span>
                {autoSettings.lastCheckError && (
                  <p><span className="font-mono text-rose-600 font-bold">Provider API Error:</span> {autoSettings.lastCheckError}</p>
                )}
                {autoSettings.lastMessagingError && (
                  <p><span className="font-mono text-rose-600 font-bold">Fast2SMS Error:</span> {autoSettings.lastMessagingError}</p>
                )}
              </div>
            </div>
          )}

          {/* Top Row: Automation Status Card & Controls Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Live Monitoring Status & Immediate Action */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">A1Topup Wallet Monitor</h3>
                      <p className="text-xs text-slate-400 font-medium">Event-driven + 15m reconciliation</p>
                    </div>
                  </div>

                  {autoSettings && (
                    <button
                      onClick={() => handleToggleAutomation(autoSettings.enabled)}
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        autoSettings.enabled
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${autoSettings.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {autoSettings.enabled ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  )}
                </div>

                {/* Live Balance Metric */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-extrabold uppercase text-[10px] tracking-wider">A1Topup Provider Balance</span>
                    {autoSettings?.lastSuccessfulCheckAt && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Synced {formatDistanceToNow(new Date(autoSettings.lastSuccessfulCheckAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      currentLevel === 'CRITICAL_500'
                        ? 'text-red-600 dark:text-red-400 animate-pulse'
                        : currentLevel === 'LOW_1000'
                        ? 'text-orange-600 dark:text-orange-400'
                        : currentLevel === 'LOW_2000'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      {autoSettings?.lastBalance !== undefined && autoSettings?.lastBalance !== null
                        ? `₹${autoSettings.lastBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : 'Checking...'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">INR</span>
                  </div>

                  {/* Dynamic Alert Level Badge */}
                  {currentLevel === 'CRITICAL_500' ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 text-xs font-black border border-red-300 dark:border-red-900">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 animate-bounce" />
                      <span>CRITICAL ALERT (≤ ₹500) — Immediate Recharge Needed</span>
                    </div>
                  ) : currentLevel === 'LOW_1000' ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 text-xs font-black border border-orange-300 dark:border-orange-900">
                      <AlertCircle className="w-4 h-4 shrink-0 text-orange-600" />
                      <span>HIGH-PRIORITY ALERT (₹500.01 – ₹1,000)</span>
                    </div>
                  ) : currentLevel === 'LOW_2000' ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-amber-900">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>LOW BALANCE WARNING (₹1,000.01 – ₹2,000)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-900/40">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Wallet Healthy (&gt; ₹2,000)</span>
                    </div>
                  )}
                </div>

                {/* Real-time Metadata */}
                <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300 pt-1">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Current Alert Level</span>
                    <span className="font-bold font-mono">
                      {currentLevel === 'CRITICAL_500' ? 'CRITICAL (≤ ₹500)' :
                       currentLevel === 'LOW_1000' ? 'HIGH-PRIORITY (≤ ₹1,000)' :
                       currentLevel === 'LOW_2000' ? 'WARNING (< ₹2,000)' : 'NORMAL (SAFE)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Fallback Reconciliation</span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" /> Every {autoSettings?.reconcileIntervalMinutes || 15} min
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Next Reconciliation</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {autoSettings?.nextReconcileAt 
                        ? formatDistanceToNow(new Date(autoSettings.nextReconcileAt), { addSuffix: true })
                        : "In ~15 minutes"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Last Notification Sent</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {autoSettings?.lastAlertAt 
                        ? `${format(new Date(autoSettings.lastAlertAt), 'dd MMM, hh:mm a')} (${autoSettings.lastAlertLevel || 'Alert'})`
                        : 'No alert sent in current cycle'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Channel</span>
                    <span className="font-bold text-slate-900 dark:text-white uppercase">
                      {autoSettings?.channel || 'WHATSAPP'}
                    </span>
                  </div>
                </div>

                {/* Recipient Delivery Status Display */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                    <span>Recipients Delivery Status</span>
                    <span>{autoSettings?.recipients?.length || 2} Configured</span>
                  </div>
                  <div className="space-y-1.5">
                    {autoSettings?.recipients?.map((phone, idx) => {
                      const cleanP = phone.replace(/\D/g, "");
                      const statusObj = autoSettings?.lastRecipientsStatus?.find(r => r.recipient === cleanP);
                      const isSent = statusObj?.status === "SENT";
                      const isFailed = statusObj?.status === "FAILED";

                      return (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700 dark:text-slate-200">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{phone}</span>
                          </div>
                          {isSent ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1" title={statusObj?.requestId ? `Accepted: ${statusObj.requestId}` : 'Accepted'}>
                              <CheckCheck className="w-3 h-3" /> SENT {statusObj?.requestId ? `(${statusObj.requestId.slice(0, 8)})` : ''}
                            </span>
                          ) : isFailed ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full flex items-center gap-1" title={statusObj?.errorDetails || 'Failed'}>
                              <XCircle className="w-3 h-3" /> FAILED
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                              STANDBY
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Refresh Balance & Send Test */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleManualRefresh}
                  disabled={isCheckingBalanceNow}
                  className="w-full h-11 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingBalanceNow ? 'animate-spin' : ''}`} />
                  {isCheckingBalanceNow ? 'Fetching Live Provider Balance...' : 'Refresh Balance'}
                </Button>

                <Button
                  onClick={() => setIsTestModalOpen(true)}
                  variant="outline"
                  className="w-full h-10 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Send className="w-3.5 h-3.5 mr-2 text-slate-500" /> Send Test Alert Preview
                </Button>
              </div>
            </div>

            {/* Card 2 & 3: Approved WhatsApp Templates & Configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-6">
              
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Approved Fast2SMS WhatsApp Templates
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  The provider-wallet monitor uses only these 3 Meta-approved WhatsApp Utility templates.
                </p>
              </div>

              {/* Three Templates Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Template 1: 2000 */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Warning</span>
                      <Badge variant="outline" className="text-[9px] font-mono">&lt; ₹2,000</Badge>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      provider_wallet_low_balance_2000
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MsgID: 40230 • Meta: 165519901612689
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed line-clamp-4">
                    ⚠️ Your A1Topup wallet balance is below ₹2,000.<br/>
                    Current Balance: ₹&#123;&#123;1&#125;&#125;<br/>
                    Date &amp; Time: &#123;&#123;2&#125;&#125; IST
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Range: ₹1,000.01 – ₹2,000</span>
                    <span className={`w-2 h-2 rounded-full ${currentLevel === 'LOW_2000' ? 'bg-amber-500 animate-ping' : 'bg-slate-300'}`} />
                  </div>
                </div>

                {/* Template 2: 1000 */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider">High Priority</span>
                      <Badge variant="outline" className="text-[9px] font-mono">≤ ₹1,000</Badge>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      provider_wallet_low_balance_1000
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MsgID: 40235 • Meta: 112150956740956
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed line-clamp-4">
                    🚨 Your A1Topup provider wallet balance has fallen to ₹1,000 or below.<br/>
                    Current Balance: ₹&#123;&#123;1&#125;&#125;<br/>
                    Detected At: &#123;&#123;2&#125;&#125; IST
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Range: ₹500.01 – ₹1,000</span>
                    <span className={`w-2 h-2 rounded-full ${currentLevel === 'LOW_1000' ? 'bg-orange-500 animate-ping' : 'bg-slate-300'}`} />
                  </div>
                </div>

                {/* Template 3: 500 */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-red-600 tracking-wider">Critical</span>
                      <Badge variant="outline" className="text-[9px] font-mono text-red-500 border-red-300">≤ ₹500</Badge>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      provider_wallet_critical_balance_500
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MsgID: 40237 • Meta: 193212102821660
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed line-clamp-4">
                    🆘 CRITICAL: Your A1Topup provider wallet balance has fallen to ₹500 or below.<br/>
                    Current Balance: ₹&#123;&#123;1&#125;&#125;<br/>
                    Detected At: &#123;&#123;2&#125;&#125; IST
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Range: ₹0 – ₹500</span>
                    <span className={`w-2 h-2 rounded-full ${currentLevel === 'CRITICAL_500' ? 'bg-red-500 animate-ping' : 'bg-slate-300'}`} />
                  </div>
                </div>

              </div>

              {/* Automation Rules Configuration Form */}
              <form onSubmit={handleSaveSettings} className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-blue-500" /> Automation Tuning &amp; Notification Settings
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Min Refresh Interval */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Min Refresh Interval (Seconds)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={minRefreshInput}
                        onChange={(e) => setMinRefreshInput(Number(e.target.value))}
                        className="w-full pl-10 pr-4 h-11 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Reuses cached balance within {minRefreshInput}s to protect provider API</p>
                  </div>

                  {/* Fallback Reconcile Interval */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Fallback Reconciliation (Minutes)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={reconcileIntervalInput}
                        onChange={(e) => setReconcileIntervalInput(Number(e.target.value))}
                        className="w-full pl-10 pr-4 h-11 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Catches manual deductions &amp; missed events every {reconcileIntervalInput} minutes</p>
                  </div>
                </div>

                {/* Recipients Input */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Alert Recipient Numbers (Comma Separated) *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="8275366399, 9100329521"
                      value={recipientsInput}
                      onChange={(e) => setRecipientsInput(e.target.value)}
                      className="w-full pl-10 pr-4 h-11 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Both recipients receive alerts independently without duplicate spam.</p>
                </div>

                {/* Channel & Gateway */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Messaging Channel
                    </label>
                    <select
                      value={channelInput}
                      onChange={(e) => setChannelInput(e.target.value as "WHATSAPP" | "SMS")}
                      className="w-full px-3 h-11 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="WHATSAPP">WhatsApp Business API (Approved Fast2SMS Templates)</option>
                      <option value="SMS">Fast2SMS Quick SMS API</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Target Provider Gateway
                    </label>
                    <input
                      type="text"
                      disabled
                      value="A1Topup (Live Balance Endpoint)"
                      className="w-full px-4 h-11 text-xs bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingSettings}
                    className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    {isUpdatingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
                    Save Automation Settings
                  </Button>
                </div>

              </form>
            </div>

          </div>

          {/* Bottom Section: Execution History Logs Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-500" /> Monitoring &amp; Alert Audit Trail
                </h3>
                <p className="text-xs text-slate-400 font-medium">Historical audit trail of event triggers, reconciliations, manual refreshes, and delivery status.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Auto-Polling Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Trigger / Check ID</th>
                    <th className="py-3.5 px-4 text-right">Provider Balance</th>
                    <th className="py-3.5 px-4 text-center">Threshold Level</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-left">Recipients Delivery</th>
                    <th className="py-3.5 px-4 text-right">Detected At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLogsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-4"><div className="w-28 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                        <td className="py-4 px-4 text-center"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                        <td className="py-4 px-4 text-center"><div className="w-24 h-5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto" /></td>
                        <td className="py-4 px-4"><div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : logsData?.data?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-slate-400 font-medium">
                        No logs recorded yet. Real-time events and 15-minute reconciliation checks will log here.
                      </td>
                    </tr>
                  ) : (
                    logsData?.data?.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-xs transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {log.transactionId}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {log.triggerType === "RECONCILIATION" ? "15-Min Reconciliation" :
                             log.triggerType === "SCHEDULED_CHECK" ? "Scheduled Check" :
                             log.triggerType === "MANUAL_CHECK" ? "Manual Admin Refresh" :
                             log.triggerType === "EXTERNAL_CRON" ? "External Cron" :
                             "Recharge Event"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {log.providerBalance !== undefined && log.providerBalance !== null ? (
                            <span className={log.providerBalance < 2000 ? 'text-rose-600 font-black' : 'text-slate-900 dark:text-white'}>
                              ₹{log.providerBalance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">UNAVAILABLE</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.thresholdLevel === 'CRITICAL_500' ? (
                            <span className="text-[10px] font-black text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900">
                              CRITICAL (≤ ₹500)
                            </span>
                          ) : log.thresholdLevel === 'LOW_1000' ? (
                            <span className="text-[10px] font-black text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900">
                              HIGH-PRIORITY (≤ ₹1,000)
                            </span>
                          ) : log.thresholdLevel === 'LOW_2000' ? (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                              WARNING (&lt; ₹2,000)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              NORMAL (&ge; ₹2,000)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.overallStatus === 'ALERT_SENT' ? (
                            <Badge variant="success" className="px-2.5 py-0.5 text-[10px] font-bold">ALERT SENT</Badge>
                          ) : log.overallStatus === 'PARTIAL_SUCCESS' ? (
                            <Badge variant="warning" className="px-2.5 py-0.5 text-[10px] font-bold">PARTIAL SUCCESS</Badge>
                          ) : log.overallStatus === 'ALREADY_ALERTED' ? (
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[10px] font-bold text-amber-600 border-amber-300">ALREADY ALERTED</Badge>
                          ) : log.overallStatus === 'RECOVERED' ? (
                            <Badge variant="success" className="px-2.5 py-0.5 text-[10px] font-bold">RECOVERED</Badge>
                          ) : log.overallStatus === 'NO_ALERT_NEEDED' ? (
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[10px] font-bold text-slate-500">SAFE BALANCE</Badge>
                          ) : log.overallStatus === 'DISABLED' ? (
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[10px] font-bold text-slate-400">DISABLED</Badge>
                          ) : (
                            <Badge variant="error" className="px-2.5 py-0.5 text-[10px] font-bold">FAILED / ERROR</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            {log.recipientsStatus?.map((rec, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{rec.recipient}:</span>
                                {rec.status === 'SENT' ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> SENT {rec.requestId ? `(${rec.requestId.slice(0, 10)})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold flex items-center gap-0.5" title={rec.errorDetails}>
                                    <XCircle className="w-3 h-3" /> FAILED
                                  </span>
                                )}
                              </div>
                            ))}
                            {(!log.recipientsStatus || log.recipientsStatus.length === 0) && (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500 font-medium">
                          {format(new Date(log.detectedAt), 'MMM dd, HH:mm:ss')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: OVERVIEW & LIVE GATEWAY BALANCES */}
      {activeTab === "providers" && (
        <div className="space-y-6">
          {isProvidersLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground font-medium">Fetching API Provider Status...</p>
            </div>
          ) : providers?.length === 0 ? (
            <EmptyState 
              icon={Server} 
              title="No Providers Found" 
              description="The system has not registered any underlying API providers yet." 
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers?.map((provider) => {
                const isSyncing = syncingId === provider._id || isSyncingBalance;
                const isLowBalance = provider.balance < (autoSettings?.threshold || 2000);
                const subtitle = provider.providerName === 'Fast2SMS' ? 'WhatsApp & SMS Gateway' : 'Recharge Gateway';

                return (
                  <div 
                    key={provider._id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {provider.providerName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 px-2 py-1 rounded-full w-fit">
                          <ShieldCheck className="w-3.5 h-3.5" /> API Connected
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
                        <Server className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    <div className="p-6 space-y-6 flex-1">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Live Gateway Balance</p>
                        <div className="flex items-end gap-2">
                          <span className={`text-4xl font-mono font-bold tracking-tight ${isLowBalance ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                            ₹{provider.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-slate-500 font-medium mb-1">{provider.currency}</span>
                        </div>
                        {isLowBalance && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mt-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl w-fit border border-red-100 dark:border-red-900/30">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Low Balance Alert (&lt; ₹2,000)!
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Clock className="w-4 h-4" />
                        Last synced: {formatDistanceToNow(new Date(provider.lastCheckedAt), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        onClick={() => handleSync(provider._id)}
                        disabled={isSyncing}
                        className="w-full h-11 font-bold text-xs rounded-xl"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing Balance...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" /> Sync Live Balance
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Send Test Alert Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send Test Alert Preview</h3>
                  <p className="text-xs text-slate-400 font-medium">Verify Fast2SMS WhatsApp template delivery</p>
                </div>
              </div>
              <button onClick={() => setIsTestModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTest} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Select Template Alert Level
                </label>
                <select
                  value={testLevelInput}
                  onChange={(e) => setTestLevelInput(e.target.value as any)}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LOW_2000">₹2,000 Warning (provider_wallet_low_balance_2000)</option>
                  <option value="LOW_1000">₹1,000 High-Priority (provider_wallet_low_balance_1000)</option>
                  <option value="CRITICAL_500">₹500 Critical Alert (provider_wallet_critical_balance_500)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Test Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={testNumberInput}
                  onChange={(e) => setTestNumberInput(e.target.value)}
                  placeholder="e.g. 8275366399"
                  className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Delivery Channel
                </label>
                <select
                  value={testChannelInput}
                  onChange={(e) => setTestChannelInput(e.target.value as "WHATSAPP" | "SMS")}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="WHATSAPP">WhatsApp Business API (Approved Fast2SMS Template)</option>
                  <option value="SMS">Fast2SMS Quick SMS</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>Sends live preview with simulated balance and current IST timestamp to verify Fast2SMS formatting.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsTestModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSendingTest || !testNumberInput} className="bg-blue-600 text-white font-bold">
                  {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Dispatch Test Alert
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function SaveIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
