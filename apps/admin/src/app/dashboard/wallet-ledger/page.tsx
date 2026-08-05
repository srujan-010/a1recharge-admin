"use client";

import { useState } from "react";
import { useWalletLedgerList } from "@/hooks/useWalletLedger";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Loader2, ArrowUpRight, ArrowDownLeft, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function WalletLedgerPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useWalletLedgerList(page, 50, search);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: (info: any) => (
        <span className="text-muted-foreground text-xs font-medium">
          {format(new Date(info.getValue()), "PPpp")}
        </span>
      ),
    },
    {
      accessorKey: "userId",
      header: "User",
      cell: (info: any) => {
        const user = info.getValue();
        if (!user) return <span className="text-muted-foreground font-medium italic">System</span>;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 dark:text-white">{user.name}</span>
            <Link href={`/dashboard/retailers/${user._id}`} className="text-xs text-primary hover:underline font-mono">
              {user.retailerId}
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "transactionType",
      header: "Type",
      cell: (info: any) => {
        const type = info.getValue();
        return (
          <Badge variant={type === 'CREDIT' ? 'success' : 'error'} className="gap-1">
            {type === 'CREDIT' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "amountPaise",
      header: "Amount",
      cell: (info: any) => {
        const type = info.row.original.transactionType;
        const amount = info.getValue() / 100;
        return (
          <span className={`font-mono font-bold block text-right ${type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
            {type === 'CREDIT' ? '+' : ''}₹{amount.toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: "balanceAfterPaise",
      header: "Closing Balance",
      cell: (info: any) => (
        <span className="font-mono font-medium text-slate-900 dark:text-white block text-right">
          ₹{(info.getValue() / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description / Ref",
      cell: (info: any) => (
        <div className="flex flex-col max-w-[300px]">
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate" title={info.getValue()}>{info.getValue()}</span>
          <span className="text-[10px] text-muted-foreground font-mono mt-0.5" title="Reference ID">Ref: {info.row.original.referenceId}</span>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Wallet Ledger"
        description="Global chronological record of all wallet movements."
      />

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Retailer name, phone, ID, or Reference ID..."
            className="pl-9 w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
      </div>

      {/* Data Table */}
      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id} 
                    className={
                      header.id === 'amountPaise' || header.id === 'balanceAfterPaise' 
                        ? 'text-right' 
                        : ''
                    }
                  >
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
                    <p>Loading ledger records...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={FileText} 
                    title="No ledger entries found" 
                    description="Try adjusting your search criteria." 
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className={
                        cell.column.id === 'amountPaise' || cell.column.id === 'balanceAfterPaise' 
                          ? 'text-right' 
                          : ''
                      }
                    >
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
              Showing <span className="font-medium text-slate-900 dark:text-white">{((page - 1) * 50) + 1}</span> to{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {Math.min(page * 50, data.pagination.total)}
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
