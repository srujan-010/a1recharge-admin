"use client";

import { use, useState } from "react";
import { 
  useRetailerProfile, 
  useUpdateRetailerStatus, 
  useUnlockRetailerAccount, 
  useUpdateRetailerAccountType,
  useResetRetailerSecurity,
  useRevokeRetailerSessions,
  useDeleteRetailer,
  useReleaseRetailerHold
} from "@/hooks/useRetailers";
import { useUpdateKycStatus } from "@/hooks/useKyc";
import { 
  ArrowLeft, Ban, CheckCircle, Wallet, FileText, Building, MapPin, ReceiptText, 
  Phone, Mail, CreditCard, ShieldCheck, Clock, Download, Eye, AlertCircle, Plus, 
  Minus, Send, RefreshCw, Key, Lock, Unlock, Loader2, Copy, Check, Search, Activity, Smartphone, 
  Sparkles, X, TrendingUp, IndianRupee, ArrowUpRight, ArrowDownRight, SmartphoneNfc, 
  MoreVertical, Edit, User, Fingerprint, Calendar, Zap, Layers, Trash2, LogOut, MessageSquare, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManualAdjustmentModal } from "@/components/retailer/ManualAdjustmentModal";
import { EditRetailerModal } from "@/components/retailers/EditRetailerModal";
import { SendPushModal } from "@/components/retailers/SendPushModal";
import { SendSmsModal } from "@/components/retailers/SendSmsModal";
import { TransactionDetailModal } from "@/components/retailers/TransactionDetailModal";
import { getPaymentMethod } from "@/lib/paymentUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountTypeBadge } from "@/components/ui/account-type-badge";
import { toast } from "sonner";
import api from "@/lib/api";

