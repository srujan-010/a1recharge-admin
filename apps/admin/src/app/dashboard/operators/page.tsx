"use client";

import { useState } from "react";
import { useOperatorsList, useUpdateOperator, ProviderOperator } from "@/hooks/useOperators";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Loader2, RadioTower, Power, PowerOff, ChevronLeft, ChevronRight } from "lucide-react";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OperatorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [serviceType, setServiceType] = useState("all");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useOperatorsList(page, 50, search, serviceType, status);
  const { mutate: updateOperator, isPending } = useUpdateOperator();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleOperator = (operator: ProviderOperator) => {
    updateOperator({
      id: operator._id,
      status: !operator.status
    });
  };

  const columns = [
    {
      accessorKey: "name",
      header: "Operator",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white text-base">{info.getValue()}</span>
          <span className="text-xs text-muted-foreground font-mono mt-0.5">Code: {info.row.original.code}</span>
        </div>
      ),
    },
    {
      accessorKey: "serviceType",
      header: "Category",
      cell: (info: any) => (
        <Badge variant="neutral" className="uppercase font-mono text-[10px] tracking-wide">
          {info.getValue()}
        </Badge>
      ),
    },
    {
      accessorKey: "provider",
      header: "API Provider",
      cell: (info: any) => (
        <span className="font-mono text-primary font-medium">{info.getValue()}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Live Status",
      cell: (info: any) => {
        const isActive = info.getValue();
        return (
          <Badge variant={isActive ? "success" : "error"} className="gap-1.5 uppercase">
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            {isActive ? "Active" : "Disabled"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: (info: any) => {
        const operator = info.row.original;
        const isActive = operator.status;
        return (
          <div className="flex items-center justify-end">
            <Button
              variant={isActive ? "destructive" : "default"}
              size="sm"
              onClick={() => toggleOperator(operator)}
              disabled={isPending}
              className="w-28 shadow-sm"
            >
              {isActive ? (
                <><PowerOff className="w-4 h-4 mr-2" /> Kill Switch</>
              ) : (
                <><Power className="w-4 h-4 mr-2" /> Enable</>
              )}
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
        title="Operator Routing"
        description="Globally enable or disable telecom operators. Disabled operators are instantly hidden from the retailer app."
      />

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Operator Name or Code..."
            className="pl-9 w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        
        <select
          value={serviceType}
          onChange={(e) => {
            setServiceType(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
        >
          <option value="all">All Categories</option>
          <option value="Mobile">Mobile</option>
          <option value="DTH">DTH</option>
          <option value="Electricity">Electricity</option>
          <option value="Fastag">FASTag</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active (Live)</option>
          <option value="inactive">Disabled</option>
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
                    className={header.id === 'actions' ? 'text-right pr-6' : ''}
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
                    <p>Loading operators...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={RadioTower} 
                    title="No operators found" 
                    description="Try adjusting your search filters." 
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={!row.original.status ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      className={cell.column.id === 'actions' ? 'text-right pr-6' : ''}
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
              of <span className="font-medium text-slate-900 dark:text-white">{data.pagination.total}</span> operators
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
