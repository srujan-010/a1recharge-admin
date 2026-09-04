"use client";

import { useState, useEffect, Suspense } from "react";
import { useGlobalTransactions, TransactionEntry } from "@/hooks/useTransactions";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Search,
  Loader2,
  ReceiptText,
  Smartphone,
  MonitorPlay,
  Zap,
  Wallet,
  QrCode,
  CreditCard,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  History,
  Coins,
  Unlock,
  Lock,
  UserCheck,
  Cpu,
  X
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AccountTypeBadge } from "@/components/ui/account-type-badge";
import { AccountTypeFilter, AccountTypeFilterValue } from "@/components/ui/account-type-filter";

function TransactionsContent() {
  const searchParams = useSearchParams();
  const retailerParam = searchParams.get("retailer") || "";
  const serviceParam = searchParams.get("service") || "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [showTest, setShowTest] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilterValue>("all");

  const { data, isLoading } = useGlobalTransactions(
    page,
    20,
    search,
    status,
    retailerParam,
    serviceParam,
    transactionTypeFilter,
    showTest,
    accountTypeFilter,
    paymentMethodFilter
  );

  // If URL param changes, reset page
  useEffect(() => {
    setPage(1);
  }, [retailerParam, serviceParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatus("all");
    setTransactionTypeFilter("all");
    setPaymentMethodFilter("all");
    setAccountTypeFilter("all");
    setShowTest(false);
    setPage(1);
  };

  const hasActiveFilters = search || status !== "all" || transactionTypeFilter !== "all" || paymentMethodFilter !== "all" || accountTypeFilter !== "all" || showTest;

  const renderTransactionTypeBadge = (type: string, direction: string) => {
    const norm = (type || '').toUpperCase();

    if (norm === 'ADMIN_CREDIT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ADMIN CREDIT
        </span>
      );
    }
    if (norm === 'ADMIN_DEBIT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          ADMIN DEBIT
        </span>
      );
    }
    if (norm === 'WALLET_TOPUP_UPI' || norm === 'WALLET_TOPUP_RAZORPAY' || norm === 'WALLET_TOPUP') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          <QrCode className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          WALLET TOP-UP
        </span>
      );
    }
    if (norm === 'MOBILE_RECHARGE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          MOBILE RECHARGE
        </span>
      );
    }
    if (norm === 'DTH_RECHARGE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <MonitorPlay className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          DTH RECHARGE
        </span>
      );
    }
    if (norm === 'COMMISSION_CREDIT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          COMMISSION
        </span>
      );
    }
    if (norm === 'REFUND') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          <RotateCcw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          REFUND
        </span>
      );
    }
    if (norm === 'REVERSAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
          <History className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          REVERSAL
        </span>
      );
    }
    if (norm === 'WALLET_HOLD_RELEASE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-lime-50 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300 border border-lime-200 dark:border-lime-800">
          <Unlock className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
          HOLD RELEASE
        </span>
      );
    }
    if (norm === 'WALLET_HOLD') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          WALLET HOLD
        </span>
      );
    }
    if (norm === 'BILL_PAYMENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          BILL PAYMENT
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <ReceiptText className="w-3.5 h-3.5 text-slate-500" />
        {norm || (direction === 'credit' ? 'CREDIT' : 'DEBIT')}
      </span>
    );
  };

  const columns = [
    {
      accessorKey: "createdAt",
      header: "Date & Time",
      cell: (info: any) => (
        <div className="flex flex-col whitespace-nowrap">
          <span className="font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
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
          <Link
            href={`/dashboard/retailers/${user._id}`}
            className="flex flex-col items-start gap-0.5 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 p-1.5 -m-1.5 rounded-lg transition-colors group"
          >
            <span className="font-semibold text-primary group-hover:underline text-sm leading-snug">
              {user.name}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono font-medium">
                {user.retailerId || "N/A"}
              </span>
              <AccountTypeBadge type={accType} size="sm" />
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "transactionType",
      header: "Transaction Type",
      cell: (info: any) => {
        const type = info.getValue();
        const direction = info.row.original.type;
        return renderTransactionTypeBadge(type, direction);
      },
    },
    {
      accessorKey: "serviceTitle",
      header: "Service / Description",
      cell: (info: any) => {
        const row = info.row.original;
        const title = info.getValue() || row.service || "Financial Transaction";
        const reason = row.reason;
        const isAdminTx = row.transactionType === 'ADMIN_CREDIT' || row.transactionType === 'ADMIN_DEBIT' || row.source === 'ADMIN';

        return (
          <div className="flex flex-col max-w-xs">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {title}
            </span>
            {row.operatorName && (
              <span className="text-xs text-muted-foreground">{row.operatorName}</span>
            )}
            {isAdminTx && reason && (
              <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40 mt-1 inline-block" title={`Reason: ${reason}`}>
                <span className="font-semibold">Reason:</span> {reason}
              </span>
            )}
            {!isAdminTx && row.description && row.description !== title && (
              <span className="text-[11px] text-muted-foreground truncate" title={row.description}>
                {row.description}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "targetIdentifier",
      header: "Target / Reference",
      cell: (info: any) => {
        const row = info.row.original;
        const target = info.getValue() || row.mobileNumber;
        const refId = row.referenceId;
        const apiRef = row.apiReference;
        const upiGatewayPaymentId = row.upiDetails?.gatewayPaymentId;

        return (
          <div className="flex flex-col max-w-[200px]">
            {target ? (
              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                {target}
              </span>
            ) : upiGatewayPaymentId ? (
              <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate" title={`Razorpay Payment ID: ${upiGatewayPaymentId}`}>
                Pay: {upiGatewayPaymentId}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
            {refId && (
              <span className="text-[11px] font-mono text-muted-foreground truncate mt-0.5" title={`Reference ID: ${refId}`}>
                Ref: {refId}
              </span>
            )}
            {apiRef && (
              <span className="text-[10px] font-mono text-primary/70 truncate mt-0.5" title={`API Reference: ${apiRef}`}>
                API: {apiRef}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "amountPaise",
      header: "Amount",
      cell: (info: any) => {
        const row = info.row.original;
        const isCredit = row.type === 'credit';
        const isRecharge = row.transactionType === 'MOBILE_RECHARGE' || row.transactionType === 'DTH_RECHARGE';
        const amountRupees = (info.getValue() / 100).toFixed(2);

        // Directional Amount Color
        let colorClass = "text-slate-900 dark:text-white";
        let prefix = "";

        if (isCredit) {
          colorClass = "text-emerald-600 dark:text-emerald-400 font-extrabold";
          prefix = "+";
        } else if (row.transactionType === 'ADMIN_DEBIT') {
          colorClass = "text-rose-600 dark:text-rose-400 font-extrabold";
          prefix = "-";
        } else if (isRecharge) {
          colorClass = "text-slate-900 dark:text-slate-100 font-bold";
          prefix = "";
        } else {
          colorClass = "text-rose-600 dark:text-rose-400 font-bold";
          prefix = "-";
        }

        return (
          <div className="flex flex-col text-right">
            <span className={`text-sm sm:text-base font-mono ${colorClass}`}>
              {prefix}₹{amountRupees}
            </span>
            {row.commissionEarnedPaise > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Comm: +₹{(row.commissionEarnedPaise / 100).toFixed(2)}
              </span>
            )}
            {row.closingBalancePaise !== null && row.closingBalancePaise !== undefined && (
              <span className="text-[10px] text-muted-foreground font-mono" title="Balance After Transaction">
                Bal: ₹{(row.closingBalancePaise / 100).toFixed(2)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: (info: any) => {
        const method = String(info.getValue() || 'WALLET').toUpperCase();
        let label = "Wallet";
        let badgeStyle = "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800";
        let Icon = Wallet;

        if (method === 'UPI' || method === 'RAZORPAY_UPI') {
          label = "UPI";
          badgeStyle = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
          Icon = QrCode;
        } else if (method === 'RAZORPAY') {
          label = "Razorpay";
          badgeStyle = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800";
          Icon = CreditCard;
        } else if (method === 'ADMIN' || method === 'ADMIN_CREDIT' || method === 'ADMIN_DEBIT') {
          label = "Admin";
          badgeStyle = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
          Icon = ShieldCheck;
        } else if (method === 'SYSTEM') {
          label = "System";
          badgeStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
          Icon = Cpu;
        } else if (method === 'BANK_TRANSFER') {
          label = "Bank Transfer";
          badgeStyle = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800";
          Icon = Building2;
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
      accessorKey: "source",
      header: "Source / Admin",
      cell: (info: any) => {
        const row = info.row.original;
        const source = String(info.getValue() || 'SYSTEM').toUpperCase();
        const performedBy = row.performedBy || row.adminName;
        const isAdmin = source === 'ADMIN';

        return (
          <div className="flex flex-col">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isAdmin ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {source}
            </span>
            {isAdmin && performedBy && (
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 mt-0.5" title={`Authenticated Admin: ${performedBy}`}>
                <UserCheck className="w-3 h-3 text-amber-500 shrink-0" />
                {performedBy}
              </span>
            )}
            {!isAdmin && performedBy && performedBy !== 'System' && (
              <span className="text-[11px] text-muted-foreground">{performedBy}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (info: any) => {
        const val = info.getValue() ? String(info.getValue()).toLowerCase() : '';
        let variant: any = "neutral";
        if (val === "success") variant = "success";
        else if (val === "pending" || val === "processing" || val === "initiated") variant = "info";
        else if (val === "failed") variant = "error";
        else if (val === "reversed") variant = "warning";
        else if (val === "refunded") variant = "secondary";
        else if (val === "timeout" || val === "cancelled") variant = "outline";
        else if (val === "held") variant = "warning";
        else if (val === "released") variant = "success";
        
        return (
          <Badge variant={variant} className="uppercase tracking-wider font-semibold text-[10px]">
            {val}
          </Badge>
        );
      },
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const getPageTitle = () => {
    if (serviceParam === 'bbps') return 'Bill Payments';
    if (serviceParam === 'recharge') return 'Recharge Transactions';
    return 'Global Transactions';
  };

  const getPageDescription = () => {
    if (retailerParam) return `Authoritative financial ledger filtering for retailer: ${retailerParam}`;
    if (serviceParam === 'bbps') return 'Monitor all utility and bill payment transactions across the platform.';
    if (serviceParam === 'recharge') return 'Monitor mobile and DTH recharge transactions across the platform.';
    return 'Authoritative financial log of all wallet top-ups, admin credits, admin debits, recharges, refunds, and commissions.';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title={getPageTitle()}
        description={getPageDescription()}
        actions={
          retailerParam ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard/transactions">Clear Retailer Filter</Link>
            </Button>
          ) : null
        }
      />

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Retailer, Phone, Reference ID, Razorpay ID, Admin, or Reason..."
              className="pl-9 w-full"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>

          {/* Account Type Filter */}
          <AccountTypeFilter
            value={accountTypeFilter}
            onChange={(val) => { setAccountTypeFilter(val); setPage(1); }}
            showAll={true}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {/* Transaction Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Transaction Type</label>
            <select
              value={transactionTypeFilter}
              onChange={(e) => {
                setTransactionTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
            >
              <option value="all">All Transaction Types</option>
              <option value="recharge">Recharge (Mobile & DTH)</option>
              <option value="wallet_topup">Wallet Top-up (UPI / Razorpay)</option>
              <option value="admin_credit">Admin Credit (+)</option>
              <option value="admin_debit">Admin Debit (-)</option>
              <option value="commission">Commission Credit</option>
              <option value="refund">Refund</option>
              <option value="reversal">Reversal</option>
              <option value="hold_release">Hold / Hold Release</option>
              <option value="other">Other Transactions</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Payment Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
            >
              <option value="all">All Payment Methods</option>
              <option value="wallet">Wallet</option>
              <option value="upi">UPI</option>
              <option value="razorpay">Razorpay</option>
              <option value="admin">Admin</option>
              <option value="system">System</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[130px]"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="reversed">Reversed</option>
              <option value="held">Held</option>
              <option value="released">Released</option>
            </select>
          </div>

          {/* Show Test & Clear Filters */}
          <div className="flex items-center gap-3 ml-auto pt-4 sm:pt-0">
            <div className="flex items-center gap-2 px-2 border-slate-200 dark:border-slate-800">
              <input 
                type="checkbox" 
                id="show-test-global" 
                checked={showTest} 
                onChange={(e) => {
                  setShowTest(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" 
              />
              <label htmlFor="show-test-global" className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap select-none">
                Show Tests
              </label>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.id === 'amountPaise' ? 'text-right' : ''}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                    <p className="font-medium text-sm">Loading authoritative transactions...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={ReceiptText} 
                    title="No transactions found" 
                    description="No financial transactions match your active filters. Try resetting the filters or searching with different terms." 
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.id === 'amountPaise' ? 'text-right' : ''}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-slate-900 dark:text-white">{((page - 1) * 20) + 1}</span> to{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {Math.min(page * 20, data.pagination.total)}
              </span>{" "}
              of <span className="font-medium text-slate-900 dark:text-white">{data.pagination.total}</span> transactions
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page === data.pagination.pages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-slate-400 font-medium">
        Loading Global Transactions...
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
