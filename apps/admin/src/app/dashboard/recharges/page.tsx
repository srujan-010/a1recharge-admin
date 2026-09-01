"use client";

import { useState, useEffect } from "react";
import { useRecharges } from "@/hooks/useTransactions";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { 
  Search, Loader2, Smartphone, MoreVertical, CheckCircle, RefreshCcw, HandCoins, 
  AlertTriangle, MessageSquare, Download, Activity, Eye, ShieldAlert, Lock, Unlock,
  Wallet, QrCode, CreditCard, Building2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getPaymentMethod } from "@/lib/paymentUtils";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TransactionDetailsDrawer } from "./TransactionDetailsDrawer";
import { AccountTypeBadge } from "@/components/ui/account-type-badge";
import { AccountTypeFilter, AccountTypeFilterValue } from "@/components/ui/account-type-filter";

export default function RechargesOperationsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [operator, setOperator] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilterValue>("all");
  
  const { data, isLoading, refetch } = useRecharges(page, 20, search, status, operator, '', '', accountTypeFilter, paymentMethodFilter);
  
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      socket.on('transaction_updated', () => {
        refetch();
      });
      return () => {
        socket.off('transaction_updated');
      };
    }
  }, [socket, refetch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const performAction = async (orderId: string, action: string, remarks?: string) => {
    try {
      setActionLoading(orderId);
      const res = await api.post(`/admin/recharges/${orderId}/action`, { action, remarks });
      refetch();
      toast.success(res.data?.message || `Transaction updated successfully.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const ActionMenu = ({ row }: { row: any }) => {
    const [open, setOpen] = useState(false);
    const [modalAction, setModalAction] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');
    const txn = row.original;

    const isAuthorized = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user?.role || '');

    const handleConfirmModal = async () => {
      if (!modalAction) return;

      const requiresReason = ['MARK_SUCCESS', 'MANUAL_SUCCESS', 'MARK_FAILED', 'MANUAL_FAILURE', 'REFUND', 'RELEASE_HOLD', 'ADD_NOTE'].includes(modalAction);
      if (requiresReason && !remarks.trim()) {
        toast.error("Admin reason/remarks is mandatory.");
        return;
      }

      const targetAction = modalAction;
      setModalAction(null);
      setOpen(false);
      await performAction(txn.orderId, targetAction, remarks);
      setRemarks('');
    };

    const isPendingLike = ['PENDING', 'PROCESSING', 'PROVIDER_TIMEOUT', 'TIMEOUT'].includes(txn.status);
    const canCheckStatus = !!txn.providerTransactionId;
    const canMarkSuccess = isPendingLike || txn.status === 'FAILED';
    const canMarkFailed = isPendingLike;
    const canReleaseHold = txn.reservedAmount > 0 || isPendingLike;
    const canRefund = (txn.status === 'SUCCESS' || txn.reservedAmount > 0) && !txn.refundStatus && txn.status !== 'REFUNDED';
    const canRetry = isPendingLike || (txn.status === 'FAILED' && (txn.retryCount || 0) < 3);

    return (
      <div className="relative">
        <button 
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }} 
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          title="Actions Menu"
        >
          <MoreVertical className="w-4 h-4 text-slate-500" />
        </button>

        {open && (
          <div 
            className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 font-medium" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              onClick={() => { setOpen(false); setSelectedTxn(txn.orderId); }}
            >
              <Eye className="w-4 h-4 text-blue-500" /> View Details
            </button>

            {canCheckStatus && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                onClick={() => { setOpen(false); performAction(txn.orderId, 'CHECK_STATUS'); }}
              >
                <RefreshCcw className="w-4 h-4 text-indigo-500" /> Check Provider Status
              </button>
            )}

            {canRetry && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                onClick={() => { setOpen(false); performAction(txn.orderId, 'RETRY'); }}
              >
                <Activity className="w-4 h-4 text-amber-500" /> Retry Recharge
              </button>
            )}

            {isAuthorized && canMarkSuccess && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2"
                onClick={() => { setOpen(false); setModalAction('MARK_SUCCESS'); }}
              >
                <CheckCircle className="w-4 h-4" /> Mark as Success
              </button>
            )}

            {isAuthorized && canMarkFailed && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                onClick={() => { setOpen(false); setModalAction('MARK_FAILED'); }}
              >
                <AlertTriangle className="w-4 h-4" /> Mark as Failed
              </button>
            )}

            {isAuthorized && canReleaseHold && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2"
                onClick={() => { setOpen(false); setModalAction('RELEASE_HOLD'); }}
              >
                <Unlock className="w-4 h-4" /> Release Hold (₹{txn.amount})
              </button>
            )}

            {isAuthorized && canRefund && (
              <button 
                className="w-full text-left px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex items-center gap-2"
                onClick={() => { setOpen(false); setModalAction('REFUND'); }}
              >
                <HandCoins className="w-4 h-4" /> Refund Wallet (₹{txn.amount})
              </button>
            )}

            <button 
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 mt-1 pt-1"
              onClick={() => { setOpen(false); setModalAction('ADD_NOTE'); }}
            >
              <MessageSquare className="w-4 h-4 text-slate-400" /> Add Admin Note
            </button>
          </div>
        )}

        {/* Confirmation Modal */}
        <Dialog open={!!modalAction} onOpenChange={(val) => { if (!val) { setModalAction(null); setRemarks(''); } }}>
          <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {modalAction === 'REFUND' && <HandCoins className="w-5 h-5 text-purple-600" />}
                {modalAction === 'MARK_SUCCESS' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                {modalAction === 'MARK_FAILED' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
                {modalAction === 'RELEASE_HOLD' && <Unlock className="w-5 h-5 text-amber-600" />}
                {modalAction === 'ADD_NOTE' && <MessageSquare className="w-5 h-5 text-blue-600" />}
                {modalAction === 'MARK_SUCCESS' && 'Confirm Recharge Success'}
                {modalAction === 'MARK_FAILED' && 'Confirm Recharge Failure'}
                {modalAction === 'REFUND' && 'Refund Recharge to Retailer Wallet'}
                {modalAction === 'RELEASE_HOLD' && 'Release Held Amount'}
                {modalAction === 'ADD_NOTE' && 'Add Admin Note'}
              </DialogTitle>
              <div className="space-y-3 pt-2 text-sm text-slate-600 dark:text-slate-300">
                {/* Summary Box */}
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{txn.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retailer:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{txn.userId?.name || 'Retailer'} ({txn.userId?.retailerId})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recharge Amount:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₹{txn.amount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Status:</span>
                    <span className="font-bold uppercase text-slate-900 dark:text-white">{txn.status}</span>
                  </div>
                </div>

                {/* Warning Notice Box */}
                {txn.status === 'PROVIDER_TIMEOUT' && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span><strong>Provider status could not be confirmed.</strong> Please ensure you have checked the provider status before changing state.</span>
                  </div>
                )}

                {modalAction === 'REFUND' && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs space-y-1">
                    <p className="font-bold">This will return ₹{txn.amount?.toFixed(2)} to the retailer wallet.</p>
                    <p>A refund ledger entry and audit log will be created. This action cannot be reversed.</p>
                  </div>
                )}

                {modalAction === 'RELEASE_HOLD' && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    <p className="font-bold">Release ₹{txn.amount?.toFixed(2)} from hold to retailer wallet?</p>
                    <p>This will move the held amount back to retailer available balance.</p>
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Mandatory Reason Input */}
            <div className="py-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                Admin Reason / Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full min-h-[90px] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                placeholder={
                  modalAction === 'MARK_SUCCESS' ? "e.g., Provider confirmed success manually..." :
                  modalAction === 'MARK_FAILED' ? "e.g., Provider confirmed failed..." :
                  modalAction === 'REFUND' ? "e.g., Customer requested refund, provider failed..." :
                  modalAction === 'RELEASE_HOLD' ? "e.g., Releasing pending hold..." :
                  "Enter admin reason..."
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                autoFocus
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setModalAction(null); setRemarks(''); }} disabled={!!actionLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmModal} 
                disabled={!!actionLoading || !remarks.trim()}
                className={
                  modalAction === 'REFUND' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                  modalAction === 'MARK_FAILED' ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                  modalAction === 'RELEASE_HOLD' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                  'bg-emerald-600 hover:bg-emerald-700 text-white'
                }
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Action
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const columns = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-white">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(info.getValue()).toLocaleTimeString()}
          </span>
        </div>
      ),
    },
    {
      accessorFn: (row: any) => row.userId,
      id: "retailer",
      header: "Retailer",
      cell: (info: any) => {
        const user = info.getValue();
        const accType = info.row.original.accountType || user?.accountType;
        if (!user) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="font-semibold text-primary">{user.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono">ID: {user.retailerId}</span>
              <AccountTypeBadge type={accType} size="sm" />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "operatorCode",
      header: "Operator",
      cell: (info: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800 font-bold text-xs">
            {info.getValue().substring(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {info.getValue()}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{info.row.original.circleCode}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "mobileNumber",
      header: "Target / Order",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
            {info.getValue()}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground mt-0.5" title="Order ID">
            {info.row.original.orderId}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (info: any) => (
        <div className="flex flex-col text-right">
          <span className="font-bold text-slate-900 dark:text-white">
            ₹{info.getValue().toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: (info: any) => {
        const method = getPaymentMethod(info.row.original).toLowerCase();
        let label = "Wallet";
        let badgeStyle = "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800";
        let Icon = Wallet;

        if (method === 'upi') {
          label = "UPI";
          badgeStyle = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
          Icon = QrCode;
        } else if (method === 'other' || method === 'gateway') {
          label = "Gateway";
          badgeStyle = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800";
          Icon = CreditCard;
        } else if (method === 'bank_transfer') {
          label = "Bank Transfer";
          badgeStyle = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
          Icon = Building2;
        } else if (method === 'unknown') {
          label = "Unknown";
          badgeStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
          Icon = Wallet;
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${badgeStyle}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status & Wallet State",
      cell: (info: any) => {
        const val = info.getValue();
        const txn = info.row.original;
        
        let badgeColor = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
        if (val === 'SUCCESS') badgeColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
        if (val === 'FAILED') badgeColor = "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800";
        if (val === 'PENDING' || val === 'PROCESSING') badgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
        if (val === 'PROVIDER_TIMEOUT' || val === 'TIMEOUT') badgeColor = "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800";
        if (val === 'REFUNDED') badgeColor = "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800";

        // Wallet Hold State Indicator
        let walletState = null;
        if (txn.reservedAmount > 0) {
          walletState = <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 mt-1"><Lock className="w-2.5 h-2.5" /> ₹{txn.reservedAmount} HELD</span>;
        } else if (val === 'SUCCESS') {
          walletState = <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">DEBITED</span>;
        } else if (val === 'REFUNDED') {
          walletState = <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium">REFUNDED</span>;
        } else if (val === 'FAILED') {
          walletState = <span className="text-[10px] text-slate-400 mt-0.5 font-medium">RELEASED</span>;
        }

        return (
          <div className="flex flex-col items-start">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
              {val === 'PROVIDER_TIMEOUT' ? 'TIMEOUT' : val}
            </span>
            {walletState}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: (info: any) => {
        if (actionLoading === info.row.original.orderId) {
          return <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />;
        }
        return <ActionMenu row={info.row} />;
      },
    }
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <PageHeader 
        title="Recharge Operations Center"
        description="Comprehensive control over mobile and DTH recharges. Perform status checks, hold releases, or idempotent refunds safely."
        actions={
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {/* Advanced Filters Row */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search Order ID, Provider ID, Mobile No..."
            className="pl-9 w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <AccountTypeFilter
            value={accountTypeFilter}
            onChange={(val) => { setAccountTypeFilter(val); setPage(1); }}
            showAll={true}
          />
          <select
            value={paymentMethodFilter}
            onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium w-full md:w-40"
          >
            <option value="all">All Payment Types</option>
            <option value="wallet">Wallet</option>
            <option value="upi">UPI</option>
            <option value="gateway">Gateway</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium w-full md:w-40"
          >
            <option value="all">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="PROVIDER_TIMEOUT">Timeout</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select
            value={operator}
            onChange={(e) => { setOperator(e.target.value); setPage(1); }}
            className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium w-full md:w-40"
          >
            <option value="">All Operators</option>
            <option value="RC">Reliance Jio</option>
            <option value="A">Airtel</option>
            <option value="V">Vi</option>
            <option value="BT">BSNL Topup</option>
            <option value="BR">BSNL Recharge</option>
          </select>
        </div>
      </div>

      {/* Operations Table */}
      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/20">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className={`font-semibold ${header.id === 'amount' ? 'text-right' : ''}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-muted-foreground font-medium">Fetching active operations...</p>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-64 p-0">
                    <EmptyState 
                      icon={Smartphone} 
                      title="No Recharges Found" 
                      description="Adjust your filters or search criteria." 
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isSuspicious = row.original.amount > 2000;
                  return (
                    <TableRow 
                      key={row.id} 
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isSuspicious ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}
                      onClick={() => setSelectedTxn(row.original.orderId)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.id === 'amount' ? 'text-right' : ''}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <span className="text-sm font-medium text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailsDrawer 
        orderId={selectedTxn} 
        onClose={() => setSelectedTxn(null)} 
      />
    </div>
  );
}
