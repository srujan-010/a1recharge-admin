"use client";

import { useState } from "react";
import { useRetailersList, useUpdateRetailerStatus, useUnlockRetailerAccount, useCreateRetailer, Retailer } from "@/hooks/useRetailers";
import { 
  Search, Loader2, Eye, Ban, CheckCircle, ChevronLeft, ChevronRight, 
  Users, Plus, Download, MoreVertical, Copy, Check, X, CreditCard, 
  Phone, Edit, FileText, ArrowLeftRight, ShieldCheck, Bell, ChevronDown,
  Wallet, History, Building2, MapPin, Activity, Smartphone, Lock, Unlock
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ManualAdjustmentModal } from "@/components/retailer/ManualAdjustmentModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RetailersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  
  // Quick Filters
  const [quickFilter, setQuickFilter] = useState("All");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<Retailer | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<{ id: string; name: string; type: "credit" | "debit" } | null>(null);
  const [unlockModalTarget, setUnlockModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New Retailer Form State
  const [newRetailer, setNewRetailer] = useState({
    name: "",
    phone: "",
    email: "",
    shopName: "",
    city: "",
    state: "",
  });

  // Hooks
  const { data, isLoading, refetch } = useRetailersList(page, pageSize, search, statusFilter);
  const { mutate: updateStatus } = useUpdateRetailerStatus();
  const { mutate: unlockAccount, isPending: isUnlocking } = useUnlockRetailerAccount();
  const { mutate: createRetailer, isPending: isCreating } = useCreateRetailer();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleCopyId = (retailerId: string) => {
    navigator.clipboard.writeText(retailerId);
    setCopiedId(retailerId);
    showToast(`Retailer ID ${retailerId} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateRetailer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRetailer.name || !newRetailer.phone) return;

    createRetailer(newRetailer, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setNewRetailer({ name: "", phone: "", email: "", shopName: "", city: "", state: "" });
        showToast("New retailer account created successfully!");
        refetch();
      },
      onError: (err: any) => {
        alert(err?.response?.data?.message || err.message || "Failed to create retailer");
      }
    });
  };

  // Selection handlers
  const list: Retailer[] = data?.data || [];
  
  const isAccountLocked = (r: Retailer) => Boolean(r.isLocked || (r.lockUntil && new Date(r.lockUntil) > new Date()));

  let filteredList = list.filter(r => kycFilter === 'all' || r.kycStatus === kycFilter);
  
  if (quickFilter === 'Active') {
    filteredList = filteredList.filter(r => r.status === 'active' && !isAccountLocked(r));
  } else if (quickFilter === 'Locked') {
    filteredList = filteredList.filter(r => isAccountLocked(r));
  } else if (quickFilter === 'Pending KYC') {
    filteredList = filteredList.filter(r => r.kycStatus === 'pending');
  } else if (quickFilter === 'Blocked') {
    filteredList = filteredList.filter(r => r.status === 'blocked');
  } else if (quickFilter === 'Low Wallet') {
    filteredList = filteredList.filter(r => r.walletBalancePaise < 50000); // less than 500 INR
  }

  if (statusFilter === 'locked') {
    filteredList = filteredList.filter(r => isAccountLocked(r));
  } else if (statusFilter === 'unlocked') {
    filteredList = filteredList.filter(r => !isAccountLocked(r));
  }

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

  // Export File Generator
  const handleExport = (formatType: 'csv' | 'excel') => {
    setIsExportOpen(false);
    if (filteredList.length === 0) return;

    const headers = ["Retailer ID,Name,Phone,Email,Shop Name,City,State,Wallet Balance (INR),Status,KYC Status,Joined Date\n"];
    const rows = filteredList.map(r => 
      `"${r.retailerId}","${r.name}","${r.phone}","${r.email || ''}","${r.shopName || ''}","${r.city || ''}","${r.state || ''}","${(r.walletBalancePaise / 100).toFixed(2)}","${r.status}","${r.kycStatus}","${r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : ''}"\n`
    );

    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retailers_crm_export.${formatType === 'csv' ? 'csv' : 'xls'}`;
    a.click();
    showToast(`Exported ${filteredList.length} retailers to ${formatType.toUpperCase()}`);
  };
  
  // Calculate stats for Summary Bar (based on current page data as approximation, plus total from pagination)
  const totalRetailers = data?.pagination?.total || 0;
  const activeCount = list.filter(r => r.status === 'active').length;
  const pendingKycCount = list.filter(r => r.kycStatus === 'pending').length;
  const blockedCount = list.filter(r => r.status === 'blocked').length;
  const totalWalletBal = list.reduce((acc, r) => acc + r.walletBalancePaise, 0) / 100;

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      
      {/* Toast Popup Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Pure CRM Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Retailers
          </h1>
          <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400">
            Enterprise overview of agents, wallets, and KYC compliance.
          </p>
        </div>

        {/* Top Right Action Group */}
        <div className="flex items-center gap-3">
          
          {/* Bulk Actions Menu */}
          <div className="relative">
            <Button
              onClick={() => setIsBulkOpen(prev => !prev)}
              variant="outline"
              disabled={selectedIds.length === 0}
              className="h-[44px] px-4 font-semibold text-[15px] rounded-xl border-[#E5E7EB] disabled:opacity-50"
            >
              <span>Bulk Actions ({selectedIds.length})</span>
              <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
            </Button>

            {isBulkOpen && selectedIds.length > 0 && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 space-y-1 text-left">
                <button
                  onClick={() => {
                    setIsBulkOpen(false);
                    showToast(`Broadcast notification sent to ${selectedIds.length} retailers`);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  <Bell className="w-4 h-4 text-blue-500" />
                  <span>Send Notification</span>
                </button>
                <button
                  onClick={() => {
                    setIsBulkOpen(false);
                    if (confirm(`Suspend ${selectedIds.length} selected retailers?`)) {
                      selectedIds.forEach(id => updateStatus({ id, status: 'suspended', reason: 'Bulk Action' }));
                      showToast(`Suspended ${selectedIds.length} retailers`);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl"
                >
                  <Ban className="w-4 h-4" />
                  <span>Bulk Suspend</span>
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setIsExportOpen(prev => !prev)}
              variant="outline"
              className="h-[44px] px-4 font-semibold text-[15px] rounded-xl border-[#E5E7EB]"
            >
              <Download className="w-4 h-4 mr-2 text-slate-500" /> Export
              <ChevronDown className="w-4 h-4 ml-1 text-slate-400" />
            </Button>

            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 space-y-1 text-left">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Export as CSV</span>
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>Export as Excel</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-[44px] bg-[linear-gradient(to_right,#2563eb,#1d4ed8)] hover:brightness-110 text-white font-semibold text-[15px] rounded-xl shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4.5 h-4.5 mr-2" /> Add Retailer
          </Button>

        </div>
      </div>
      
      {/* Compact Summary Bar */}
      <div className="bg-slate-900 text-white dark:bg-slate-950 rounded-[16px] p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Retailers</p>
            <p className="text-xl font-bold text-white">{totalRetailers}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-slate-800 hidden sm:block" />
        
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active</p>
          <p className="text-xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        
        <div className="w-px h-10 bg-slate-800 hidden sm:block" />
        
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending KYC</p>
          <p className="text-xl font-bold text-amber-400">{pendingKycCount}</p>
        </div>

        <div className="w-px h-10 bg-slate-800 hidden sm:block" />
        
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Blocked</p>
          <p className="text-xl font-bold text-rose-400">{blockedCount}</p>
        </div>

        <div className="w-px h-10 bg-slate-800 hidden lg:block" />
        
        <div className="ml-auto bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Total Wallet Balance</p>
          <p className="text-lg font-bold font-mono text-emerald-400">₹{totalWalletBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
      
      {/* Quick Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['All', 'Active', 'Locked', 'Pending KYC', 'Blocked', 'Low Wallet'].map(filter => (
          <button
            key={filter}
            onClick={() => { setQuickFilter(filter); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              quickFilter === filter 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {filter === 'Locked' ? '🔒 Locked' : filter}
          </button>
        ))}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[18px] border border-[#E7ECF3] dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          <form onSubmit={handleSearchSubmit} className="flex-1 relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by retailer name, phone, email, shop name, or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 h-[48px] text-sm bg-slate-50 dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="locked">🔒 Locked</option>
              <option value="unlocked">Unlocked</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>

            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
            >
              <option value="all">KYC: All</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="none">None</option>
            </select>
          </div>

        </div>
      </div>

      {/* CRM Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-[#E7ECF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800/90 backdrop-blur-sm border-b border-[#E5E7EB] dark:border-slate-800 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && selectedIds.length === filteredList.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-4 px-4">Retailer</th>
                <th className="py-4 px-4 text-right">Wallet</th>
                <th className="py-4 px-4 text-right">Today's Recharge</th>
                <th className="py-4 px-4 text-right">Monthly Recharge</th>
                <th className="py-4 px-4 text-center">Device</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <p className="text-sm font-semibold text-slate-500">Loading retailer directory...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-64 text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-base font-bold text-slate-900 dark:text-white">No Retailers Found</p>
                      <p className="text-xs text-slate-400 max-w-sm">No agent accounts match your search or filter options.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((retailer) => {
                  const isSelected = selectedIds.includes(retailer._id);

                  return (
                    <tr 
                      key={retailer._id} 
                      className={`h-[90px] transition-all group ${
                        isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-4 px-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(retailer._id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shrink-0 mt-1">
                            {retailer.name ? retailer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'RT'}
                          </div>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-2">
                              <Link href={`/dashboard/retailers/${retailer._id}`} className="font-bold text-[15px] text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                                {retailer.name}
                              </Link>
                              <Badge 
                                variant={
                                  retailer.kycStatus === 'verified' ? 'success' : 
                                  retailer.kycStatus === 'pending' ? 'warning' : 
                                  retailer.kycStatus === 'rejected' ? 'error' : 'neutral'
                                }
                                className="capitalize px-1.5 py-0 text-[10px] h-4"
                              >
                                {retailer.kycStatus || 'No KYC'}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-slate-500 flex items-center gap-3">
                              <button
                                onClick={() => handleCopyId(retailer.retailerId)}
                                className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
                                title="Click to Copy ID"
                              >
                                <span>ID: {retailer.retailerId}</span>
                                {copiedId === retailer.retailerId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                              </button>
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {retailer.phone}</span>
                            </div>
                            
                            <div className="text-xs text-slate-500 flex items-center gap-3">
                              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" /> {retailer.shopName || '—'}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" /> {retailer.city ? `${retailer.city}${retailer.state ? `, ${retailer.state}` : ''}` : 'Not Available'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right align-middle">
                        <div className="inline-block bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl shadow-sm">
                          <span className="font-mono font-extrabold text-[15px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                            ₹{(retailer.walletBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right align-middle">
                        <span className="font-mono font-bold text-[14px] text-slate-700 dark:text-slate-300 tabular-nums">
                          ₹{retailer.todaysRechargePaise ? (retailer.todaysRechargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right align-middle">
                        <span className="font-mono font-bold text-[14px] text-slate-700 dark:text-slate-300 tabular-nums">
                          ₹{retailer.monthlyRechargePaise ? (retailer.monthlyRechargePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center align-middle">
                        <div className="flex flex-col items-center gap-1.5">
                          {retailer.fcmToken ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60" title="Device is Online/Registered">
                              <Smartphone className="w-3.5 h-3.5" />
                              Online
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60" title="Device Offline/Not Registered">
                              <Smartphone className="w-3.5 h-3.5" />
                              Offline
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 max-w-[80px] truncate" title={retailer.fcmToken || "No Token"}>
                            {retailer.fcmToken ? retailer.fcmToken.substring(0, 8) + '...' : 'No Token'}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 align-middle">
                        <div className="flex flex-col items-center gap-1.5">
                          {isAccountLocked(retailer) ? (
                            <div className="w-[100px] flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 py-1.5 px-3 rounded-lg font-bold text-[11px] shadow-sm uppercase tracking-wider">
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </div>
                          ) : (
                            <>
                              {retailer.status === 'active' && (
                                <div className="w-[100px] flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 py-1.5 px-3 rounded-lg font-bold text-[11px] shadow-sm uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                                </div>
                              )}
                              {retailer.status === 'blocked' && (
                                <div className="w-[100px] flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 py-1.5 px-3 rounded-lg font-bold text-[11px] shadow-sm uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Blocked
                                </div>
                              )}
                              {retailer.status === 'suspended' && (
                                <div className="w-[100px] flex items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 py-1.5 px-3 rounded-lg font-bold text-[11px] shadow-sm uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Suspended
                                </div>
                              )}
                              {(!['active', 'blocked', 'suspended'].includes(retailer.status)) && (
                                <div className="w-[100px] flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 py-1.5 px-3 rounded-lg font-bold text-[11px] shadow-sm uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive
                                </div>
                              )}
                            </>
                          )}
                          
                          <span className="text-[10px] font-medium text-slate-500 text-center">
                            {retailer.lastLogin ? `Last login: ${formatDistanceToNow(new Date(retailer.lastLogin), { addSuffix: true })}` : 'Never Logged In'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right align-middle relative">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/retailers/${retailer._id}`} className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="View Profile">
                            <Eye className="w-4.5 h-4.5" />
                          </Link>
                          
                          {retailer.status === 'blocked' ? (
                            <div className="relative group flex items-center justify-center">
                              <button disabled className="p-2 rounded-xl text-slate-300 dark:text-slate-700 cursor-not-allowed">
                                <Wallet className="w-4.5 h-4.5" />
                              </button>
                              <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 hidden group-hover:block w-max bg-slate-800 text-white text-[11px] font-medium py-1.5 px-2.5 rounded-lg shadow-xl z-50">
                                Wallet adjustment disabled for blocked retailers
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAdjustmentTarget({ id: retailer._id, name: retailer.name, type: "credit" })} className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Adjust Wallet">
                              <Wallet className="w-4.5 h-4.5" />
                            </button>
                          )}
                          
                          <Link href={`/dashboard/transactions?retailer=${retailer.retailerId}`} className="p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors" title="History">
                            <History className="w-4.5 h-4.5" />
                          </Link>
                          
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenu(activeActionMenu === retailer._id ? null : retailer._id);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                              More <ChevronDown className="w-3 h-3" />
                            </button>

                            {activeActionMenu === retailer._id && (
                              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-2 z-50 space-y-1 text-left animate-in fade-in zoom-in-95 duration-150">
                                {isAccountLocked(retailer) && (
                                  <button
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      setUnlockModalTarget({ id: retailer._id, name: retailer.name });
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                                  >
                                    <Unlock className="w-4 h-4 text-emerald-500" />
                                    <span>Unlock Account</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    setEditingRetailer(retailer);
                                    // TODO: Implement Edit Modal open
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                                >
                                  <Edit className="w-4 h-4 text-slate-500" />
                                  <span>Edit Retailer</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    if (retailer.status === 'blocked') {
                                      showToast("Wallet adjustment disabled for blocked retailers");
                                      return;
                                    }
                                    setAdjustmentTarget({ id: retailer._id, name: retailer.name, type: "credit" });
                                  }}
                                  disabled={retailer.status === 'blocked'}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl ${
                                    retailer.status === 'blocked' ? 'text-slate-400 opacity-50 cursor-not-allowed' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <Activity className="w-4 h-4 text-slate-500" />
                                  <span>Adjust Wallet</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    showToast("Password reset link sent.");
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                                >
                                  <ShieldCheck className="w-4 h-4 text-amber-500" />
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
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl"
                                  >
                                    <Ban className="w-4 h-4" />
                                    <span>Block / Suspend</span>
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
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Unblock / Activate</span>
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    if (confirm("Delete this retailer permanently?")) {
                                      showToast("Retailer deletion initiated");
                                    }
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl mt-1"
                                >
                                  <X className="w-4 h-4" />
                                  <span>Delete</span>
                                </button>
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

      {/* Pagination Footer */}
      {data?.pagination && (
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border border-[#E7ECF3] dark:border-slate-800 rounded-[18px] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-bold text-slate-900 dark:text-white">{((page - 1) * pageSize) + 1}</span> to{" "}
              <span className="font-bold text-slate-900 dark:text-white">{Math.min(page * pageSize, data.pagination.total)}</span> of{" "}
              <span className="font-bold text-slate-900 dark:text-white">{data.pagination.total}</span> retailers
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            >
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-3 border-[#E5E7EB]"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
              disabled={page === data.pagination.pages}
              className="h-9 px-3 border-[#E5E7EB]"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full rounded-[24px] shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add New Retailer</h3>
                <p className="text-xs text-slate-500 font-medium">Create a new agent account in your network.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRetailer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={newRetailer.name}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={newRetailer.phone}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={newRetailer.email}
                  onChange={(e) => setNewRetailer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Shop / Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sharma Mobile Store"
                  value={newRetailer.shopName}
                  onChange={(e) => setNewRetailer(prev => ({ ...prev, shopName: e.target.value }))}
                  className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={newRetailer.city}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">State</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={newRetailer.state}
                    onChange={(e) => setNewRetailer(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" onClick={() => setIsAddModalOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !newRetailer.name || !newRetailer.phone} className="bg-blue-600 text-white font-bold">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Retailer"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-[24px] shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Unlock Retailer Account</h3>
                <p className="text-xs text-slate-500 font-medium">{unlockModalTarget.name}</p>
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
                onClick={() => setUnlockModalTarget(null)}
                disabled={isUnlocking}
                className="h-10 px-4 font-semibold text-xs rounded-xl"
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
                      alert(err?.response?.data?.message || err.message || "Failed to unlock retailer account");
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
