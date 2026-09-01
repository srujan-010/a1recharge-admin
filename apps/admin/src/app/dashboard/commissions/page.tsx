"use client";

import { useState } from "react";
import {
  useGlobalCommissionsList,
  useUpdateGlobalCommission,
  useCreateGlobalCommission,
  GlobalCommission,
} from "@/hooks/useGlobalCommissions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AccountTypeBadge } from "@/components/ui/account-type-badge";
import { AccountTypeFilter, AccountTypeFilterValue } from "@/components/ui/account-type-filter";
import {
  Sparkles, Save, Server, ToggleLeft, ToggleRight, Radio, Search, Plus, X, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";

export default function GlobalCommissionsPage() {
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeFilterValue>("BUSINESS");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const { data: commResponse, isLoading, refetch } = useGlobalCommissionsList(selectedAccountType);
  const { mutate: updateCommission, isPending: isUpdating } = useUpdateGlobalCommission();
  const { mutate: createCommission, isPending: isCreating } = useCreateGlobalCommission();

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [editingComm, setEditingComm] = useState<Record<string, { retailer: string; provider: string }>>({});

  // Add Slab Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    accountType: "PERSONAL" | "BUSINESS";
    operatorCode: string;
    operatorName: string;
    serviceType: string;
    providerCommission: string;
    retailerCommission: string;
    status: "ACTIVE" | "INACTIVE";
  }>({
    accountType: "PERSONAL",
    operatorCode: "",
    operatorName: "",
    serviceType: "mobile",
    providerCommission: "3.5",
    retailerCommission: "2.5",
    status: "ACTIVE",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const commissions = commResponse?.data || [];
  const stats = commResponse?.stats || {
    personalSlabs: 0,
    businessSlabs: 0,
    activeSlabs: 0,
    inactiveSlabs: 0,
    personalActive: 0,
    businessActive: 0,
  };

  // Group commissions by serviceType
  const filteredCommissions = commissions.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.operatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.operatorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const grouped = filteredCommissions.reduce((acc, curr) => {
    const service = curr.serviceType || "mobile";
    if (!acc[service]) {
      acc[service] = [];
    }
    acc[service].push(curr);
    return acc;
  }, {} as Record<string, GlobalCommission[]>);

  const toggleService = (service: string) => {
    setExpandedServices((prev) => ({ ...prev, [service]: !prev[service] }));
  };

  const handleEditChange = (key: string, field: "retailer" | "provider", value: string) => {
    setEditingComm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = (op: GlobalCommission) => {
    const keyWithName = `${op.accountType}_${op.operatorCode}_${op.operatorName.replace(/\s+/g, "_")}`;
    const keyWithCode = `${op.accountType}_${op.operatorCode}`;
    const edits = editingComm[keyWithName] || editingComm[keyWithCode] || editingComm[op.operatorCode];
    if (!edits) return;

    const providerCommission = edits.provider !== undefined ? parseFloat(edits.provider) : op.providerCommission;
    const retailerCommission = edits.retailer !== undefined ? parseFloat(edits.retailer) : op.retailerCommission;

    updateCommission(
      {
        code: op.operatorCode,
        payload: {
          accountType: op.accountType,
          providerCommission,
          retailerCommission,
          operatorName: op.operatorName,
        },
      },
      {
        onSuccess: () => {
          const newEditing = { ...editingComm };
          delete newEditing[keyWithName];
          delete newEditing[keyWithCode];
          delete newEditing[op.operatorCode];
          setEditingComm(newEditing);
          refetch();
        },
        onError: (err: any) => alert(err.response?.data?.message || err.message),
      }
    );
  };

  const toggleStatus = (op: GlobalCommission) => {
    updateCommission(
      {
        code: op.operatorCode,
        payload: {
          accountType: op.accountType,
          providerCommission: op.providerCommission,
          retailerCommission: op.retailerCommission,
          operatorName: op.operatorName,
          status: op.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        },
      },
      {
        onSuccess: () => refetch(),
        onError: (err: any) => alert(err.response?.data?.message || err.message),
      }
    );
  };

  const handleCreateSlab = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!addForm.accountType) {
      setFormError("Account Type is required.");
      return;
    }
    if (!addForm.operatorCode.trim()) {
      setFormError("Operator Code is required.");
      return;
    }

    const providerComm = parseFloat(addForm.providerCommission);
    const retailerComm = parseFloat(addForm.retailerCommission);

    if (isNaN(providerComm) || isNaN(retailerComm)) {
      setFormError("Commissions must be valid numbers.");
      return;
    }

    if (retailerComm > providerComm) {
      setFormError("Retailer commission cannot exceed provider commission.");
      return;
    }

    createCommission(
      {
        accountType: addForm.accountType,
        operatorCode: addForm.operatorCode.trim().toUpperCase(),
        operatorName: addForm.operatorName.trim() || addForm.operatorCode.trim().toUpperCase(),
        providerCommission: providerComm,
        retailerCommission: retailerComm,
        status: addForm.status,
      },
      {
        onSuccess: () => {
          setIsAddModalOpen(false);
          setAddForm({
            accountType: "PERSONAL",
            operatorCode: "",
            operatorName: "",
            serviceType: "mobile",
            providerCommission: "3.5",
            retailerCommission: "2.5",
            status: "ACTIVE",
          });
          refetch();
        },
        onError: (err: any) => {
          setFormError(err.response?.data?.message || err.message || "Failed to create commission slab.");
        },
      }
    );
  };

  const handleOpenAddModal = (presetAccType?: "PERSONAL" | "BUSINESS") => {
    setFormError(null);
    setAddForm((prev) => ({
      ...prev,
      accountType: presetAccType || (selectedAccountType === "BUSINESS" ? "BUSINESS" : "PERSONAL"),
    }));
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-24 max-w-[1400px] mx-auto">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Commission Management"
            description="Manage account-type-specific commission structures for Personal and Business retailer tiers."
          />
        </div>

        <Button
          onClick={() => handleOpenAddModal()}
          className="h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Add Commission Slab
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Personal Slabs</p>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">{stats.personalSlabs}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{stats.personalActive} Active</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Business Slabs</p>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">{stats.businessSlabs}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{stats.businessActive} Active</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active Slabs</p>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{stats.activeSlabs}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Ready for calculation</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inactive Slabs</p>
          <p className="text-2xl font-black font-mono text-rose-500">{stats.inactiveSlabs}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Disabled operators</p>
        </div>
      </div>

      {/* Account Type Selector & Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <AccountTypeFilter
            value={selectedAccountType}
            onChange={(val) => setSelectedAccountType(val)}
            showAll={true}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search operator or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-semibold text-slate-500">Fetching {selectedAccountType} commission slabs...</p>
          </div>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Server className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {selectedAccountType === "PERSONAL"
                ? "No Personal commission slabs configured yet."
                : selectedAccountType === "BUSINESS"
                ? "No Business commission slabs configured yet."
                : "No commission slabs found."}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              Create slabs for this account type to enable automatic calculations on recharges.
            </p>
          </div>
          <Button
            onClick={() => handleOpenAddModal(selectedAccountType === "BUSINESS" ? "BUSINESS" : "PERSONAL")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 h-10 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add {selectedAccountType === "BUSINESS" ? "Business" : "Personal"} Slab
          </Button>
        </div>
      ) : (
        /* Commission Tables Grouped by Service */
        <div className="space-y-6">
          {Object.entries(grouped).map(([service, ops]) => (
            <div
              key={service}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
            >
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
                        <TableHead className="w-[15%] font-semibold">Account Type</TableHead>
                        <TableHead className="w-[30%] font-semibold">Operator Name</TableHead>
                        <TableHead className="w-[15%] text-right font-semibold">Provider Comm (%)</TableHead>
                        <TableHead className="w-[15%] text-right font-semibold">Retailer Comm (%)</TableHead>
                        <TableHead className="w-[10%] text-right font-semibold">Our Margin (%)</TableHead>
                        <TableHead className="w-[10%] text-center font-semibold">Status</TableHead>
                        <TableHead className="w-[5%] text-right font-semibold">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ops?.map((op, idx) => {
                        const editKey = `${op.accountType}_${op.operatorCode}_${op.operatorName.replace(/\s+/g, "_")}`;
                        const isEditing =
                          editingComm[editKey] !== undefined ||
                          editingComm[`${op.accountType}_${op.operatorCode}`] !== undefined ||
                          editingComm[op.operatorCode] !== undefined;
                        const activeEdits =
                          editingComm[editKey] ||
                          editingComm[`${op.accountType}_${op.operatorCode}`] ||
                          editingComm[op.operatorCode] ||
                          {};

                        const editedProvider =
                          activeEdits.provider !== undefined
                            ? parseFloat(activeEdits.provider)
                            : op.providerCommission;
                        const editedRetailer =
                          activeEdits.retailer !== undefined
                            ? parseFloat(activeEdits.retailer)
                            : op.retailerCommission;
                        const margin = (editedProvider || 0) - (editedRetailer || 0);

                        return (
                          <TableRow
                            key={`${op.accountType}_${op.operatorCode}_${op.operatorName.replace(/\s+/g, "_")}_${op._id || idx}`}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <TableCell>
                              <AccountTypeBadge type={op.accountType} size="sm" />
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                  <Radio className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-[14px] text-slate-900 dark:text-white">
                                    {op.operatorName}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-400 font-medium tracking-wider">
                                    OP: {op.operatorCode}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={activeEdits.provider !== undefined ? activeEdits.provider : op.providerCommission}
                                onChange={(e) => handleEditChange(editKey, "provider", e.target.value)}
                                className="w-20 p-1.5 text-right font-mono text-sm font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </TableCell>

                            <TableCell className="text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={activeEdits.retailer !== undefined ? activeEdits.retailer : op.retailerCommission}
                                onChange={(e) => handleEditChange(editKey, "retailer", e.target.value)}
                                className="w-20 p-1.5 text-right font-mono text-sm font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </TableCell>

                            <TableCell className="text-right">
                              <span
                                className={`font-mono font-bold text-[14px] ${
                                  margin < 0 ? "text-rose-500" : "text-emerald-500"
                                }`}
                              >
                                {margin.toFixed(2)}%
                              </span>
                            </TableCell>

                            <TableCell className="text-center">
                              <button
                                onClick={() => toggleStatus(op)}
                                className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
                              >
                                {op.status === "ACTIVE" ? (
                                  <ToggleRight className="w-8 h-8 text-emerald-500" />
                                ) : (
                                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                                )}
                              </button>
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                disabled={!isEditing || isUpdating}
                                onClick={() => handleSave(op)}
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
        </div>
      )}

      {/* Add Commission Slab Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full rounded-[24px] shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add Commission Slab</h3>
                <p className="text-xs text-slate-500 font-medium">Create a new account-type specific commission rate.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSlab} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Account Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddForm((p) => ({ ...p, accountType: "PERSONAL" }))}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      addForm.accountType === "PERSONAL"
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Personal
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddForm((p) => ({ ...p, accountType: "BUSINESS" }))}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      addForm.accountType === "BUSINESS"
                        ? "bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Business
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Service Type
                  </label>
                  <select
                    value={addForm.serviceType}
                    onChange={(e) => setAddForm((p) => ({ ...p, serviceType: e.target.value }))}
                    className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="mobile">Mobile Recharge</option>
                    <option value="dth">DTH</option>
                    <option value="bbps">BBPS Utility</option>
                    <option value="fastag">FASTag</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Operator Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AIRTEL or A"
                    value={addForm.operatorCode}
                    onChange={(e) => setAddForm((p) => ({ ...p, operatorCode: e.target.value }))}
                    className="w-full p-3 text-xs uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Operator Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Airtel Prepaid"
                  value={addForm.operatorName}
                  onChange={(e) => setAddForm((p) => ({ ...p, operatorName: e.target.value }))}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Provider Commission (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="3.5"
                    value={addForm.providerCommission}
                    onChange={(e) => setAddForm((p) => ({ ...p, providerCommission: e.target.value }))}
                    className="w-full p-3 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Retailer Commission (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2.5"
                    value={addForm.retailerCommission}
                    onChange={(e) => setAddForm((p) => ({ ...p, retailerCommission: e.target.value }))}
                    className="w-full p-3 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Initial Status
                </label>
                <select
                  value={addForm.status}
                  onChange={(e) => setAddForm((p) => ({ ...p, status: e.target.value as any }))}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" onClick={() => setIsAddModalOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !addForm.operatorCode}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-md"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Commission Slab"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