export default function RetailerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  // Queries & Mutations
  const { data: retailerData, isLoading, isError, refetch, isFetching } = useRetailerProfile(id);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateRetailerStatus();
  const { mutate: unlockAccount, isPending: isUnlocking } = useUnlockRetailerAccount();
  const { mutate: updateKycStatus, isPending: isUpdatingKyc } = useUpdateKycStatus();
  const { mutate: updateAccountType, isPending: isUpdatingAccType } = useUpdateRetailerAccountType();
  const resetSecurityMutation = useResetRetailerSecurity();
  const revokeSessionsMutation = useRevokeRetailerSessions();
  const deleteRetailerMutation = useDeleteRetailer();
  const releaseHoldMutation = useReleaseRetailerHold();

  // Modal States
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isAccountTypeModalOpen, setIsAccountTypeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isResetSecurityModalOpen, setIsResetSecurityModalOpen] = useState(false);
  const [isRevokeSessionsModalOpen, setIsRevokeSessionsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDropdownMenuOpen, setIsDropdownMenuOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);

  // Hold Release Modal States
  const [isHoldsModalOpen, setIsHoldsModalOpen] = useState(false);
  const [selectedHoldToRelease, setSelectedHoldToRelease] = useState<any | null>(null);
  const [isReleaseHoldConfirmOpen, setIsReleaseHoldConfirmOpen] = useState(false);
  const [isReleaseAllHold, setIsReleaseAllHold] = useState(false);
  const [releaseHoldRemarks, setReleaseHoldRemarks] = useState("");

  const [targetAccountType, setTargetAccountType] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "debit">("credit");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "timeline">("overview");

  // Table Filtering & Copy
  const [txnSearch, setTxnSearch] = useState("");
  const [txnStatusFilter, setTxnStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Retailer profile refreshed");
    } catch (err: any) {
      toast.error("Failed to refresh profile");
    }
  };

  const handleOpenAdjustment = (type: "credit" | "debit") => {
    setAdjustmentType(type);
    setIsAdjustmentModalOpen(true);
  };

  const handleCheckTxnStatus = async (orderId: string) => {
    try {
      toast.info(`Checking status for ${orderId}...`);
      await api.post(`/admin/recharges/${orderId}/action`, { action: 'CHECK_STATUS' });
      toast.success('Status checked successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to check status');
    }
  };

  const handleRefundTxn = async (orderId: string) => {
    try {
      if (!confirm(`Are you sure you want to refund transaction ${orderId}?`)) return;
      toast.info(`Processing refund for ${orderId}...`);
      await api.post(`/admin/recharges/${orderId}/action`, { action: 'REFUND', reason: 'Admin manual refund' });
      toast.success('Refund processed successfully');
      setSelectedTxn(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to process refund');
    }
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
    const matchesStatus = txnStatusFilter === 'all' || (txn.status || '').toUpperCase() === txnStatusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  // AI Insights Generation
  const insights = [];
  if (isLocked) insights.push({ type: 'error', text: '🔒 Account Locked' });
  if (business.successRate > 95 && business.monthlyRechargePaise > 1000000) insights.push({ type: 'success', text: 'Top Performing Retailer' });
  if (walletBalance < 500 && retailer.accountType === 'BUSINESS') insights.push({ type: 'warning', text: 'Wallet Balance Running Low' });
  if (business.successRate < 70 && business.failedRecharges > 5) insights.push({ type: 'error', text: 'High Failure Rate Detected' });
  if (retailer.kycStatus === 'pending') insights.push({ type: 'warning', text: 'Pending KYC Verification' });
  if (insights.length === 0) insights.push({ type: 'neutral', text: 'Normal Activity Levels' });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 animate-in fade-in duration-500">
      
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
              <AccountTypeBadge type={retailer.accountType} size="md" />
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
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> {retailer.phone}
                <button onClick={() => copyToClipboard(retailer.phone, "Phone")}><Copy className="w-3.5 h-3.5 hover:text-primary" /></button>
              </div>
              <div className="flex items-center gap-2"><Building className="w-4 h-4 text-slate-400" /> {retailer.shopName || 'No Shop Name'}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {retailer.city || 'Location N/A'}</div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Member Since: {new Date(retailer.createdAt).toLocaleDateString('en-IN')}</div>
              <div className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> App Version: v1.2.4</div>
              <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Successful Recharges: {business.successfulRecharges || 0}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 self-start lg:self-center relative">
          <Button onClick={handleRefresh} disabled={isFetching} variant="outline" className="h-10 bg-white dark:bg-slate-900 font-semibold">
            <RefreshCw className={`w-4 h-4 mr-2 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => setIsEditModalOpen(true)} variant="outline" className="h-10 bg-white dark:bg-slate-900 font-semibold">
            <Edit className="w-4 h-4 mr-2 text-slate-500" /> Edit Profile
          </Button>
          
          {/* Three Dot Dropdown Menu */}
          <div className="relative">
            <Button onClick={() => setIsDropdownMenuOpen(!isDropdownMenuOpen)} variant="outline" size="icon" className="h-10 w-10 bg-white dark:bg-slate-900">
              <MoreVertical className="w-4 h-4 text-slate-500" />
            </Button>

            {isDropdownMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                <button onClick={() => { setIsDropdownMenuOpen(false); setIsEditModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2">
                  <Edit className="w-4 h-4 text-indigo-500" /> Edit Retailer Profile
                </button>
                {isLocked && (
                  <button onClick={() => { setIsDropdownMenuOpen(false); setIsUnlockModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl flex items-center gap-2">
                    <Unlock className="w-4 h-4" /> Unlock Account
                  </button>
                )}
                {retailer.accountType === 'BUSINESS' && (
                  <button onClick={() => { setIsDropdownMenuOpen(false); handleOpenAdjustment('credit'); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-500" /> Adjust Wallet Balance
                  </button>
                )}
                {onHoldBalance > 0 && (
                  <button onClick={() => { setIsDropdownMenuOpen(false); setIsHoldsModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl flex items-center gap-2">
                    <Unlock className="w-4 h-4" /> Release Wallet Hold (₹{onHoldBalance.toFixed(2)})
                  </button>
                )}
                <button onClick={() => { setIsDropdownMenuOpen(false); setIsResetSecurityModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" /> Reset Password & MPIN
                </button>
                <button onClick={() => { setIsDropdownMenuOpen(false); setIsRevokeSessionsModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-purple-500" /> Revoke Active Sessions
                </button>
                {retailer.status === 'active' ? (
                  <button onClick={() => { setIsDropdownMenuOpen(false); updateStatus({ id: retailer._id, status: 'suspended' }, { onSuccess: () => { toast.success('Account suspended'); refetch(); } }); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-2">
                    <Ban className="w-4 h-4" /> Suspend Account
                  </button>
                ) : (
                  <button onClick={() => { setIsDropdownMenuOpen(false); updateStatus({ id: retailer._id, status: 'active' }, { onSuccess: () => { toast.success('Account activated'); refetch(); } }); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Activate Account
                  </button>
                )}
                <button onClick={() => { setIsDropdownMenuOpen(false); setIsDeleteModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                  <Trash2 className="w-4 h-4" /> Delete Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI INSIGHTS */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-500" /> Insights:
        </span>
        {insights.map((insight, i) => (
          <Badge key={i} variant={insight.type as any} className="px-3 py-1 bg-opacity-10 dark:bg-opacity-20 border shadow-sm font-medium">
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
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {retailer.accountType === 'PERSONAL' ? '—' : `₹${walletBalance.toFixed(2)}`}
          </div>
        </div>

        {/* Today's Recharge */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Today's Recharge <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{((business.todaysRechargePaise || 0) / 100).toFixed(2)}</div>
        </div>

        {/* Hold Amount */}
        <div 
          onClick={() => setIsHoldsModalOpen(true)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2 cursor-pointer hover:border-amber-500/50 transition-colors"
        >
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            Hold Amount <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono flex items-center justify-between">
            <span>{retailer.accountType === 'PERSONAL' ? '—' : `₹${onHoldBalance.toFixed(2)}`}</span>
            {onHoldBalance > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">Active</span>}
          </div>
        </div>

        {/* Company Profit */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex justify-between z-10 relative">
            Company Profit <IndianRupee className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono z-10 relative">
            ₹{(business.lifetimeCompanyProfit || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 z-10 relative">
            Today: +₹{(business.todaysCompanyProfit || 0).toFixed(2)}
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
            {retailer.accountType === 'PERSONAL' ? (
              <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 text-white relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 text-slate-300">
                  <Wallet className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold">Wallet Management</h3>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-200">Personal Account (No Wallet)</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Personal accounts process recharges directly without a retailer wallet balance. Wallet adjustments are not applicable.
                  </p>
                </div>
              </div>
            ) : (
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
                  <div className="text-right space-y-1">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Hold Balance</p>
                    <p className="text-lg font-bold font-mono text-amber-400">₹{onHoldBalance.toFixed(2)}</p>
                    {onHoldBalance > 0 && (
                      <Button
                        onClick={() => setIsHoldsModalOpen(true)}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-amber-500/50 text-amber-400 hover:bg-amber-950/50 font-bold"
                      >
                        <Unlock className="w-3 h-3 mr-1" /> Release Hold
                      </Button>
                    )}
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
            )}

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
                    <span className="font-bold font-mono text-indigo-600">₹{(business.lifetimeProviderCommission || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Retailer Comm. Paid</span>
                    <span className="font-bold font-mono text-rose-500">-₹{(business.lifetimeRetailerCommission || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300">Net Company Profit</span>
                    <span className="font-mono text-emerald-600 tracking-wide">₹{(business.lifetimeCompanyProfit || 0).toFixed(2)}</span>
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
              <Button 
                onClick={() => router.push(`/dashboard/transactions?retailer=${retailer.retailerId || retailer._id}`)} 
                variant="outline" 
                size="sm" 
                className="h-9 rounded-xl font-bold"
              >
                View Full Ledger
              </Button>
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
                  {filteredTransactions.slice(0, 5).map((txn: any) => {
                    const normStatus = (txn.status || '').toUpperCase();
                    const txnAmount = txn.amountPaise ? (txn.amountPaise / 100) : (txn.amount || 0);
                    const retComm = txn.retailerCommissionAmount ?? (txn.commissionEarnedPaise ? txn.commissionEarnedPaise / 100 : 0);
                    const companyProfit = txn.companyProfitAmount || 0;

                    return (
                      <tr 
                        key={txn._id} 
                        onClick={() => setSelectedTxn(txn)} 
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">{txn.referenceId || txn.orderId || txn._id.slice(-8)}</div>
                          <div className="text-[11px] text-slate-500">{new Date(txn.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-semibold text-slate-900 dark:text-white text-xs">{txn.operatorName || txn.internalOperatorName || 'Recharge'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 uppercase">{txn.serviceType || txn.service || 'mobile'}</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                              {getPaymentMethod(txn)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{txnAmount.toFixed(2)}
                        </td>
                        <td className="py-3 text-center">
                          <Badge 
                            variant={normStatus === 'SUCCESS' ? 'success' : normStatus === 'FAILED' ? 'error' : 'warning'} 
                            className="text-[10px] uppercase"
                          >
                            {normStatus}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="text-[11px] text-slate-500 font-mono">Ret: ₹{retComm.toFixed(2)}</div>
                          <div className="font-mono text-xs font-bold text-emerald-600">Profit: ₹{companyProfit.toFixed(2)}</div>
                        </td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {normStatus === 'PENDING' && (
                              <Button 
                                onClick={() => handleCheckTxnStatus(txn.orderId || txn.referenceId)} 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] px-2 rounded font-bold"
                              >
                                Check Status
                              </Button>
                            )}
                            {normStatus === 'SUCCESS' && (
                              <Button 
                                onClick={() => handleRefundTxn(txn.orderId || txn.referenceId)} 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] px-2 rounded text-rose-500 hover:text-rose-600 font-bold"
                              >
                                Refund
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                <span className="text-slate-500 font-semibold uppercase text-[11px]">Failed Attempt Count</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {(retailer.failedMpinAttempts || 0) + (retailer.failedLoginAttempts || 0)}
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

          {/* QUICK ACTIONS */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Quick Actions
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Communication</p>
                <div className="flex gap-2">
                  <Button onClick={() => setIsPushModalOpen(true)} size="sm" variant="outline" className="flex-1 bg-white dark:bg-slate-950 rounded-xl font-bold">
                    <Send className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Push
                  </Button>
                  <Button onClick={() => setIsSmsModalOpen(true)} size="sm" variant="outline" className="flex-1 bg-white dark:bg-slate-950 rounded-xl font-bold">
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> SMS
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
                  <Button onClick={() => setIsResetSecurityModalOpen(true)} size="sm" variant="outline" className="bg-white dark:bg-slate-950 rounded-xl font-bold">
                    <Key className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Reset Pass
                  </Button>
                  <Button onClick={() => setIsRevokeSessionsModalOpen(true)} size="sm" variant="outline" className="bg-white dark:bg-slate-950 rounded-xl font-bold">
                    <LogOut className="w-3.5 h-3.5 mr-1.5 text-purple-500" /> Logout
                  </Button>
                  {retailer.status === 'active' ? (
                    <Button onClick={() => updateStatus({ id: retailer._id, status: "suspended" }, { onSuccess: () => { toast.success('Account suspended'); refetch(); } })} size="sm" variant="outline" className="col-span-2 border-rose-200 text-rose-600 hover:bg-rose-50 bg-white dark:bg-slate-950 rounded-xl font-bold">
                      <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend Account
                    </Button>
                  ) : (
                    <Button onClick={() => updateStatus({ id: retailer._id, status: "active" }, { onSuccess: () => { toast.success('Account activated'); refetch(); } })} size="sm" variant="outline" className="col-span-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white dark:bg-slate-950 rounded-xl font-bold">
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Activate Account
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KYC CHECKLIST SECTION */}
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

          {/* BUSINESS PROFILE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" /> Retailer Information
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetAccountType(retailer.accountType === "BUSINESS" ? "PERSONAL" : "BUSINESS");
                  setIsAccountTypeModalOpen(true);
                }}
                className="h-8 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50"
              >
                <Edit className="w-3.5 h-3.5 mr-1" /> Change Account Type
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Account Type</span>
                <AccountTypeBadge type={retailer.accountType} size="sm" />
              </div>
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

          {/* BANK DETAILS */}
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
      
      {/* Interactive Modals */}
      <EditRetailerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        retailer={retailer}
      />

      <SendPushModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        retailer={retailer}
      />

      <SendSmsModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        retailer={retailer}
      />

      <TransactionDetailModal
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
        onCheckStatus={handleCheckTxnStatus}
        onRefund={handleRefundTxn}
      />

      <ManualAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        userId={retailer._id}
        retailerName={retailer.name}
        defaultType={adjustmentType}
      />

      {/* Unlock Account Confirmation Modal */}
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
                      toast.success("Retailer account unlocked successfully.");
                      setIsUnlockModalOpen(false);
                      refetch();
                    },
                    onError: (err: any) => {
                      toast.error(err?.response?.data?.message || err.message || "Failed to unlock account");
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

      {/* Reset Security Confirmation Modal */}
      {isResetSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Reset Security Credentials</h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Are you sure you want to reset security credentials and clear MPIN locks for this retailer?</p>
              <p className="text-xs text-slate-500 font-medium">The retailer will be prompted to set a new MPIN on their next login attempt.</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetSecurityModalOpen(false)}
                disabled={resetSecurityMutation.isPending}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await resetSecurityMutation.mutateAsync(retailer._id);
                    toast.success("Security credentials and MPIN reset successfully.");
                    setIsResetSecurityModalOpen(false);
                    refetch();
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || err.message || "Failed to reset security");
                  }
                }}
                disabled={resetSecurityMutation.isPending}
                className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {resetSecurityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Key className="w-4 h-4 mr-1.5" />}
                Reset Credentials
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Sessions Confirmation Modal */}
      {isRevokeSessionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Revoke Active Sessions</h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>Are you sure you want to log out all active mobile sessions and invalidate device tokens for this retailer?</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRevokeSessionsModalOpen(false)}
                disabled={revokeSessionsMutation.isPending}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await revokeSessionsMutation.mutateAsync(retailer._id);
                    toast.success("Active sessions revoked successfully.");
                    setIsRevokeSessionsModalOpen(false);
                    refetch();
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || err.message || "Failed to revoke sessions");
                  }
                }}
                disabled={revokeSessionsMutation.isPending}
                className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {revokeSessionsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LogOut className="w-4 h-4 mr-1.5" />}
                Revoke Sessions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Delete Retailer Account</h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name} ({retailer.retailerId})</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-bold text-rose-600">This action will deactivate the retailer account and block future access.</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteRetailerMutation.isPending}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await deleteRetailerMutation.mutateAsync(retailer._id);
                    toast.success("Retailer account deleted successfully.");
                    setIsDeleteModalOpen(false);
                    router.push('/dashboard/retailers');
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || err.message || "Failed to delete account");
                  }
                }}
                disabled={deleteRetailerMutation.isPending}
                className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {deleteRetailerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Account Type Confirmation Modal */}
      {isAccountTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Confirm Account Type Change</h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name} ({retailer.retailerId})</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-bold text-rose-600 dark:text-rose-400 text-xs uppercase tracking-wider">
                ⚠️ Warning: Changing account type affects commission calculation!
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                Switching this account from <span className="font-bold text-slate-900 dark:text-white">{retailer.accountType || "PERSONAL"}</span> to <span className="font-bold text-slate-900 dark:text-white">{targetAccountType}</span> will immediately change the commission slab applied to all future recharges performed by this retailer.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">New Target Type:</span>
                <AccountTypeBadge type={targetAccountType} size="sm" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAccountTypeModalOpen(false)}
                disabled={isUpdatingAccType}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  updateAccountType(
                    { id: retailer._id, accountType: targetAccountType },
                    {
                      onSuccess: () => {
                        toast.success(`Account type successfully changed to ${targetAccountType}`);
                        setIsAccountTypeModalOpen(false);
                        refetch();
                      },
                      onError: (err: any) => {
                        toast.error(err?.response?.data?.message || err.message || "Failed to change account type");
                      },
                    }
                  );
                }}
                disabled={isUpdatingAccType}
                className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {isUpdatingAccType ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Confirm & Update Type
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Active Wallet Holds Modal */}
      {isHoldsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-2xl w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Active Wallet Holds</h3>
                  <p className="text-xs text-slate-500 font-medium">{retailer.name} ({retailer.retailerId}) — Current Hold: <span className="font-mono font-bold text-amber-500">₹{onHoldBalance.toFixed(2)}</span></p>
                </div>
              </div>
              <button onClick={() => setIsHoldsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {retailer.activeHolds && retailer.activeHolds.length > 0 ? (
                retailer.activeHolds.map((hold: any) => {
                  const isProcessing = ['PROCESSING', 'INITIATED', 'RECHARGE_PROCESSING'].includes(hold.status);
                  const holdAmount = hold.reservedAmount > 0 ? hold.reservedAmount : hold.amount;

                  return (
                    <div key={hold._id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{hold.orderId}</span>
                            <Badge variant={hold.status === 'SUCCESS' ? 'success' : hold.status === 'FAILED' ? 'error' : 'warning'} className="text-[10px] uppercase">
                              {hold.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {hold.operatorCode || 'Recharge'} • {hold.mobileNumber} • {new Date(hold.createdAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-500 block uppercase">Held Amount</span>
                          <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">₹{holdAmount?.toFixed(2)}</span>
                        </div>
                      </div>

                      {isProcessing && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                          <span><strong>Active Transaction Notice:</strong> This recharge is actively processing with provider. Ensure provider status is verified before manual release.</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <Button
                          onClick={() => {
                            setSelectedHoldToRelease(hold);
                            setIsReleaseAllHold(false);
                            setReleaseHoldRemarks('');
                            setIsReleaseHoldConfirmOpen(true);
                          }}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs rounded-xl shadow-sm"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-1.5" /> Release Hold (₹{holdAmount?.toFixed(2)})
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {onHoldBalance > 0 ? "Unlinked Wallet Hold Detected" : "No Active Holds"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {onHoldBalance > 0
                      ? `The retailer has a wallet hold balance of ₹${onHoldBalance.toFixed(2)} recorded on their wallet ledger.`
                      : "The retailer currently has zero active wallet reservations."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              {onHoldBalance > 0 ? (
                <Button
                  onClick={() => {
                    setSelectedHoldToRelease(null);
                    setIsReleaseAllHold(true);
                    setReleaseHoldRemarks('');
                    setIsReleaseHoldConfirmOpen(true);
                  }}
                  variant="outline"
                  className="border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold h-10 text-xs rounded-xl"
                >
                  <Unlock className="w-4 h-4 mr-1.5" /> Release Entire Hold (₹{onHoldBalance.toFixed(2)})
                </Button>
              ) : <div />}

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHoldsModalOpen(false)}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Release Wallet Hold Confirmation Modal */}
      {isReleaseHoldConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {isReleaseAllHold ? 'Release All Wallet Holds?' : 'Release Wallet Hold'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{retailer.name} ({retailer.retailerId})</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              {/* Summary Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Reservation:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {isReleaseAllHold ? 'ALL ACTIVE HOLDS' : (selectedHoldToRelease?.orderId || 'MANUAL_RELEASE')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount to Release:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                    ₹{(isReleaseAllHold ? onHoldBalance : (selectedHoldToRelease?.reservedAmount || selectedHoldToRelease?.amount || onHoldBalance)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Available Wallet (Before ➔ After):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ₹{walletBalance.toFixed(2)} ➔ ₹{(walletBalance + (isReleaseAllHold ? onHoldBalance : (selectedHoldToRelease?.reservedAmount || selectedHoldToRelease?.amount || onHoldBalance))).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Warning Notice */}
              {selectedHoldToRelease && ['PROCESSING', 'INITIATED', 'RECHARGE_PROCESSING'].includes(selectedHoldToRelease.status) && (
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Warning:</strong> This transaction is actively processing. Verify provider state before releasing hold.</span>
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed">
                This action will release the held reservation back to the retailer's available wallet balance. A ledger record and audit log will be created.
              </p>

              {/* Mandatory Reason Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Admin Reason / Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={releaseHoldRemarks}
                  onChange={(e) => setReleaseHoldRemarks(e.target.value)}
                  placeholder="Enter mandatory reason for audit log..."
                  className="w-full h-20 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReleaseHoldConfirmOpen(false)}
                disabled={releaseHoldMutation.isPending}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!releaseHoldRemarks.trim() || releaseHoldMutation.isPending}
                onClick={async () => {
                  try {
                    const releaseAmount = isReleaseAllHold ? onHoldBalance : (selectedHoldToRelease?.reservedAmount || selectedHoldToRelease?.amount || onHoldBalance);
                    await releaseHoldMutation.mutateAsync({
                      id: retailer._id,
                      orderId: isReleaseAllHold ? undefined : selectedHoldToRelease?.orderId,
                      releaseAll: isReleaseAllHold,
                      remarks: releaseHoldRemarks
                    });
                    toast.success(`Successfully released ₹${releaseAmount.toFixed(2)} hold to retailer wallet.`);
                    setIsReleaseHoldConfirmOpen(false);
                    setIsHoldsModalOpen(false);
                    refetch();
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || err.message || "Failed to release hold");
                  }
                }}
                className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                {releaseHoldMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlock className="w-4 h-4 mr-1.5" />}
                Confirm Hold Release
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}