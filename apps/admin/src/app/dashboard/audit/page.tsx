"use client";

import React, { useState } from "react";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { ShieldCheck, Loader2, ChevronRight, ChevronDown, User, MonitorSmartphone, Clock, Database, Globe, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data, isLoading } = useAuditLogs(page, 20, moduleFilter);
  const logs = data?.data || [];
  const pagination = data?.pagination;

  const getActionColor = (action: string) => {
    if (action.includes('LOGIN') || action.includes('VIEW')) return 'info';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'warning';
    if (action.includes('DELETE') || action.includes('REJECT') || action.includes('SUSPEND')) return 'error';
    if (action.includes('CREATE') || action.includes('CREDIT') || action.includes('APPROVE')) return 'success';
    return 'neutral';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Security & Audit Logs"
          description="Immutable timeline of every action taken by the administration team."
        />

        <div className="flex items-center gap-4">
          <select
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
          >
            <option value="ALL">All Modules</option>
            <option value="AUTH">Authentication</option>
            <option value="WALLET">Wallets & Finance</option>
            <option value="KYC">KYC</option>
            <option value="SUPPORT">Support</option>
            <option value="SETTINGS">Settings</option>
            <option value="NOTIFICATION">Notifications</option>
          </select>
        </div>
      </div>

      <div className="shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Administrator</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Network Info</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                      <p>Retrieving security logs...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 p-0">
                    <EmptyState 
                      icon={ShieldCheck} 
                      title="No audit logs found" 
                      description="No records match the selected module filter." 
                    />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLog === log._id;
                  const hasPayload = log.oldData || log.newData;

                  return (
                    <React.Fragment key={log._id}>
                      <TableRow className="group">
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-primary" />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{log.adminId?.name || 'Unknown'}</div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{log.adminId?.role || 'SYSTEM'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action) as any}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground font-medium">
                            <Database className="w-4 h-4" />
                            {log.module}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3 text-slate-400" /> {log.ipAddress || 'Unknown IP'}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate max-w-[150px]" title={log.userAgent}>
                              <MonitorSmartphone className="w-3 h-3" /> {log.userAgent?.split(' ')[0] || 'Unknown Device'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasPayload ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedLog(isExpanded ? null : log._id)}
                              className="text-primary hover:text-primary/80 flex items-center gap-1 ml-auto"
                            >
                              Inspect {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm italic mr-4">No Payload</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasPayload && (
                        <TableRow className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                          <TableCell colSpan={6} className="p-6">
                            <div className="grid grid-cols-2 gap-6">
                              {log.oldData && (
                                <div className="space-y-2">
                                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Previous State</div>
                                  <pre className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-red-600 dark:text-red-400 overflow-x-auto shadow-inner">
                                    {JSON.stringify(log.oldData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newData && (
                                <div className="space-y-2">
                                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">New State / Payload</div>
                                  <pre className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-emerald-600 dark:text-emerald-400 overflow-x-auto shadow-inner">
                                    {JSON.stringify(log.newData, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing page <span className="font-medium text-slate-900 dark:text-white">{pagination.page}</span> of <span className="font-medium text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} total logs)
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
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
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
