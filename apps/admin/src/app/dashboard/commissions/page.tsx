"use client";

import { useState } from "react";
import { useGlobalCommissionsList, useUpdateGlobalCommission } from "@/hooks/useGlobalCommissions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sparkles, Save, Server, ToggleLeft, ToggleRight, Radio, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GlobalCommissionsPage() {
  const { data: commissions, isLoading } = useGlobalCommissionsList();
  const { mutate: updateCommission, isPending } = useUpdateGlobalCommission();

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [editingComm, setEditingComm] = useState<Record<string, { retailer: string, provider: string }>>({});
  const [searchTerm, setSearchTerm] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  // Group by service type
  const grouped = (commissions || []).reduce((acc, curr) => {
    if (searchTerm && !curr.operatorName.toLowerCase().includes(searchTerm.toLowerCase()) && !curr.serviceType.toLowerCase().includes(searchTerm.toLowerCase())) {
      return acc;
    }
    if (!acc[curr.serviceType]) {
      acc[curr.serviceType] = [];
    }
    acc[curr.serviceType]!.push(curr);
    return acc;
  }, {} as Record<string, typeof commissions extends undefined ? never : typeof commissions>);

  const toggleService = (service: string) => {
    setExpandedServices(prev => ({ ...prev, [service]: !prev[service] }));
  };

  const handleEditChange = (code: string, field: 'retailer' | 'provider', value: string) => {
    setEditingComm(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value
      }
    }));
  };

  const handleSave = (code: string, originalComm: any) => {
    const edits = editingComm[code];
    if (!edits) return;

    const providerCommission = edits.provider !== undefined ? parseFloat(edits.provider) : originalComm.providerCommission;
    const retailerCommission = edits.retailer !== undefined ? parseFloat(edits.retailer) : originalComm.retailerCommission;

    updateCommission({
      code,
      payload: {
        providerCommission,
        retailerCommission,
        operatorName: originalComm.operatorName
      }
    }, {
      onSuccess: () => {
        // clear editing state for this row
        const newEditing = { ...editingComm };
        delete newEditing[code];
        setEditingComm(newEditing);
      },
      onError: (err: any) => alert(err.response?.data?.message || err.message)
    });
  };

  const toggleStatus = (code: string, currentStatus: string, originalComm: any) => {
    updateCommission({
      code,
      payload: {
        providerCommission: originalComm.providerCommission,
        retailerCommission: originalComm.retailerCommission,
        operatorName: originalComm.operatorName,
        status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      }
    }, {
      onError: (err: any) => alert(err.response?.data?.message || err.message)
    });
  };

  return (
    <div className="space-y-8 pb-24">
      <PageHeader 
        title="Global Commission Settings" 
      />

      <div className="bg-white dark:bg-slate-900 p-4 rounded-[18px] border border-[#E7ECF3] dark:border-slate-800 shadow-sm flex items-center max-w-md">
        <Search className="w-5 h-5 text-slate-400 mr-3" />
        <input 
          type="text" 
          placeholder="Search services or operators..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="bg-transparent border-none focus:outline-none flex-1 text-sm font-medium"
        />
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([service, ops]) => (
          <div key={service} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div 
              className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => toggleService(service)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white capitalize">{service}</h3>
                  <p className="text-xs text-slate-500 font-medium">{ops?.length || 0} Operators</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {expandedServices[service] === false ? "Expand" : "Collapse"}
              </Button>
            </div>

            {expandedServices[service] !== false && (
              <div className="p-0 border-t border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-[30%] font-semibold">Operator Name</TableHead>
                      <TableHead className="w-[15%] text-right font-semibold">Provider Comm (%)</TableHead>
                      <TableHead className="w-[15%] text-right font-semibold">Retailer Comm (%)</TableHead>
                      <TableHead className="w-[15%] text-right font-semibold">Our Margin (%)</TableHead>
                      <TableHead className="w-[15%] text-center font-semibold">Status</TableHead>
                      <TableHead className="w-[10%] text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ops?.map((op) => {
                      const isEditing = editingComm[op.operatorCode] !== undefined;
                      const editedProvider = isEditing && editingComm[op.operatorCode].provider !== undefined ? parseFloat(editingComm[op.operatorCode].provider) : op.providerCommission;
                      const editedRetailer = isEditing && editingComm[op.operatorCode].retailer !== undefined ? parseFloat(editingComm[op.operatorCode].retailer) : op.retailerCommission;
                      const margin = (editedProvider || 0) - (editedRetailer || 0);

                      return (
                        <TableRow key={op.operatorCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                <Radio className="w-4 h-4 text-slate-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-[14px] text-slate-900 dark:text-white">{op.operatorName}</span>
                                <span className="font-mono text-[11px] text-slate-400 font-medium tracking-wider">OP: {op.operatorCode}</span>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={isEditing && editingComm[op.operatorCode].provider !== undefined ? editingComm[op.operatorCode].provider : op.providerCommission}
                              onChange={(e) => handleEditChange(op.operatorCode, 'provider', e.target.value)}
                              className="w-20 p-1.5 text-right font-mono text-sm font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </TableCell>

                          <TableCell className="text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={isEditing && editingComm[op.operatorCode].retailer !== undefined ? editingComm[op.operatorCode].retailer : op.retailerCommission}
                              onChange={(e) => handleEditChange(op.operatorCode, 'retailer', e.target.value)}
                              className="w-20 p-1.5 text-right font-mono text-sm font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </TableCell>

                          <TableCell className="text-right">
                            <span className={`font-mono font-bold text-[14px] ${margin < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {margin.toFixed(2)}%
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <button onClick={() => toggleStatus(op.operatorCode, op.status, op)} className="inline-flex items-center justify-center hover:opacity-80 transition-opacity">
                              {op.status === 'ACTIVE' ? (
                                <ToggleRight className="w-8 h-8 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-400" />
                              )}
                            </button>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={!isEditing || isPending}
                              onClick={() => handleSave(op.operatorCode, op)}
                              className="h-8 font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-12 text-slate-500 italic">
            No services or operators found.
          </div>
        )}
      </div>
    </div>
  );
}
