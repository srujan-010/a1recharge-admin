"use client";

import { useAdminsList, useUpdateAdminStatus } from "@/hooks/useAdmins";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2, ShieldAlert, Ban, CheckCircle, Shield } from "lucide-react";
import { format } from "date-fns";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminsPage() {
  const { data: admins, isLoading } = useAdminsList();
  const { mutate: updateStatus } = useUpdateAdminStatus();

  const columns = [
    {
      accessorKey: "name",
      header: "Admin User",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">{info.getValue()}</span>
          <span className="text-xs text-muted-foreground mt-0.5">{info.row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: (info: any) => {
        const val = info.getValue() as string;
        return (
          <Badge variant="info" className="uppercase font-mono text-[10px] tracking-wide">
            {val.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (info: any) => {
        const val = info.getValue() as string;
        let variant: any = "neutral";
        if (val === "ACTIVE") variant = "success";
        else if (val === "SUSPENDED") variant = "warning";
        else if (val === "BLOCKED") variant = "error";
        
        return (
          <Badge variant={variant} className="capitalize">
            {val.toLowerCase()}
          </Badge>
        );
      },
    },
    {
      accessorKey: "lastLogin",
      header: "Last Login",
      cell: (info: any) => (
        <span className="text-muted-foreground text-sm font-medium">
          {info.getValue() ? format(new Date(info.getValue()), "PPpp") : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (info: any) => {
        const admin = info.row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {admin.status === "ACTIVE" ? (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 dark:hover:bg-amber-900/20"
                onClick={() => updateStatus({ id: admin._id, status: "SUSPENDED" })}
                title="Suspend Access"
              >
                <Ban className="w-4 h-4 text-amber-500" />
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-emerald-900/20"
                onClick={() => updateStatus({ id: admin._id, status: "ACTIVE" })}
                title="Restore Access"
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: admins || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Admin Users"
        description="Manage internal staff accounts, roles, and system access privileges."
        actions={
          <Button>
            <Shield className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        }
      />

      {/* Data Table */}
      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id}
                    className={header.id === 'actions' ? 'text-right' : ''}
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
                    <p>Loading admin personnel...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 p-0">
                  <EmptyState 
                    icon={ShieldAlert} 
                    title="No admins found" 
                    description="No admin users are registered in the system." 
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      className={cell.column.id === 'actions' ? 'text-right' : ''}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
