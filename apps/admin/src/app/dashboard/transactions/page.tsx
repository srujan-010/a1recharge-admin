"use client";

import { useState, useEffect, Suspense } from "react";
import { useGlobalTransactions } from "@/hooks/useTransactions";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Loader2, ReceiptText, Smartphone, MonitorPlay, Zap, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function TransactionsContent() {
  const searchParams = useSearchParams();
  const retailerParam = searchParams.get("retailer") || "";
  const serviceParam = searchParams.get("service") || "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [showTest, setShowTest] = useState(false);

  const { data, isLoading } = useGlobalTransactions(page, 20, search, status, retailerParam, serviceParam, showTest);

  // If URL param changes, reset page
  useEffect(() => {
    setPage(1);
  }, [retailerParam, serviceParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'mobile_recharge': return <Smartphone className="w-4 h-4 text-primary" />;
      case 'dth': return <MonitorPlay className="w-4 h-4 text-primary" />;
      case 'bbps': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'wallet_topup': return <Wallet className="w-4 h-4 text-emerald-500" />;
      default: return <ReceiptText className="w-4 h-4 text-slate-400" />;
    }
  };

  const columns = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
          <span className="text-xs text-muted-foreground">
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
        if (!user) return <span className="text-muted-foreground">-</span>;
        return (
          <Link href={`/dashboard/retailers/${user._id}`} className="flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800 p-1 -m-1 rounded transition-colors group">
            <span className="font-semibold text-primary group-hover:underline">{user.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{user.retailerId}</span>
          </Link>
        );
      },
    },
    {
      accessorKey: "service",
      header: "Service",
      cell: (info: any) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
            {getServiceIcon(info.getValue())}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium capitalize">
              {info.getValue().replace('_', ' ')}
            </span>
            {info.row.original.operatorName && (
              <span className="text-xs text-muted-foreground">{info.row.original.operatorName}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "mobileNumber",
      header: "Target / Ref",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm font-medium">
            {info.getValue() || info.row.original.recipientName || "-"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground mt-0.5" title="Transaction ID">
            Txn: {info.row.original.referenceId}
          </span>
          {info.row.original.apiReference && (
            <span className="text-[10px] font-mono text-primary/70 mt-0.5" title="API Reference">
              API: {info.row.original.apiReference}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "amountPaise",
      header: "Amount",
      cell: (info: any) => {
        const type = info.row.original.type;
        const isCredit = type === 'credit';
        return (
          <div className="flex flex-col text-right">
            <span className={`font-bold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
              {isCredit ? '+' : ''}₹{(info.getValue() / 100).toFixed(2)}
            </span>
            {info.row.original.commissionEarnedPaise > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Comm: +₹{(info.row.original.commissionEarnedPaise / 100).toFixed(2)}
              </span>
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
        else if (val === "pending") variant = "info";
        else if (val === "failed") variant = "error";
        else if (val === "reversed") variant = "warning";
        else if (val === "refunded") variant = "secondary";
        else if (val === "timeout" || val === "cancelled") variant = "outline";
        
        return (
          <Badge variant={variant} className="uppercase tracking-wider">
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
    if (retailerParam) return `Filtering transactions for retailer ID: ${retailerParam}`;
    if (serviceParam === 'bbps') return 'Monitor all utility and bill payment transactions across the platform.';
    if (serviceParam === 'recharge') return 'Monitor mobile and DTH recharge transactions across the platform.';
    return 'Comprehensive log of all recharges, bill payments, and money transfers.';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Mobile No, Reference ID, or API Ref..."
            className="pl-9 w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="reversed">Reversed</option>
          <option value="timeout">Timeout</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        <div className="flex items-center gap-2 px-2 sm:border-l border-slate-200 dark:border-slate-800 sm:pl-4 sm:ml-2">
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
          <label htmlFor="show-test-global" className="text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap select-none">
            Show Tests
          </label>
        </div>
      </div>

      {/* Data Table */}
      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <Table>
          <TableHeader>
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
                    <p>Loading transactions...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={ReceiptText} 
                    title="No transactions found" 
                    description="Try adjusting your search criteria or checking back later." 
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
              of <span className="font-medium text-slate-900 dark:text-white">{data.pagination.total}</span> entries
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
