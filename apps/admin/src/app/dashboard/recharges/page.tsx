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
import { Search, Loader2, Smartphone, MoreVertical, CheckCircle, RefreshCcw, HandCoins, AlertTriangle, MessageSquare, Download, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilterValue>("all");
  
  const { data, isLoading, refetch } = useRecharges(page, 20, search, status, operator, '', '', accountTypeFilter);
  
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
      await api.post(`/admin/recharges/${orderId}/action`, { action, remarks });
      refetch();
      toast.success(`Transaction updated successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const ActionMenu = ({ row }: { row: any }) => {
    const [open, setOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: string, action: string } | null>(null);
    const [remarks, setRemarks] = useState('');
    const txn = row.original;

    if (txn.status !== 'PENDING') return null;

    const handleConfirmModal = async () => {
      if (!modalConfig) return;
      if (modalConfig.type === 'REASON' && !remarks.trim()) {
        toast.error("Reason is mandatory.");
        return;
      }
      setOpen(false); // Close dropdown
      await performAction(txn.orderId, modalConfig.action, remarks);
      setModalConfig(null);
      setRemarks('');
    };

    return (
      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <MoreVertical className="w-4 h-4 text-slate-500" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-10 py-1" onClick={(e) => e.stopPropagation()}>
            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" onClick={() => { setOpen(false); performAction(txn.orderId, 'CHECK_STATUS'); }}>
              <RefreshCcw className="w-4 h-4" /> Check Live Status
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" onClick={() => { setOpen(false); performAction(txn.orderId, 'RETRY'); }}>
              <Activity className="w-4 h-4" /> Retry Recharge
            </button>
            {['SUPER_ADMIN', 'FINANCE'].includes(user?.role || '') && (
              <button className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2" onClick={() => { setModalConfig({ type: 'CONFIRM', action: 'REFUND' }); }}>
                <HandCoins className="w-4 h-4" /> Refund Wallet
              </button>
            )}
            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2" onClick={() => { setModalConfig({ type: 'REASON', action: 'ADD_NOTE' }); }}>
              <MessageSquare className="w-4 h-4" /> Add Internal Note
            </button>
            {user?.role === 'SUPER_ADMIN' && (
              <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                <button className="w-full text-left px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center gap-2" onClick={() => { setModalConfig({ type: 'REASON', action: 'MANUAL_SUCCESS' }); }}>
                  <CheckCircle className="w-4 h-4" /> Force Success
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2" onClick={() => { setModalConfig({ type: 'REASON', action: 'MANUAL_FAILURE' }); }}>
                  <AlertTriangle className="w-4 h-4" /> Force Failure
                </button>
              </div>
            )}
          </div>
        )}

        <Dialog open={!!modalConfig} onOpenChange={(val) => { if(!val) { setModalConfig(null); setRemarks(''); } }}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>
                {modalConfig?.type === 'CONFIRM' ? 'Confirm Action' : 'Force Manual Override'}
              </DialogTitle>
              <DialogDescription>
                {modalConfig?.action === 'REFUND' 
                  ? 'Are you sure you want to completely refund this transaction? This will debit the company wallet and credit the retailer.'
                  : 'Please provide a reason for this action. This will be recorded in the audit logs.'}
              </DialogDescription>
            </DialogHeader>
            {modalConfig?.type === 'REASON' && (
              <div className="py-4">
                <label className="text-sm font-medium mb-1 block">Reason *</label>
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Enter detailed reason..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setModalConfig(null); setRemarks(''); }} disabled={!!actionLoading}>
                Cancel
              </Button>
              <Button onClick={handleConfirmModal} disabled={!!actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm
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
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800">
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
      accessorKey: "status",
      header: "Status",
      cell: (info: any) => {
        const val = info.getValue();
        const txn = info.row.original;
        
        let badgeColor = "bg-slate-100 text-slate-600";
        if (val === 'SUCCESS') badgeColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
        if (val === 'FAILED') badgeColor = "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800";
        if (val === 'PENDING') badgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
        if (val === 'REFUNDED') badgeColor = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800";

        // Pending Timer
        let pendingTimer = null;
        if (val === 'PENDING') {
          const diffMins = Math.floor((new Date().getTime() - new Date(txn.createdAt).getTime()) / 60000);
          let timerColor = "text-emerald-600";
          if (diffMins > 10) timerColor = "text-amber-600";
          if (diffMins > 30) timerColor = "text-rose-600 font-bold";
          pendingTimer = <span className={`text-[10px] mt-1 ${timerColor}`}>{diffMins} min ago</span>;
        }

        return (
          <div className="flex flex-col items-start">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
              {val}
            </span>
            {pendingTimer}
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
        description="Comprehensive control over all mobile and DTH recharges. Track, refund, or retry pending operations."
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
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium w-full md:w-40"
          >
            <option value="all">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
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
                  // Basic Fraud Detection Highlight: Same retailer multiple failed or High Value
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
