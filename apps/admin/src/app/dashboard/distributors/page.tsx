"use client";

import { useState } from "react";
import { useDistributorsList } from "@/hooks/useDistributors";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Loader2, User, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DistributorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useDistributorsList(page, 20, search, status);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      accessorKey: "retailerId",
      header: "ID",
      cell: (info: any) => <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>,
    },
    {
      accessorKey: "name",
      header: "Distributor",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">{info.getValue()}</span>
          <span className="text-xs text-muted-foreground font-mono mt-0.5">{info.row.original.phone}</span>
        </div>
      ),
    },
    {
      accessorKey: "shopName",
      header: "Shop Name",
      cell: (info: any) => (
        <span className="text-slate-900 dark:text-white font-medium">
          {info.getValue() || "-"}
        </span>
      ),
    },
    {
      accessorKey: "walletBalancePaise",
      header: "Wallet Balance",
      cell: (info: any) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono block text-right">
          ₹{(info.getValue() / 100).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (info: any) => {
        const val = info.getValue() || 'active';
        let variant: any = "neutral";
        if (val === "active") variant = "success";
        else if (val === "suspended") variant = "warning";
        else if (val === "blocked") variant = "error";
        
        return (
          <Badge variant={variant} className="capitalize">
            {val}
          </Badge>
        );
      },
    },
    {
      accessorKey: "kycStatus",
      header: "KYC",
      cell: (info: any) => {
        const val = info.getValue() || 'pending';
        return (
          <span className={`text-sm font-medium capitalize ${
            val === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 
            val === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
          }`}>
            {val}
          </span>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: (info: any) => {
        const distributor = info.row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" asChild title="View Profile">
              <Link href={`/dashboard/distributors/${distributor._id}`}>
                <Eye className="w-4 h-4 text-slate-500" />
              </Link>
            </Button>
          </div>
        );
      },
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
        title="Distributors"
        description="Manage your B2B distributor network and their downstream sub-merchants."
      />

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, phone, email, or ID..."
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
          className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="blocked">Blocked</option>
        </select>
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
                      header.id === 'walletBalancePaise' 
                        ? 'text-right' 
                        : header.id === 'actions' 
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
                    <p>Loading distributors...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={User} 
                    title="No distributors found" 
                    description="Try adjusting your search or filters." 
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
                        cell.column.id === 'walletBalancePaise' 
                          ? 'text-right' 
                          : cell.column.id === 'actions' 
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
              Showing <span className="font-medium text-slate-900 dark:text-white">{((page - 1) * 20) + 1}</span> to{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {Math.min(page * 20, data.pagination.total)}
              </span>{" "}
              of <span className="font-medium text-slate-900 dark:text-white">{data.pagination.total}</span> distributors
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
