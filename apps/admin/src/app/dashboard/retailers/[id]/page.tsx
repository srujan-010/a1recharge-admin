"use client";

import { use, useState } from "react";
import { useRetailerProfile, useUpdateRetailerStatus, useUnlockRetailerAccount } from "@/hooks/useRetailers";
import { useUpdateKycStatus } from "@/hooks/useKyc";
import { 
  ArrowLeft, Ban, CheckCircle, Wallet, FileText, Building, MapPin, ReceiptText, 
  Phone, Mail, CreditCard, ShieldCheck, Clock, Download, Eye, AlertCircle, Plus, 
  Minus, Send, RefreshCw, Key, Lock, Unlock, Loader2, Copy, Check, Search, Activity, Smartphone, 
  Sparkles, X, TrendingUp, IndianRupee, ArrowUpRight, ArrowDownRight, SmartphoneNfc, 
  MoreVertical, Edit, User, Fingerprint, Calendar, Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManualAdjustmentModal } from "@/components/retailer/ManualAdjustmentModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RetailerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  // Queries & Mutations
  const { data: retailerData, isLoading, isError, refetch } = useRetailerProfile(id);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateRetailerStatus();
  const { mutate: unlockAccount, isPending: isUnlocking } = useUnlockRetailerAccount();
  const { mutate: updateKycStatus, isPending: isUpdatingKyc } = useUpdateKycStatus();

  // Modal & Tab States
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "debit">("credit");
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "timeline">("overview");

  // Table Filtering
  const [txnSearch, setTxnSearch] = useState("");
  const [txnStatusFilter, setTxnStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showToast(`${label} copied`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAdjustment = (type: "credit" | "debit") => {
    setAdjustmentType(type);
    setIsAdjustmentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Sparkles className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading Retailer 360° Profile...</p>
      </div>
    );
  }

  if (isError || !retailerData) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Not Found</h2>
        <Button onClick={() => router.back()} variant="outline" className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const retailer = retailerData;
  const isLocked = Boolean(retailer.isLocked || (retailer.lockUntil && new Date(retailer.lockUntil) > new Date()));
  const business = retailer.businessStats || {};
  const wallet = retailer.walletStats || {};
  
  const walletBalance = (retailer.wallet?.balancePaise || 0) / 100;
  const onHoldBalance = (retailer.wallet?.onHoldPaise || 0) / 100;
  const recentTxns = retailer.recentTransactions || [];

  const filteredTransactions = recentTxns.filter((txn: any) => {
    const matchesSearch = !txnSearch || 
      (txn.referenceId && txn.referenceId.toLowerCase().includes(txnSearch.toLowerCase())) ||
      (txn.operatorName && txn.operatorName.toLowerCase().includes(txnSearch.toLowerCase()));
    const matchesStatus = txnStatusFilter === 'all' || txn.status === txnStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // AI Insights Generation
  const insights = [];
  if (isLocked) insights.push({ type: 'error', text: '🔒 Account Locked' });
  if (business.successRate > 95 && business.monthlyRechargePaise > 1000000) insights.push({ type: 'success', text: 'Top Performing Retailer' });
  if (walletBalance < 500) insights.push({ type: 'warning', text: 'Wallet Balance Running Low' });
  if (business.successRate < 70 && business.failedRecharges > 5) insights.push({ type: 'error', text: 'High Failure Rate Detected' });
  if (retailer.kycStatus === 'pending') insights.push({ type: 'warning', text: 'Pending KYC Verification' });
  if (insights.length === 0) insights.push({ type: 'neutral', text: 'Normal Activity Levels' });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* Toast Banner */}
      {actionSuccessMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Link href="/dashboard/retailers" className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retailers
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white">{retailer.name}</span>
        </div>
      </div>

      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col lg:flex-row gap-8 justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center z-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-3xl flex items-center justify-center shadow-lg shrink-0 border-4 border-white dark:border-slate-800">
            {retailer.name ? retailer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'RT'}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{retailer.name}</h1>
              {isLocked ? (
                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 px-3 py-1 rounded-full font-bold text-xs shadow-sm uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </div>
              ) : (
                <Badge variant={retailer.status === 'active' ? 'success' : 'error'} className="capitalize px-3 py-1 text-xs shadow-sm">
                  {retailer.status}
                </Badge>
              )}
              <Badge variant={retailer.kycStatus === 'verified' ? 'success' : 'warning'} className="capitalize px-3 py-1 text-xs shadow-sm">
                KYC {retailer.kycStatus}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">ID: {retailer.retailerId}</span>
                <button onClick={() => copyToClipboard(retailer.retailerId, "ID")}><Copy className="w-3.5 h-3.5 hover:text-primary" /></button>
              </div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {retailer.phone}</div>
              <div className="flex items-center gap-2"><Building className="w-4 h-4 text-slate-400" /> {retailer.shopName || 'No Shop Name'}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {retailer.city || 'Location N/A'}</div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Member Since: {new Date(retailer.createdAt).toLocaleDateString('en-IN')}</div>
              <div className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Last Login: 2 hours ago</div>
              <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Last Recharge: 15 mins ago</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 self-start lg:self-center">
          <Button onClick={() => refetch()} variant="outline" className="h-10 bg-white dark:bg-slate-900">
            <RefreshCw className="w-4 h-4 mr-2 text-slate-500" /> Refresh
          </Button>
          <Button variant="outline" className="h-10 bg-white dark:bg-slate-900">
            <Edit className="w-4 h-4 mr-2 text-slate-500" /> Edit Profile
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 bg-white dark:bg-slate-900">
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </Button>
        </div>
      </div>

      {/* 12. AI INSIGHTS */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-500" /> Insights:
        </span>
        {insights.map((insight, i) => (
          <Badge key={i} variant={insight.type as any} className="px-3 py-1 bg-opacity-10 dark:bg-opacity-20 border shadow-sm">
            {insight.text}
          </Badge>
        ))}
      </div>

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Wallet */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Available Wallet <Wallet className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{walletBalance.toFixed(2)}</div>
        </div>

        {/* Today's Recharge */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Today's Recharge <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{((business.todaysRechargePaise || 0) / 100).toFixed(2)}</div>
        </div>

        {/* Hold Amount */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Hold Amount <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{onHoldBalance.toFixed(2)}</div>
        </div>

        {/* Company Profit */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex justify-between z-10 relative">
            Company Profit <IndianRupee className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono z-10 relative">
            ₹{((business.lifetimeCompanyProfit || 0) / 100).toFixed(2)}
          </div>
          <div className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 z-10 relative">
            Today: +₹{((business.todaysCompanyProfit || 0) / 100).toFixed(2)}
          </div>
        </div>

        {/* Pending Txns */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Pending <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{business.pendingRecharges || 0}</div>
        </div>

        {/* KYC Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            KYC Status <ShieldCheck className="w-4 h-4 text-slate-500" />
          </div>
          <div className={`text-xl font-black capitalize ${retailer.kycStatus === 'verified' ? 'text-emerald-600' : 'text-amber-500'}`}>
            {retailer.kycStatus || 'Pending'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Overview Cards */}
        <div className="xl:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 3. WALLET SECTION */}
            <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="flex items-center gap-2 mb-6 text-slate-300">
                <Wallet className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold">Wallet Management</h3>
              </div>
              
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Available Balance</p>
                  <p className="text-4xl font-black font-mono">₹{walletBalance.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Hold Balance</p>
                  <p className="text-lg font-bold font-mono text-amber-400">₹{onHoldBalance.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-800/60 mb-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Today's Credit</p>
                    <p className="text-sm font-bold font-mono text-emerald-400">+₹{((wallet.todaysCredit || 0) / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Lifetime Credit</p>
                    <p className="text-sm font-bold font-mono">+₹{((wallet.lifetimeCredit || 0) / 100).toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#FF5A5F]/15 px-3 py-2 rounded-lg border border-[#FF5A5F]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <p className="text-[10px] text-[#FF5A5F] font-black uppercase tracking-wider mb-0.5">Today's Debit</p>
                    <p className="text-[15px] font-black font-mono text-[#FF5A5F] drop-shadow-md">-₹{((wallet.todaysDebit || 0) / 100).toFixed(2)}</p>
                  </div>
                  <div className="px-3">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Lifetime Debit</p>
                    <p className="text-sm font-black font-mono text-[#FF5A5F] opacity-90">-₹{((wallet.lifetimeDebit || 0) / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={() => handleOpenAdjustment("credit")} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl">
                  <ArrowDownRight className="w-4 h-4 mr-1.5" /> Credit
                </Button>
                <Button onClick={() => handleOpenAdjustment("debit")} variant="outline" className="flex-1 border-slate-700 hover:bg-slate-800 text-white font-bold h-11 rounded-xl">
                  <ArrowUpRight className="w-4 h-4 mr-1.5" /> Debit
                </Button>
              </div>
            </div>

            {/* 4. BUSINESS PERFORMANCE */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Business Performance</h3>
              </div>
              
              <div className="space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 font-medium">Lifetime Recharge</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">₹{((business.lifetimeRechargePaise || 0) / 100).toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Success / Failed</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{business.successfulRecharges} / {business.failedRecharges}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block mb-1">Success Rate</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">{business.successRate}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Average Txn</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">₹{((business.averageRechargePaise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block mb-1">Highest Txn</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">₹{((business.highestRechargePaise || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Provider Comm. Received</span>
                    <span className="font-bold font-mono text-indigo-600">₹{((business.lifetimeProviderCommission || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Retailer Comm. Paid</span>
                    <span className="font-bold font-mono text-rose-500">-₹{((business.lifetimeRetailerCommission || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300">Net Company Profit</span>
                    <span className="font-mono text-emerald-600 tracking-wide">₹{((business.lifetimeCompanyProfit || 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 5. TRANSACTIONS TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
              </div>
              <Button variant="outline" size="sm" className="h-9 rounded-xl">View Full Ledger</Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Date & Ref</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Profit</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredTransactions.slice(0, 5).map((txn: any) => (
                    <tr key={txn._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{txn.referenceId || txn._id.slice(-8)}</div>
                        <div className="text-[11px] text-slate-500">{new Date(txn.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">{txn.operatorName || 'Recharge'}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{txn.service || 'mobile'}</div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{((txn.amountPaise || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <Badge variant={txn.status === 'success' ? 'success' : txn.status === 'failed' ? 'error' : 'warning'} className="text-[10px] uppercase">
                          {txn.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="text-[11px] text-slate-500 font-mono">Ret: ₹{((txn.commissionEarnedPaise || 0) / 100).toFixed(2)}</div>
                        <div className="font-mono text-xs font-bold text-emerald-600">Profit: ??</div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {txn.status === 'pending' && <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded">Check Status</Button>}
                          {txn.status === 'success' && <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded text-rose-500 hover:text-rose-600">Refund</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">No recent transactions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. DEVICE INFORMATION */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <SmartphoneNfc className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Device & Session</h3>
              </div>
              <Badge variant="success">Active Session</Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">App Version</p>
                <p className="font-mono font-medium text-slate-900 dark:text-white text-sm">v1.2.4 (Build 42)</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">OS Version</p>
                <p className="font-medium text-slate-900 dark:text-white text-sm">Android 14</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Device Model</p>
                <p className="font-medium text-slate-900 dark:text-white text-sm">Samsung Galaxy S23</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Last IP Address</p>
                <p className="font-mono font-medium text-slate-900 dark:text-white text-sm">49.36.12.24</p>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Info & Actions */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* LOCK STATUS & SECURITY DETAILS CARD */}
          <div className={`rounded-3xl p-6 shadow-sm border ${isLocked ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {isLocked ? <Lock className="w-5 h-5 text-rose-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                <h3 className="font-bold text-slate-900 dark:text-white">Lock Status & Security</h3>
              </div>
              <Badge variant={isLocked ? "error" : "success"} className="px-2.5 py-0.5 font-bold uppercase text-[11px]">
                {isLocked ? "🔒 Locked" : "Unlocked"}
              </Badge>
            </div>

            <div className="space-y-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Lock Status</span>
                <span className={`font-bold ${isLocked ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Lock Reason</span>
                <span className="font-bold text-slate-900 dark:text-white text-right max-w-[200px]">
                  {retailer.lockReason || (isLocked ? 'Too many failed OTP attempts' : 'None')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Lock Time</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {retailer.lockTime ? new Date(retailer.lockTime).toLocaleString('en-IN') : (isLocked ? 'Recent' : 'N/A')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Unlock Time</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {retailer.lockUntil ? new Date(retailer.lockUntil).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Failed Attempt Count</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {(retailer.failedMpinAttempts || 0) + (retailer.failedLoginAttempts || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Remaining Lock Duration</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {isLocked && retailer.lockUntil 
                    ? `${Math.max(0, Math.ceil((new Date(retailer.lockUntil).getTime() - Date.now()) / 60000))} mins`
                    : 'None'}
                </span>
              </div>

              {isLocked && (
                <div className="pt-3 border-t border-rose-200/60 dark:border-rose-900/40">
                  <Button
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4.5 h-4.5" />
                    <span>Unlock Account</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 11. QUICK ACTIONS */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Quick Actions
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Communication</p>
                <div className="flex gap-2">
                  <Button onClick={() => setNotificationModalOpen(true)} size="sm" variant="outline" className="flex-1 bg-white dark:bg-slate-950 rounded-xl">
                    <Send className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Push
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 bg-white dark:bg-slate-950 rounded-xl">
                    <Mail className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> SMS
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Account Security</p>
                <div className="grid grid-cols-2 gap-2">
                  {isLocked && (
                    <Button onClick={() => setIsUnlockModalOpen(true)} size="sm" className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                      <Unlock className="w-3.5 h-3.5 mr-1.5" /> Unlock Account
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="bg-white dark:bg-slate-950 rounded-xl">
                    <Key className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Reset Pass
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white dark:bg-slate-950 rounded-xl">
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Logout
                  </Button>
                  {retailer.status === 'active' ? (
                    <Button onClick={() => updateStatus({ id: retailer._id, status: "suspended" })} size="sm" variant="outline" className="col-span-2 border-rose-200 text-rose-600 hover:bg-rose-50 bg-white dark:bg-slate-950 rounded-xl">
                      <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend Account
                    </Button>
                  ) : (
                    <Button onClick={() => updateStatus({ id: retailer._id, status: "active" })} size="sm" variant="outline" className="col-span-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white dark:bg-slate-950 rounded-xl">
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Activate Account
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 10. KYC SECTION */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">KYC Checklist</h3>
              </div>
              <Badge variant={retailer.kycStatus === 'verified' ? 'success' : 'warning'}>{retailer.kycStatus}</Badge>
            </div>
            
            <div className="space-y-3">
              {[
                { name: 'PAN Card', status: retailer.panNumber ? 'verified' : 'missing' },
                { name: 'Aadhaar Card', status: retailer.aadhaarNumber ? 'verified' : 'missing' },
                { name: 'Selfie Photo', status: 'verified' },
                { name: 'Shop Proof', status: 'missing' },
              ].map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{doc.name}</span>
                  {doc.status === 'verified' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : doc.status === 'pending' ? (
                    <Clock className="w-4 h-4 text-amber-500" />
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Missing</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 8. BUSINESS PROFILE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-500" /> Identity Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">PAN</span>
                <span className="font-mono font-bold text-sm">{retailer.panNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Aadhaar</span>
                <span className="font-mono font-bold text-sm">{retailer.aadhaarNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">GSTIN</span>
                <span className="font-mono font-bold text-sm">{retailer.gstNumber || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* 9. BANK DETAILS */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" /> Settlement Bank
            </h3>
            {retailer.bank ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Bank</span>
                  <span className="font-bold text-sm">{retailer.bank.bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase">A/C No</span>
                  <span className="font-mono font-bold text-sm">{retailer.bank.accountNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase">IFSC</span>
                  <span className="font-mono font-bold text-sm text-indigo-600">{retailer.bank.ifscCode}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm font-medium">No Bank Added</p>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {/* Modals... */}
      <ManualAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        userId={retailer._id}
        retailerName={retailer.name}
        defaultType={adjustmentType}
      />

      {/* Unlock Retailer Account Confirmation Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Unlock Retailer Account</h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Are you sure you want to unlock this retailer account?</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">This will immediately allow the retailer to log in again.</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUnlockModalOpen(false)}
                disabled={isUnlocking}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  unlockAccount(retailer._id, {
                    onSuccess: () => {
                      showToast("Retailer account unlocked successfully.");
                      setIsUnlockModalOpen(false);
                      refetch();
                    },
                    onError: (err: any) => {
                      alert(err?.response?.data?.message || err.message || "Failed to unlock account");
                    }
                  });
                }}
                disabled={isUnlocking}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlock className="w-4 h-4 mr-1.5" />}
                Unlock Account
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}