"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  useWhatsAppTemplates, 
  useSendWhatsAppCampaign, 
  useWhatsAppRecipientStats,
  useSearchRetailers,
  WhatsAppTemplateItem 
} from "@/hooks/useWhatsAppBusiness";
import { 
  Send, Loader2, Image as ImageIcon, Target, 
  MessageSquare, Sparkles, X, Check, Eye, AlertTriangle, Users, CheckCircle2, UserX, UserCheck, Search, Info, Wallet, ShieldAlert, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TargetAudienceOption = 
  | 'ALL'
  | 'ACTIVE_ACCOUNTS'
  | 'ACTIVE_ACTIVITY'
  | 'INACTIVE_ACTIVITY'
  | 'PENDING_KYC'
  | 'ZERO_BALANCE'
  | 'LOW_WALLET'
  | 'BLOCKED'
  | 'LOCKED'
  | 'TARGETED_SEGMENT'
  | 'SINGLE';

const AUDIENCE_LABELS: Record<TargetAudienceOption, string> = {
  ALL: 'All Retailers',
  ACTIVE_ACCOUNTS: 'Active Accounts',
  ACTIVE_ACTIVITY: 'Active Activity — Last 10 Days',
  INACTIVE_ACTIVITY: 'Inactive Activity',
  PENDING_KYC: 'Pending KYC',
  ZERO_BALANCE: 'Zero Balance',
  LOW_WALLET: 'Low Wallet',
  BLOCKED: 'Blocked',
  LOCKED: 'Locked',
  TARGETED_SEGMENT: 'Targeted Segment',
  SINGLE: 'Single Retailer',
};

function ComposeContent() {
  const searchParams = useSearchParams();
  const preselectedMessageId = searchParams.get('messageId');

  // Targeting state
  const [recipients, setRecipients] = useState<TargetAudienceOption>("ALL");
  const [targetMobile, setTargetMobile] = useState("");
  
  // Single Retailer Search State
  const [retailerSearch, setRetailerSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<any | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Targeted Segment sub-filters state
  const [accountTypeFilter, setAccountTypeFilter] = useState("ALL");
  const [accountStatusFilter, setAccountStatusFilter] = useState("ALL");
  const [activityFilter, setActivityFilter] = useState("ALL");
  const [walletFilter, setWalletFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");

  // Template & Composer State
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateItem | null>(null);
  const [varInputs, setVarInputs] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");
  const [documentFilename, setDocumentFilename] = useState("");
  
  // Modals & UI State
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const { data: templates } = useWhatsAppTemplates({ search: templateSearch || undefined });
  const { data: searchResults, isLoading: isSearchLoading } = useSearchRetailers(retailerSearch);
  const { mutate: sendCampaign, isPending } = useSendWhatsAppCampaign();

  // Fetch live recipient stats & breakdown for selected mode and sub-filters
  const { data: recipientStats, isLoading: statsLoading } = useWhatsAppRecipientStats({
    recipients,
    targetMobile: recipients === 'SINGLE' ? (selectedRetailer?.phone || targetMobile) : undefined,
    singleRetailerId: recipients === 'SINGLE' ? selectedRetailer?._id : undefined,
    accountType: recipients === 'TARGETED_SEGMENT' ? accountTypeFilter : undefined,
    accountStatus: recipients === 'TARGETED_SEGMENT' ? accountStatusFilter : undefined,
    activity: recipients === 'TARGETED_SEGMENT' ? activityFilter : undefined,
    wallet: recipients === 'TARGETED_SEGMENT' ? walletFilter : undefined,
    kyc: recipients === 'TARGETED_SEGMENT' ? kycFilter : undefined,
  });

  // Auto pre-select template if messageId is passed in URL query param
  useEffect(() => {
    if (preselectedMessageId && templates && templates.length > 0) {
      const match = templates.find(t => String(t.messageId) === String(preselectedMessageId));
      if (match) {
        handleSelectTemplate(match);
      }
    }
  }, [preselectedMessageId, templates]);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSelectTemplate = (tpl: WhatsAppTemplateItem) => {
    setSelectedTemplate(tpl);
    const initialInputs: Record<string, string> = {};
    if (tpl.exampleValues && Array.isArray(tpl.exampleValues) && tpl.exampleValues.length > 0) {
      tpl.exampleValues.forEach((val: string, idx: number) => {
        initialInputs[`var_${idx + 1}`] = val;
      });
    } else {
      for (let i = 1; i <= (tpl.varCount || 0); i++) {
        initialInputs[`var_${i}`] = "";
      }
    }
    setVarInputs(initialInputs);
    setIsTemplateModalOpen(false);
  };

  const handleVarChange = (key: string, val: string) => {
    setVarInputs(prev => ({ ...prev, [key]: val }));
  };

  const formattedPipeVariables = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.varCount) return "";
    const arr: string[] = [];
    for (let i = 1; i <= selectedTemplate.varCount; i++) {
      arr.push(varInputs[`var_${i}`] || "");
    }
    return arr.join("|");
  }, [selectedTemplate, varInputs]);

  // Render live preview body text with var replacements
  const renderedPreviewBody = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.bodyText) return "";
    let text = selectedTemplate.bodyText;
    for (let i = 1; i <= (selectedTemplate.varCount || 0); i++) {
      const replacement = varInputs[`var_${i}`] || `{{${i}}}`;
      text = text.replace(new RegExp(`{{\\s*${i}\\s*}}`, 'g'), replacement);
    }
    return text;
  }, [selectedTemplate, varInputs]);

  const handleSelectRetailer = (ret: any) => {
    setSelectedRetailer(ret);
    setTargetMobile(ret.phone || "");
    setRetailerSearch(`${ret.name} (${ret.retailerId || ret.phone})`);
    setIsDropdownOpen(false);
  };

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      showToast("Please select a WhatsApp template first.", true);
      return;
    }
    if (!recipientStats || recipientStats.eligibleCount === 0) {
      showToast("Recipient count is 0. Cannot send campaign to an empty audience.", true);
      return;
    }
    if (recipients === 'SINGLE' && !targetMobile && !selectedRetailer) {
      showToast("Please select or enter a valid mobile number for Single Retailer.", true);
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSend = () => {
    if (!selectedTemplate) return;

    sendCampaign({
      recipients,
      targetMobile: recipients === 'SINGLE' ? (selectedRetailer?.phone || targetMobile) : undefined,
      singleRetailerId: recipients === 'SINGLE' ? selectedRetailer?._id : undefined,
      messageId: selectedTemplate.messageId,
      templateId: selectedTemplate.templateId,
      variablesValues: formattedPipeVariables,
      mediaUrl: mediaUrl || undefined,
      documentFilename: documentFilename || undefined,
      filters: recipients === 'TARGETED_SEGMENT' ? {
        accountType: accountTypeFilter,
        accountStatus: accountStatusFilter,
        activity: activityFilter,
        wallet: walletFilter,
        kyc: kycFilter
      } : undefined
    }, {
      onSuccess: (data) => {
        setIsConfirmModalOpen(false);
        showToast(data.message || `WhatsApp campaign dispatched to ${recipientStats?.eligibleCount || 0} recipients.`);
        setTargetMobile("");
        setSelectedRetailer(null);
        setRetailerSearch("");
        setMediaUrl("");
        setDocumentFilename("");
      },
      onError: (err: any) => {
        setIsConfirmModalOpen(false);
        showToast(err?.response?.data?.message || err.message || "Failed to dispatch campaign", true);
      }
    });
  };

  // Helper labels for current audience filter summary text
  const activitySummaryText = useMemo(() => {
    if (recipients === 'ACTIVE_ACTIVITY') return 'Last transaction within 10 days';
    if (recipients === 'INACTIVE_ACTIVITY') return 'No transaction for > 10 days';
    if (recipients === 'TARGETED_SEGMENT') {
      if (activityFilter === 'ACTIVE_10_DAYS') return 'Active in Last 10 Days';
      if (activityFilter === 'INACTIVE') return 'Inactive (> 10 Days)';
    }
    return 'All';
  }, [recipients, activityFilter]);

  const accountSummaryText = useMemo(() => {
    if (recipients === 'ACTIVE_ACCOUNTS') return 'Active Access Only';
    if (recipients === 'BLOCKED') return 'Blocked Accounts Only';
    if (recipients === 'LOCKED') return 'Locked Accounts Only';
    if (recipients === 'TARGETED_SEGMENT') {
      if (accountStatusFilter === 'ACTIVE') return 'Active';
      if (accountStatusFilter === 'BLOCKED') return 'Blocked';
      if (accountStatusFilter === 'LOCKED') return 'Locked';
    }
    return 'All';
  }, [recipients, accountStatusFilter]);

  const walletSummaryText = useMemo(() => {
    if (recipients === 'ZERO_BALANCE') return 'Zero Balance (₹0.00)';
    if (recipients === 'LOW_WALLET') return 'Low Wallet (> ₹0 and < ₹500)';
    if (recipients === 'TARGETED_SEGMENT') {
      if (walletFilter === 'ZERO_BALANCE') return 'Zero Balance (₹0.00)';
      if (walletFilter === 'LOW_WALLET') return 'Low Wallet (< ₹500)';
      if (walletFilter === 'HEALTHY') return 'Healthy Wallet (≥ ₹500)';
    }
    return 'All';
  }, [recipients, walletFilter]);

  const kycSummaryText = useMemo(() => {
    if (recipients === 'PENDING_KYC') return 'Pending Verification';
    if (recipients === 'TARGETED_SEGMENT') {
      if (kycFilter === 'COMPLETED') return 'Completed';
      if (kycFilter === 'PENDING') return 'Pending';
      if (kycFilter === 'NOT_STARTED') return 'Not Started';
    }
    return 'All';
  }, [recipients, kycFilter]);

  return (
    <div className="max-w-6xl space-y-6 animate-in fade-in duration-300 pb-20 font-sans text-slate-900 dark:text-slate-100">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          toastMsg.isError ? 'bg-rose-950 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          {toastMsg.isError ? <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span className="text-sm font-semibold">{toastMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleOpenConfirmModal} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Target Audience & Filtering */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" /> Target Audience
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Step 1 of 2</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Recipient Type
                </label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  value={recipients}
                  onChange={(e) => {
                    const val = e.target.value as TargetAudienceOption;
                    setRecipients(val);
                    if (val !== 'SINGLE') setSelectedRetailer(null);
                  }}
                >
                  {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* SINGLE RETAILER SEARCHABLE SELECTOR */}
              {recipients === 'SINGLE' && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Search & Select Retailer
                  </label>

                  <div className="relative">
                    <Input 
                      type="text"
                      placeholder="Search by Name, Mobile, ID or Shop..."
                      value={retailerSearch}
                      onChange={(e) => {
                        setRetailerSearch(e.target.value);
                        setIsDropdownOpen(true);
                        if (!e.target.value) {
                          setSelectedRetailer(null);
                          setTargetMobile("");
                        }
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      className="h-10 text-xs font-semibold bg-white dark:bg-slate-900 pr-8"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                    {/* Search Results Dropdown */}
                    {isDropdownOpen && retailerSearch.length >= 1 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar p-1">
                        {isSearchLoading ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching retailers...
                          </div>
                        ) : !searchResults || searchResults.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 font-medium">
                            No retailers matching "{retailerSearch}"
                          </div>
                        ) : (
                          searchResults.map((ret: any) => (
                            <div
                              key={ret._id}
                              onClick={() => handleSelectRetailer(ret)}
                              className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{ret.name}</span>
                                <Badge className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                                  {ret.retailerId}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Phone: {ret.phone} {ret.shopName ? `• Shop: ${ret.shopName}` : ''}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Retailer Card Display */}
                  {selectedRetailer ? (
                    <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{selectedRetailer.name}</span>
                        <Badge className="bg-indigo-600 text-white font-mono text-[9px]">{selectedRetailer.retailerId}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <div>Mobile: <span className="font-semibold text-slate-900 dark:text-white">{selectedRetailer.phone}</span></div>
                        <div>Account: <span className="font-semibold text-slate-900 dark:text-white">{selectedRetailer.accountType}</span></div>
                        <div>Wallet: <span className="font-semibold text-slate-900 dark:text-white">₹{(selectedRetailer.walletBalance || 0).toFixed(2)}</span></div>
                        <div>Activity: <span className={`font-semibold ${selectedRetailer.activityStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>{selectedRetailer.activityStatus}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Or Direct Mobile Number</label>
                      <Input 
                        type="tel"
                        placeholder="e.g. 9100329521"
                        value={targetMobile}
                        onChange={(e) => setTargetMobile(e.target.value)}
                        className="h-9 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TARGETED SEGMENT COMBINATION FILTERS */}
              {recipients === 'TARGETED_SEGMENT' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    Combined Target Filters
                  </span>

                  {/* Account Type */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Account Type</label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      value={accountTypeFilter}
                      onChange={(e) => setAccountTypeFilter(e.target.value)}
                    >
                      <option value="ALL">All Account Types</option>
                      <option value="PERSONAL">Personal</option>
                      <option value="BUSINESS">Business</option>
                    </select>
                  </div>

                  {/* Account Status */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Account Access Status</label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      value={accountStatusFilter}
                      onChange={(e) => setAccountStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active Only</option>
                      <option value="BLOCKED">Blocked Only</option>
                      <option value="LOCKED">Locked Only</option>
                    </select>
                  </div>

                  {/* Activity */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">10-Day Activity</label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                    >
                      <option value="ALL">All Activity States</option>
                      <option value="ACTIVE_10_DAYS">Active in Last 10 Days</option>
                      <option value="INACTIVE">Inactive (&gt; 10 Days)</option>
                    </select>
                  </div>

                  {/* Wallet */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Wallet Balance Segment</label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      value={walletFilter}
                      onChange={(e) => setWalletFilter(e.target.value)}
                    >
                      <option value="ALL">All Wallet Balances</option>
                      <option value="ZERO_BALANCE">Zero Balance (₹0.00)</option>
                      <option value="LOW_WALLET">Low Wallet (&lt; ₹500)</option>
                      <option value="HEALTHY">Healthy Wallet (≥ ₹500)</option>
                    </select>
                  </div>

                  {/* KYC */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">KYC Verification</label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      value={kycFilter}
                      onChange={(e) => setKycFilter(e.target.value)}
                    >
                      <option value="ALL">All KYC Statuses</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                      <option value="NOT_STARTED">Not Started</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CLEAN ENTERPRISE AUDIENCE SUMMARY SECTION */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recipients</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {statsLoading ? "..." : `${recipientStats?.eligibleCount || 0} retailers`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPreviewModalOpen(true)}
                    disabled={statsLoading || !recipientStats || recipientStats.totalCount === 0}
                    className="w-full h-9 text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" /> View Recipients
                  </Button>
                </div>

                {/* Subfilter Criteria Summary */}
                <div className="space-y-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                    <span className="text-slate-400 font-medium">Activity:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{activitySummaryText}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                    <span className="text-slate-400 font-medium">Account:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{accountSummaryText}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                    <span className="text-slate-400 font-medium">Wallet:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{walletSummaryText}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-400 font-medium">KYC:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{kycSummaryText}</span>
                  </div>
                </div>

                {/* Eligible / Skipped Breakdown */}
                {recipientStats && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Eligible recipients: {recipientStats.eligibleCount}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">
                        Skipped: {recipientStats.skippedCount}
                      </span>
                    </div>
                    {recipientStats.skippedCount > 0 && (
                      <p className="text-[10px] text-slate-400 italic">
                        Reason: {recipientStats.skippedNoPhone > 0 ? `${recipientStats.skippedNoPhone} missing phone` : ''} 
                        {recipientStats.skippedNoPhone > 0 && recipientStats.skippedInvalid > 0 ? ' • ' : ''}
                        {recipientStats.skippedInvalid > 0 ? `${recipientStats.skippedInvalid} invalid/disabled` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Media Header (Optional) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-500" /> Media Header (Optional)
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Public Media URL (Image/Video/PDF)</label>
                <Input 
                  type="url"
                  placeholder="https://example.com/banner.png or document.pdf"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              {mediaUrl.endsWith('.pdf') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">PDF Document Title</label>
                  <Input 
                    type="text"
                    placeholder="e.g. A1 Recharge Plan Guide.pdf"
                    value={documentFilename}
                    onChange={(e) => setDocumentFilename(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Template Picker & Message Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-7 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Fast2SMS WhatsApp Campaign Composer
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  Select an approved Meta WABA template and set dynamic variable parameters.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                variant="outline"
                className="gap-2 h-10 px-4 rounded-xl border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold text-xs shadow-sm shrink-0"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" /> Choose Approved Template
              </Button>
            </div>

            {/* Template Info Banner */}
            {!selectedTemplate ? (
              <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-indigo-500 mx-auto opacity-70" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No Template Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  Click "Choose Approved Template" above to pick a Meta WABA template synced from Fast2SMS.
                </p>
                <Button type="button" onClick={() => setIsTemplateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-5 rounded-xl text-xs">
                  Choose Template
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white font-bold text-[10px]">
                        {selectedTemplate.category}
                      </Badge>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedTemplate.templateName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Message ID: {selectedTemplate.messageId} • Language: {selectedTemplate.language} • {selectedTemplate.varCount} Variable(s)
                    </p>
                  </div>

                  <Button type="button" variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)} className="text-xs font-bold">
                    Change
                  </Button>
                </div>

                {/* Variable Input Fields */}
                {selectedTemplate.varCount > 0 && (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Dynamic Variables Input ({selectedTemplate.varCount})
                      </h4>
                      <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        Formatted Pipe: "{formattedPipeVariables}"
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: selectedTemplate.varCount }, (_, i) => i + 1).map(num => (
                        <div key={num}>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                            Variable {`{{${num}}}`}
                          </label>
                          <Input 
                            type="text" 
                            required
                            placeholder={`Value for {{${num}}}`}
                            value={varInputs[`var_${num}`] || ""}
                            onChange={(e) => handleVarChange(`var_${num}`, e.target.value)}
                            className="h-10 font-medium text-xs bg-white dark:bg-slate-900"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta WhatsApp Chat Box Preview */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> WhatsApp Message Live Preview
                  </p>
                  <div className="bg-[#efeae2] dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-slate-900 dark:text-white max-w-lg font-sans shadow-sm">
                    {selectedTemplate.headerText && (
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedTemplate.headerText}</p>
                    )}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-normal">
                      {renderedPreviewBody}
                    </p>
                    {selectedTemplate.footerText && (
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">{selectedTemplate.footerText}</p>
                    )}
                  </div>
                </div>

                {/* Submit / Send Campaign Trigger */}
                <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !selectedTemplate || (recipientStats && recipientStats.eligibleCount === 0)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 gap-2 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send WhatsApp Campaign ({recipientStats?.eligibleCount || 0} Recipients)
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </form>

      {/* 1. CHOOSE APPROVED TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[85vh] flex flex-col relative">
            
            <button 
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Select Approved WABA Template
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Choose a Meta-approved WhatsApp template fetched from Fast2SMS.
              </p>
            </div>

            <Input 
              type="text"
              placeholder="Search templates by name or body text..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="h-10 text-xs"
            />

            <div className="overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
              {!templates || templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  No approved WhatsApp templates found.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-600 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1.5 pr-4">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">
                          {tpl.category}
                        </Badge>
                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {tpl.templateName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
                        {tpl.bodyText}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Msg ID: {tpl.messageId} • {tpl.varCount} Variable(s)
                      </p>
                    </div>

                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-lg shrink-0"
                    >
                      Select
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)} className="h-9 px-4 rounded-xl font-bold text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PREVIEW RECIPIENTS MODAL ([View Recipients]) */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col relative">
            
            <button 
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Target Audience Recipients Preview
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Segment: <span className="font-bold text-slate-900 dark:text-white">{AUDIENCE_LABELS[recipients]}</span> • {recipientStats?.eligibleCount || 0} Eligible of {recipientStats?.totalCount || 0} total matching database retailers.
              </p>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Retailer Name</th>
                    <th className="py-2.5 px-3">Retailer ID</th>
                    <th className="py-2.5 px-3">Mobile</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Wallet Bal</th>
                    <th className="py-2.5 px-3 text-center">Activity</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {!recipientStats?.recipients || recipientStats.recipients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium text-xs">
                        No recipients found in this target segment.
                      </td>
                    </tr>
                  ) : (
                    recipientStats.recipients.map((r: any, idx: number) => (
                      <tr key={r._id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{r.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.retailerId}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{r.phone}</td>
                        <td className="py-2.5 px-3 text-[11px] font-medium">{r.accountType}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{(r.walletBalance || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.activityStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {r.activityStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.accountStatus === 'ACTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                            r.accountStatus === 'BLOCKED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {r.accountStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.isEligible ? (
                            <Badge className="bg-emerald-600 text-white font-bold text-[9px]">Eligible</Badge>
                          ) : (
                            <Badge variant="outline" className="text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-[9px] font-semibold" title={r.skipReason}>
                              {r.skipReason || 'Skipped'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                Showing all {recipientStats?.recipients?.length || 0} retailers in audience
              </span>
              <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)} className="h-9 px-4 rounded-xl font-bold text-xs">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SAFETY CONFIRMATION MODAL BEFORE SENDING */}
      {isConfirmModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 relative">
            
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Campaign Dispatch
                </h3>
                <p className="text-xs text-slate-500">
                  Verify campaign parameters before sending.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                You are about to send this WhatsApp template to:
              </p>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Recipients:</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                    {recipientStats?.eligibleCount || 0} retailers
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Audience:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {AUDIENCE_LABELS[recipients]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Template:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedTemplate.templateName} ({selectedTemplate.category})
                  </span>
                </div>
              </div>

              {selectedTemplate.varCount > 0 && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 font-medium block mb-1">Variable Values:</span>
                  <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all bg-slate-100 dark:bg-slate-900 p-2 rounded">
                    {formattedPipeVariables || "(None)"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isPending}
                className="h-10 px-5 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSend}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl text-xs gap-2 shadow-md shadow-indigo-600/20"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Confirm &amp; Send
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ComposeFast2SMSWhatsAppPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-slate-400 font-medium">
        Loading WhatsApp Composer...
      </div>
    }>
      <ComposeContent />
    </Suspense>
  );
}
