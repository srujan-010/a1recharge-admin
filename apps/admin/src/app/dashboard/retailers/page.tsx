"use client";

import { useState, useMemo } from "react";
import { 
  useRetailersList, 
  useUpdateRetailerStatus, 
  useUnlockRetailerAccount, 
  useCreateRetailer, 
  Retailer 
} from "@/hooks/useRetailers";
import { 
  Search, Loader2, Eye, Ban, CheckCircle, ChevronLeft, ChevronRight, 
  Users, Plus, Download, Copy, Check, X, Phone, Edit, FileText, 
  ShieldCheck, Bell, ChevronDown, Wallet, History, Building2, MapPin, 
  Activity, Smartphone, Lock, Unlock, AlertTriangle, RefreshCw, MoreVertical
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ManualAdjustmentModal } from "@/components/retailer/ManualAdjustmentModal";
import { Button } from "@/components/ui/button";

export default function RetailersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [kycFilter, setKycFilter] = useState("all");
  
  // Quick Filter Tabs
  const [quickFilter, setQuickFilter] = useState("All");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<{ id: string; name: string; type: "credit" | "debit" } | null>(null);
  const [unlockModalTarget, setUnlockModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // New Retailer Form State
  const [newRetailer, setNewRetailer] = useState<{
    name: string;
    phone: string;
    email: string;
    shopName: string;
    city: string;
    state: string;
    accountType: "PERSONAL" | "BUSINESS";
  }>({
    name: "",
    phone: "",
    email: "",
    shopName: "",
    city: "",
    state: "",
    accountType: "PERSONAL",
  });

  // Hooks
  const { data, isLoading, isFetching, refetch } = useRetailersList(page, pageSize, search, statusFilter, accountTypeFilter as any);
  const { mutate: updateStatus } = useUpdateRetailerStatus();
  const { mutate: unlockAccount, isPending: isUnlocking } = useUnlockRetailerAccount();
  const { mutate: createRetailer, isPending: isCreating } = useCreateRetailer();

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const handleCopyId = (retailerId: string) => {
    navigator.clipboard.writeText(retailerId);
    setCopiedId(retailerId);
    showToast(`Retailer ID ${retailerId} copied`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateRetailer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRetailer.name.trim() || !newRetailer.phone.trim()) return;

    createRetailer(newRetailer, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setNewRetailer({ name: "", phone: "", email: "", shopName: "", city: "", state: "", accountType: "PERSONAL" });
        showToast("New retailer account created successfully!");
        refetch();
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message || "Failed to create retailer", true);
      }
    });
  };

  const list: Retailer[] = data?.data || [];
  const isAccountLocked = (r: Retailer) => Boolean(r.isLocked || (r.lockUntil && new Date(r.lockUntil) > new Date()));

  // Filtered List Logic
  const filteredList = useMemo(() => {
    let result = list.filter(r => kycFilter === 'all' || r.kycStatus === kycFilter);
    
    if (quickFilter === 'Active') {
      result = result.filter(r => r.status === 'active' && !isAccountLocked(r));
    } else if (quickFilter === 'Locked') {
      result = result.filter(r => isAccountLocked(r));
    } else if (quickFilter === 'Pending KYC') {
      result = result.filter(r => r.kycStatus === 'pending');
    } else if (quickFilter === 'Blocked') {
      result = result.filter(r => r.status === 'blocked');
    } else if (quickFilter === 'Low Wallet') {
      result = result.filter(r => r.accountType !== 'PERSONAL' && (r.walletBalancePaise || 0) < 50000); // < ₹500
    }

    if (statusFilter === 'locked') {
      result = result.filter(r => isAccountLocked(r));
    } else if (statusFilter === 'unlocked') {
      result = result.filter(r => !isAccountLocked(r));
    }

    return result;
  }, [list, kycFilter, quickFilter, statusFilter]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map(r => r._id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Active Filters Check
  const hasActiveFilters = search || accountTypeFilter !== 'all' || statusFilter !== 'all' || kycFilter !== 'all' || quickFilter !== 'All';

  const resetAllFilters = () => {
    setSearch("");
    setSearchInput("");
    setAccountTypeFilter("all");
    setStatusFilter("all");
    setKycFilter("all");
    setQuickFilter("All");
    setPage(1);
  };

  // Export File Generator
  const handleExport = (formatType: 'csv' | 'excel', exportType: 'all' | 'filtered' | 'selected' = 'filtered') => {
    setIsExportOpen(false);
    let targetData = filteredList;
    if (exportType === 'selected') {
      targetData = filteredList.filter(r => selectedIds.includes(r._id));
    }

    if (targetData.length === 0) return;

    const headers = ["Retailer ID,Name,Account Type,Phone,Email,Shop Name,City,State,Wallet Balance (INR),Status,KYC Status,Joined Date\n"];
    const rows = targetData.map(r => 
      `"${r.retailerId}","${r.name}","${r.accountType || 'PERSONAL'}","${r.phone}","${r.email || ''}","${r.shopName || ''}","${r.city || ''}","${r.state || ''}","${(r.walletBalancePaise / 100).toFixed(2)}","${r.status}","${r.kycStatus}","${r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : ''}"\n`
    );

    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retailers_export_${new Date().toISOString().split('T')[0]}.${formatType === 'csv' ? 'csv' : 'xls'}`;
    a.click();
    showToast(`Exported ${targetData.length} retailers to ${formatType.toUpperCase()}`);
  };
  
  // Summary Stats Calculations
  const totalRetailers = data?.pagination?.total || 0;
  const activeCount = list.filter(r => r.status === 'active' && !isAccountLocked(r)).length;
  const lockedCount = list.filter(r => isAccountLocked(r)).length;
  const pendingKycCount = list.filter(r => r.kycStatus === 'pending').length;
  const blockedCount = list.filter(r => r.status === 'blocked').length;
  const lowWalletCount = list.filter(r => r.accountType !== 'PERSONAL' && (r.walletBalancePaise || 0) < 50000).length;
  
  const totalWalletBal = list
    .filter(r => r.accountType !== 'PERSONAL')
    .reduce((acc, r) => acc + (r.walletBalancePaise || 0), 0) / 100;

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20 animate-in fade-in duration-200 font-sans text-slate-900 dark:text-slate-100">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-3 duration-200 ${
          toastMsg.isError ? 'bg-rose-900 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastMsg.isError ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Retailers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">
            Manage retailer accounts, wallets, KYC status, activity and access.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          
          {/* Export Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setIsExportOpen(prev => !prev)}
              variant="outline"
              className="h-9 px-3.5 text-xs font-semibold rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Export
              <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
            </Button>

            {isExportOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-1 z-50 text-left">
                <button
                  onClick={() => handleExport('csv', 'filtered')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => handleExport('excel', 'filtered')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export Excel</span>
                </button>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => handleExport('csv', 'selected')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-md"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                    <span>Export Selected ({selectedIds.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary CTA: Add Retailer */}
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Retailer
          </Button>

        </div>
      </div>
      
      {/* 6 Clean Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Retailers */}
        <div 
          onClick={() => { setQuickFilter("All"); setPage(1); }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            quickFilter === 'All'
              ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Retailers</span>
          <p className="text-2xl font-bold font-sans text-slate-900 dark:text-white mt-1">{totalRetailers}</p>
          <span className="text-xs font-normal text-slate-500">{activeCount} active</span>
        </div>

        {/* Active */}
        <div 
          onClick={() => { setQuickFilter("Active"); setPage(1); }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            quickFilter === 'Active'
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active</span>
          <p className="text-2xl font-bold font-sans text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
          <span className="text-xs font-normal text-slate-500">
            {totalRetailers > 0 ? Math.round((activeCount / totalRetailers) * 100) : 0}% of total
          </span>
        </div>

        {/* Pending KYC */}
        <div 
          onClick={() => { setQuickFilter("Pending KYC"); setPage(1); }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            quickFilter === 'Pending KYC'
              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending KYC</span>
          <p className="text-2xl font-bold font-sans text-amber-600 dark:text-amber-400 mt-1">{pendingKycCount}</p>
          <span className="text-xs font-normal text-slate-500">Requires review</span>
        </div>

        {/* Blocked */}
        <div 
          onClick={() => { setQuickFilter("Blocked"); setPage(1); }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            quickFilter === 'Blocked'
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Blocked</span>
          <p className="text-2xl font-bold font-sans text-rose-600 dark:text-rose-400 mt-1">{blockedCount}</p>
          <span className="text-xs font-normal text-slate-500">Restricted</span>
        </div>

        {/* Low Wallet */}
        <div 
          onClick={() => { setQuickFilter("Low Wallet"); setPage(1); }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            quickFilter === 'Low Wallet'
              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Low Wallet</span>
          <p className="text-2xl font-bold font-sans text-amber-600 dark:text-amber-400 mt-1">{lowWalletCount}</p>
          <span className="text-xs font-normal text-slate-500">&lt; ₹500 balance</span>
        </div>

        {/* Total Wallet Balance */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Wallet</span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 truncate">
            ₹{totalWalletBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs font-normal text-slate-500">Business balance</span>
        </div>

      </div>
      
      {/* Segmented Filter Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 overflow-x-auto custom-scrollbar text-xs font-medium">
        {[
          { id: 'All', label: `All (${totalRetailers})` },
          { id: 'Active', label: `Active (${activeCount})` },
          { id: 'Locked', label: `Locked (${lockedCount})` },
          { id: 'Pending KYC', label: `Pending KYC (${pendingKycCount})` },
          { id: 'Blocked', label: `Blocked (${blockedCount})` },
          { id: 'Low Wallet', label: `Low Wallet (${lowWalletCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setQuickFilter(tab.id); setPage(1); }}
            className={`py-2.5 whitespace-nowrap border-b-2 transition-colors ${
              quickFilter === tab.id 
                ? 'border-blue-600 text-blue-600 font-semibold' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between">
          
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search retailers by name, phone, shop, or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 h-9 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
            {searchInput && (
              <button type="button" onClick={handleClearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            
            {/* Account Type Filter */}
            <select
              value={accountTypeFilter}
              onChange={(e) => { setAccountTypeFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Account: All</option>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="unlocked">Unlocked</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>

            {/* KYC Filter */}
            <select
              value={kycFilter}
              onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">KYC: All</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="none">None</option>
            </select>

            {/* Bulk Actions Button */}
            {selectedIds.length > 0 && (
              <div className="relative">
                <Button
                  onClick={() => setIsBulkOpen(prev => !prev)}
                  className="h-9 px-3 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Bulk Actions ({selectedIds.length})
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>

                {isBulkOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-1 z-50 text-left">
                    <button
                      onClick={() => {
                        setIsBulkOpen(false);
                        showToast(`Push notification dispatched to ${selectedIds.length} retailers`);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                    >
                      <Bell className="w-3.5 h-3.5 text-blue-500" />
                      <span>Push Notification</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsBulkOpen(false);
                        if (confirm(`Suspend ${selectedIds.length} selected retailers?`)) {
                          selectedIds.forEach(id => updateStatus({ id, status: 'suspended', reason: 'Bulk Action' }));
                          showToast(`Suspended ${selectedIds.length} retailers`);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Bulk Suspend</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Filters:</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                Search: "{search}"
                <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => { setSearch(""); setSearchInput(""); }} />
              </span>
            )}
            {quickFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                Scope: {quickFilter}
                <X className="w-3 h-3 cursor-pointer text-blue-500 hover:text-blue-700" onClick={() => setQuickFilter("All")} />
              </span>
            )}
            {accountTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                Account: {accountTypeFilter}
                <X className="w-3 h-3 cursor-pointer text-purple-500 hover:text-purple-700" onClick={() => setAccountTypeFilter("all")} />
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                Status: {statusFilter}
                <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setStatusFilter("all")} />
              </span>
            )}
            {kycFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                KYC: {kycFilter}
                <X className="w-3 h-3 cursor-pointer text-amber-500 hover:text-amber-700" onClick={() => setKycFilter("all")} />
              </span>
            )}
            <button
              onClick={resetAllFilters}
              className="text-xs font-semibold text-blue-600 hover:underline ml-1"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Retailers Table (Desktop) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && selectedIds.length === filteredList.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Retailer</th>
                <th className="py-3 px-4 text-center">Account</th>
                <th className="py-3 px-4 text-right">Wallet Balance</th>
                <th className="py-3 px-4 text-right">Today's Recharge</th>
                <th className="py-3 px-4 text-right">Monthly Recharge</th>
                <th className="py-3 px-4 text-center">Device</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4 text-center"><div className="w-3.5 h-3.5 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="py-3.5 px-4"><div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-1" /><div className="w-24 h-3 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="py-3.5 px-4 text-center"><div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                    <td className="py-3.5 px-4 text-center"><div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="py-3.5 px-4 text-center"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-14 h-7 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {search ? `No retailers match "${search}"` : 'No Retailers Found'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Try adjusting your search criteria or resetting filters.
                      </p>
                      <Button onClick={resetAllFilters} variant="outline" className="h-8 px-3 text-xs font-semibold rounded-lg mt-1">
                        Reset Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((retailer) => {
                  const isSelected = selectedIds.includes(retailer._id);
                  const isLowWallet = retailer.accountType !== 'PERSONAL' && (retailer.walletBalancePaise || 0) < 50000;

                  return (
                    <tr 
                      key={retailer._id} 
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-xs ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(retailer._id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Retailer Identity Column */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {retailer.name ? retailer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'RT'}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Link href={`/dashboard/retailers/${retailer._id}`} className="font-semibold text-sm text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                                {retailer.name}
                              </Link>
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                {retailer.retailerId}
                                <button onClick={() => handleCopyId(retailer.retailerId)} title="Copy ID">
                                  {copiedId === retailer.retailerId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />}
                                </button>
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              {retailer.phone} • {retailer.shopName || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Account Type */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        {retailer.accountType === 'BUSINESS' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Business
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-blue-500" /> Personal
                          </span>
                        )}
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-3.5 px-4 text-right align-middle font-mono">
                        {retailer.accountType === 'PERSONAL' ? (
                          <span className="text-slate-400 font-normal">—</span>
                        ) : (
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-white">
                              ₹{(retailer.walletBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[11px] font-normal">
                              {isLowWallet ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1 justify-end">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Low Wallet
                                </span>
                              ) : (
                                <span className="text-slate-400">Available</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Today's Recharge */}
                      <td className="py-3.5 px-4 text-right align-middle font-mono">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          ₹{retailer.todaysRechargePaise ? (retailer.todaysRechargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">Today</div>
                      </td>

                      {/* Monthly Recharge */}
                      <td className="py-3.5 px-4 text-right align-middle font-mono">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          ₹{retailer.monthlyRechargePaise ? (retailer.monthlyRechargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">This month</div>
                      </td>

                      {/* Device Online Status */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        {retailer.fcmToken ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-normal text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Offline
                          </span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        <div className="flex flex-col items-center">
                          {isAccountLocked(retailer) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                              <Lock className="w-3 h-3 text-rose-500" /> Locked
                            </span>
                          ) : retailer.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          ) : retailer.status === 'blocked' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Suspended
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                            {retailer.lastLogin ? formatDistanceToNow(new Date(retailer.lastLogin), { addSuffix: true }) : 'Never logged in'}
                          </span>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right align-middle relative">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/retailers/${retailer._id}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs font-semibold border-slate-300 rounded-md">
                              View
                            </Button>
                          </Link>
                          
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenu(activeActionMenu === retailer._id ? null : retailer._id);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeActionMenu === retailer._id && (
                              <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-1 z-50 text-left">
                                {isAccountLocked(retailer) && (
                                  <button
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      setUnlockModalTarget({ id: retailer._id, name: retailer.name });
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md"
                                  >
                                    <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Unlock Account</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    if (retailer.status === 'blocked') {
                                      showToast("Wallet adjustment disabled for blocked retailers", true);
                                      return;
                                    }
                                    setAdjustmentTarget({ id: retailer._id, name: retailer.name, type: "credit" });
                                  }}
                                  disabled={retailer.status === 'blocked'}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md ${
                                    retailer.status === 'blocked' ? 'text-slate-400 opacity-50 cursor-not-allowed' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Adjust Wallet</span>
                                </button>
                                
                                <Link 
                                  href={`/dashboard/transactions?retailer=${retailer.retailerId}`}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                >
                                  <History className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Transactions</span>
                                </Link>

                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    showToast("MPIN reset link sent to retailer.");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Reset MPIN</span>
                                </button>

                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                {retailer.status === "active" ? (
                                  <button
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      if (confirm("Suspend this retailer?")) {
                                        updateStatus({ id: retailer._id, status: "suspended", reason: "Admin Action" });
                                        showToast("Retailer suspended");
                                      }
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Suspend Account</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      if (confirm("Re-activate this retailer?")) {
                                        updateStatus({ id: retailer._id, status: "active", reason: "Admin Action" });
                                        showToast("Retailer re-activated");
                                      }
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Activate Account</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List (Small Screens) */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" /> Loading retailers...</div>
        ) : filteredList.length === 0 ? (
          <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">No Retailers Found</p>
            <p className="text-[11px] text-slate-400 mt-1">Try resetting your search or filters.</p>
          </div>
        ) : (
          filteredList.map(r => (
            <div key={r._id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                    {r.name ? r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'RT'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{r.name}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{r.retailerId} • {r.phone}</span>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  {r.accountType === 'BUSINESS' ? '● Business' : '● Personal'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Wallet</span>
                  <p className="font-semibold font-mono text-slate-900 dark:text-white">
                    {r.accountType === 'PERSONAL' ? '—' : `₹${(r.walletBalancePaise / 100).toFixed(2)}`}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Today</span>
                  <p className="font-semibold font-mono text-slate-900 dark:text-white">
                    ₹{r.todaysRechargePaise ? (r.todaysRechargePaise / 100).toFixed(0) : '0'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className={`text-[11px] font-semibold ${r.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ● {(r.status || 'active').toUpperCase()}
                </span>
                <Link href={`/dashboard/retailers/${r._id}`}>
                  <Button size="sm" className="h-7 px-3 text-xs font-semibold bg-blue-600 text-white rounded-md">View Details</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {data?.pagination && (
        <div className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-semibold text-slate-900 dark:text-white">{((page - 1) * pageSize) + 1}</span> to{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * pageSize, data.pagination.total)}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{data.pagination.total}</span> retailers
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 border-slate-300 text-xs font-semibold rounded-md"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
              disabled={page === data.pagination.pages}
              className="h-8 px-3 border-slate-300 text-xs font-semibold rounded-md"
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full rounded-xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Add New Retailer</h3>
                <p className="text-xs text-slate-500">Create a new retailer agent account in your network.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRetailer} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Account Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRetailer(prev => ({ ...prev, accountType: "PERSONAL" }))}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      newRetailer.accountType === "PERSONAL"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRetailer(prev => ({ ...prev, accountType: "BUSINESS" }))}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      newRetailer.accountType === "BUSINESS"
                        ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    Business
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={newRetailer.name}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={newRetailer.phone}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={newRetailer.email}
                  onChange={(e) => setNewRetailer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Shop / Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sharma Mobile Store"
                  value={newRetailer.shopName}
                  onChange={(e) => setNewRetailer(prev => ({ ...prev, shopName: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={newRetailer.city}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={newRetailer.state}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" onClick={() => setIsAddModalOpen(false)} variant="outline" className="h-8 px-3 text-xs font-semibold rounded-md">
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !newRetailer.name || !newRetailer.phone} className="h-8 px-4 bg-blue-600 text-white font-semibold text-xs rounded-md">
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Retailer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet Adjustment Modal */}
      {adjustmentTarget && (
        <ManualAdjustmentModal
          isOpen={!!adjustmentTarget}
          onClose={() => setAdjustmentTarget(null)}
          userId={adjustmentTarget.id}
          retailerName={adjustmentTarget.name}
          defaultType={adjustmentTarget.type}
        />
      )}

      {/* Unlock Retailer Account Confirmation Modal */}
      {unlockModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-sm w-full rounded-xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Unlock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unlock Account</h3>
                <p className="text-xs text-slate-500">{unlockModalTarget.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to unlock this retailer account? They will immediately be able to log in again.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnlockModalTarget(null)}
                disabled={isUnlocking}
                className="h-8 px-3 text-xs font-semibold rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!unlockModalTarget) return;
                  unlockAccount(unlockModalTarget.id, {
                    onSuccess: () => {
                      showToast("Retailer account unlocked successfully.");
                      setUnlockModalTarget(null);
                      refetch();
                    },
                    onError: (err: any) => {
                      showToast(err?.response?.data?.message || err.message || "Failed to unlock account", true);
                    }
                  });
                }}
                disabled={isUnlocking}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-sm"
              >
                {isUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Unlock className="w-3.5 h-3.5 mr-1" />}
                Unlock Account
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
