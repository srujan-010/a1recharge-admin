"use client";

import { useState } from "react";
import { 
  useProvidersList, 
  useRefreshProviderBalance,
  useProviderAutomationSettings,
  useUpdateProviderAutomationSettings,
  useProviderAutomationLogs,
  useSendProviderAutomationTest
} from "@/hooks/useProviders";
import { 
  Loader2, Server, RefreshCw, AlertTriangle, ShieldCheck, Clock, 
  Zap, Bell, CheckCircle, XCircle, Send, Check, Phone, Settings, 
  History, Sliders, Info, MessageSquare, AlertCircle
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProvidersPage() {
  const [activeTab, setActiveTab] = useState<"providers" | "automations">("automations");
  const { data: providers, isLoading: isProvidersLoading } = useProvidersList();
  const { mutate: refreshBalance, isPending } = useRefreshProviderBalance();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Automation Hooks
  const { data: autoSettings, isLoading: isSettingsLoading } = useProviderAutomationSettings();
  const { mutate: updateSettings, isPending: isUpdatingSettings } = useUpdateProviderAutomationSettings();
  
  const [logPage, setLogPage] = useState(1);
  const { data: logsData, isLoading: isLogsLoading } = useProviderAutomationLogs(logPage, 15);
  const { mutate: sendTestAlert, isPending: isSendingTest } = useSendProviderAutomationTest();

  // Test Alert Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testNumberInput, setTestNumberInput] = useState("9100329521");
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Editable Form State for Automations
  const [thresholdInput, setThresholdInput] = useState<number>(500);
  const [recipientsInput, setRecipientsInput] = useState<string>("9100329521, 8275366399");

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSync = (providerId: string) => {
    setSyncingId(providerId);
    refreshBalance(providerId, {
      onSettled: () => setSyncingId(null)
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecipients = recipientsInput.split(",").map(s => s.trim().replace(/\D/g, "")).filter(Boolean);
    if (cleanRecipients.length === 0) {
      showToast("At least one valid recipient mobile number is required", true);
      return;
    }

    updateSettings({
      threshold: thresholdInput,
      recipients: cleanRecipients,
    }, {
      onSuccess: () => showToast("Provider low wallet automation settings saved!"),
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Failed to update settings", true)
    });
  };

  const handleToggleAutomation = (currentEnabled: boolean) => {
    updateSettings({ enabled: !currentEnabled }, {
      onSuccess: () => showToast(`Automation ${!currentEnabled ? "ENABLED" : "DISABLED"}`),
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Failed to toggle automation", true)
    });
  };

  const handleExecuteTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumberInput.trim()) return;

    sendTestAlert(testNumberInput.trim(), {
      onSuccess: () => {
        setIsTestModalOpen(false);
        showToast(`Test WhatsApp alert sent to ${testNumberInput}`);
      },
      onError: (err: any) => showToast(err?.response?.data?.message || err.message || "Test dispatch failed", true)
    });
  };

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
          title="Providers & Gateway Automations"
          description="Manage underlying gateway providers, monitor real-time wallet balances, and configure low-balance WhatsApp automations."
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
            <span>Low Balance Automation</span>
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

      {/* TAB 1: LOW BALANCE AUTOMATIONS */}
      {activeTab === "automations" && (
        <div className="space-y-6">
          
          {/* Top Row: Automation Status Card & Controls Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Live Automation Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">A1Topup Low Balance Alert</h3>
                      <p className="text-xs text-slate-400 font-medium">WhatsApp Business Automation</p>
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
                      {autoSettings.enabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  )}
                </div>

                {/* Live Balance Metric */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-extrabold uppercase text-[10px] tracking-wider">A1Topup Live Balance</span>
                    {autoSettings?.lastCheckAt && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Synced {formatDistanceToNow(new Date(autoSettings.lastCheckAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      autoSettings?.lastStatus === 'LOW_BALANCE' 
                        ? 'text-rose-600 dark:text-rose-400' 
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      {autoSettings?.lastBalance !== undefined && autoSettings?.lastBalance !== null
                        ? `₹${autoSettings.lastBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : 'UNKNOWN'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">INR</span>
                  </div>

                  {/* Status Banner */}
                  {autoSettings?.lastStatus === 'LOW_BALANCE' ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900/40">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>CRITICAL LOW BALANCE (&lt; ₹{autoSettings?.threshold || 500})</span>
                    </div>
                  ) : autoSettings?.lastStatus === 'NORMAL' ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Wallet Balance Normal (&ge; ₹{autoSettings?.threshold || 500})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
                      <Info className="w-4 h-4 shrink-0 text-slate-400" />
                      <span>Balance status unknown or initializing</span>
                    </div>
                  )}
                </div>

                {/* Configuration Summary Metadata */}
                <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300 pt-1">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Trigger Event</span>
                    <span className="font-bold text-slate-900 dark:text-white">After every successful recharge</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Alert Threshold</span>
                    <span className="font-bold text-amber-600 font-mono">₹{autoSettings?.threshold || 500}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">WhatsApp Template</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{autoSettings?.templateName || 'provider_wallet_low_balance'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Target Recipients</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {autoSettings?.recipients?.length || 2} numbers ({autoSettings?.recipients?.join(", ") || '9100329521, 8275366399'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Send Test */}
              <Button
                onClick={() => setIsTestModalOpen(true)}
                variant="outline"
                className="w-full h-11 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Send className="w-3.5 h-3.5 mr-2 text-blue-500" /> Send Test Alert Preview
              </Button>
            </div>

            {/* Card 2 & 3: Configuration Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-500" /> Automation Rules & Recipients
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Configure threshold limits and WhatsApp alert recipients.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Threshold Input */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Low Balance Threshold (INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min={100}
                        max={50000}
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(Number(e.target.value))}
                        className="w-full pl-8 pr-4 h-11 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Alert triggers when balance &lt; ₹{thresholdInput}</p>
                  </div>

                  {/* Provider Name (Read-only) */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Target Provider Gateway
                    </label>
                    <input
                      type="text"
                      disabled
                      value="A1Topup (Live Integration)"
                      className="w-full px-4 h-11 text-xs bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Main global recharge provider</p>
                  </div>

                </div>

                {/* Recipients Input */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    WhatsApp Recipient Numbers (Comma Separated) *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="9100329521, 8275366399"
                      value={recipientsInput}
                      onChange={(e) => setRecipientsInput(e.target.value)}
                      className="w-full pl-10 pr-4 h-11 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Both numbers will receive the approved Fast2SMS WhatsApp alert when balance drops below threshold.</p>
                </div>

                {/* Template Info Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Fast2SMS WABA Template Details
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">en_US • UTILITY</Badge>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    Template: <span className="font-bold text-slate-900 dark:text-white">{autoSettings?.templateName || 'provider_wallet_low_balance'}</span> (ID: {autoSettings?.messageId || 27147})
                  </p>
                  <div className="text-[11px] text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                    🚨 A1 Recharge Alert — Current Balance: ₹&#123;&#123;1&#125;&#125; | Threshold: ₹500 | Detected At: &#123;&#123;2&#125;&#125; IST
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingSettings}
                    className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    {isUpdatingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
                    Save Automation Rules
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
                  <History className="w-4 h-4 text-purple-500" /> Automation Execution Logs
                </h3>
                <p className="text-xs text-slate-400 font-medium">Real-time audit trail of background low balance checks following successful recharges.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Auto Refresh</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Transaction ID</th>
                    <th className="py-3.5 px-4 text-right">Recharge Amount</th>
                    <th className="py-3.5 px-4 text-right">A1Topup Balance</th>
                    <th className="py-3.5 px-4 text-center">Threshold</th>
                    <th className="py-3.5 px-4 text-center">Automation Status</th>
                    <th className="py-3.5 px-4 text-left">Recipients Status</th>
                    <th className="py-3.5 px-4 text-right">Detected At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLogsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-4"><div className="w-28 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                        <td className="py-4 px-4 text-center"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                        <td className="py-4 px-4 text-center"><div className="w-24 h-5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto" /></td>
                        <td className="py-4 px-4"><div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : logsData?.data?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-slate-400 font-medium">
                        No automation logs recorded yet. Logs will generate automatically after successful global recharges.
                      </td>
                    </tr>
                  ) : (
                    logsData?.data?.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-xs transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {log.transactionId}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{log.rechargeAmount || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {log.providerBalance !== undefined && log.providerBalance !== null ? (
                            <span className={log.providerBalance < log.threshold ? 'text-rose-600 font-black' : 'text-slate-900 dark:text-white'}>
                              ₹{log.providerBalance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">UNAVAILABLE</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                          ₹{log.threshold}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.overallStatus === 'ALERT_SENT' ? (
                            <Badge variant="success" className="px-2.5 py-0.5 text-[10px] font-bold">ALERT SENT</Badge>
                          ) : log.overallStatus === 'PARTIAL_SUCCESS' ? (
                            <Badge variant="warning" className="px-2.5 py-0.5 text-[10px] font-bold">PARTIAL SUCCESS</Badge>
                          ) : log.overallStatus === 'NO_ALERT_NEEDED' ? (
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[10px] font-bold text-slate-500">NORMAL BALANCE</Badge>
                          ) : log.overallStatus === 'DISABLED' ? (
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[10px] font-bold text-slate-400">DISABLED</Badge>
                          ) : (
                            <Badge variant="error" className="px-2.5 py-0.5 text-[10px] font-bold">FAILED / SKIPPED</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            {log.recipientsStatus?.map((rec, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{rec.recipient}:</span>
                                {rec.status === 'SENT' ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> SENT
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
                const isSyncing = syncingId === provider._id || isPending;
                const isLowBalance = provider.balance < 500;
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
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Low Balance Alert (&lt; ₹500)!
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
                  <p className="text-xs text-slate-400 font-medium">Verify Fast2SMS WhatsApp delivery</p>
                </div>
              </div>
              <button onClick={() => setIsTestModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTest} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Test WhatsApp Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={testNumberInput}
                  onChange={(e) => setTestNumberInput(e.target.value)}
                  placeholder="e.g. 9100329521"
                  className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>This will send a live WhatsApp test alert using the approved <code className="font-bold">provider_wallet_low_balance</code> template.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsTestModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSendingTest || !testNumberInput} className="bg-blue-600 text-white font-bold">
                  {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Dispatch Test WhatsApp
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
