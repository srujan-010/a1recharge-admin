"use client";

import { useState } from "react";
import {
  useManualPayments,
  useManualPaymentStats,
  useManualPaymentReconciliation,
  useUpdatePaymentStatus,
  useUpdatePaymentMethod,
  useReversePayment,
  ManualPaymentItem
} from "@/hooks/useManualPayments";
import { ManualAdjustmentModal } from "@/components/retailer/ManualAdjustmentModal";
import {
  Search, Loader2, RefreshCw, CheckCircle2, Clock,
  ArrowLeftRight, Eye, Wallet, CreditCard, ReceiptText,
  RotateCcw, Building2, QrCode, Banknote, MoreVertical, Plus,
  ChevronLeft, ChevronRight, AlertCircle, Info
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ManualPaymentsPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "paid" | "unpaid" | "reconciliation">("all");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [walletStatus, setWalletStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [isAddCreditModalOpen, setIsAddCreditModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<ManualPaymentItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [isChangeMethodModalOpen, setIsChangeMethodModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [targetMethod, setTargetMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER" | "OTHER">("UPI");
  const [reverseReason, setReverseReason] = useState("");

  // API Queries & Mutations
  const {
    data: paymentsResponse,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
    isFetching: paymentsFetching
  } = useManualPayments(
    page,
    20,
    search,
    paymentMethod,
    paymentStatus,
    walletStatus,
    tab === "reconciliation" ? "all" : tab,
    startDate,
    endDate
  );

  const { data: stats, refetch: refetchStats } = useManualPaymentStats();
  const { data: reconciliationData, refetch: refetchReconciliation } = useManualPaymentReconciliation();

  const updateStatusMutation = useUpdatePaymentStatus();
  const updateMethodMutation = useUpdatePaymentMethod();
  const reversePaymentMutation = useReversePayment();

  const handleResetFilters = () => {
    setSearch("");
    setPaymentMethod("all");
    setPaymentStatus("all");
    setWalletStatus("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
    toast.success("Filters reset");
  };

  const handleRefresh = () => {
    refetchPayments();
    refetchStats();
    refetchReconciliation();
    toast.success("Data refreshed");
  };

  const handleConfirmStatusChange = () => {
    if (!selectedPayment) return;
    if (targetStatus === "PAID" && (selectedPayment.paymentMethod === "NOT_SET" || !selectedPayment.paymentMethod) && !targetMethod) {
      toast.error("Please select a payment method for a paid payment.");
      return;
    }
    updateStatusMutation.mutate(
      {
        id: selectedPayment.walletTransactionId?._id || selectedPayment.walletTransactionId || selectedPayment._id,
        paymentStatus: targetStatus,
        paymentMethod: targetStatus === "PAID" ? (targetMethod || selectedPayment.paymentMethod || "UPI") : undefined
      },
      {
        onSuccess: () => {
          setIsChangeStatusModalOpen(false);
          setSelectedPayment(null);
        }
      }
    );
  };

  const handleConfirmMethodChange = () => {
    if (!selectedPayment) return;
    updateMethodMutation.mutate(
      { id: selectedPayment.walletTransactionId?._id || selectedPayment.walletTransactionId || selectedPayment._id, paymentMethod: targetMethod },
      {
        onSuccess: () => {
          setIsChangeMethodModalOpen(false);
          setSelectedPayment(null);
        }
      }
    );
  };

  const handleConfirmReverse = () => {
    if (!selectedPayment || !reverseReason.trim()) {
      toast.error("Please enter a valid reversal reason.");
      return;
    }
    reversePaymentMutation.mutate(
      { id: selectedPayment.walletTransactionId?._id || selectedPayment.walletTransactionId || selectedPayment._id, reason: reverseReason },
      {
        onSuccess: () => {
          setIsReverseModalOpen(false);
          setSelectedPayment(null);
          setReverseReason("");
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* 1. HEADER SECTION MATCHING SCREENSHOT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Manual Payments
            </h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800">
              Audit Enabled
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-normal mt-1">
            Track wallet credits given to retailers and maintain payment status for reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsAddCreditModalOpen(true)}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Wallet Credit
          </Button>
        </div>
      </div>

      {/* 2. SUMMARY CARDS ROW MATCHING SCREENSHOT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Today's Credits */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Today's Credits</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.todayCredits?.amount ? stats.todayCredits.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.todayCredits?.count || 0} credits today</div>
        </div>

        {/* Paid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Paid</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.paid?.amount ? stats.paid.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.paid?.count || 0} confirmed paid</div>
        </div>

        {/* Unpaid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Unpaid</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.unpaid?.amount ? stats.unpaid.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.unpaid?.count || 0} pending confirmation</div>
        </div>

        {/* UPI */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
              <QrCode className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">UPI</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.upi?.amount ? stats.upi.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.upi?.count || 0} UPI credits</div>
        </div>

        {/* Cash */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Banknote className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Cash</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.cash?.amount ? stats.cash.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.cash?.count || 0} cash credits</div>
        </div>

        {/* Bank Transfer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bank Transfer</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            ₹{stats?.bankTransfer?.amount ? stats.bankTransfer.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-400 font-normal">{stats?.bankTransfer?.count || 0} bank transfers</div>
        </div>

      </div>

      {/* 3. SEARCH & FILTER TOOLBAR MATCHING SCREENSHOT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
          
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search retailer name, phone, retailer ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Payment Method Filter */}
          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentStatus}
            onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
            className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Payment Statuses</option>
            <option value="PAID">PAID</option>
            <option value="UNPAID">UNPAID</option>
          </select>

          {/* Wallet Status Filter & Reset */}
          <div className="flex items-center gap-2">
            <select
              value={walletStatus}
              onChange={(e) => { setWalletStatus(e.target.value); setPage(1); }}
              className="h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none w-full"
            >
              <option value="all">All Wallet Statuses</option>
              <option value="CREDITED">CREDITED</option>
              <option value="REVERSED">REVERSED</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

        </div>
      </div>

      {/* 4. MAIN TABLE CONTAINER MATCHING SCREENSHOT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        
        {paymentsLoading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-400 text-xs font-normal">Loading transaction records...</p>
          </div>
        ) : !paymentsResponse?.data || paymentsResponse.data.length === 0 ? (
          <div className="py-16 text-center space-y-1">
            <ReceiptText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Transactions Found</h3>
            <p className="text-xs text-slate-400">No manual wallet credits match the selected filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-950 text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">DATE</th>
                    <th className="py-3 px-4">RETAILER</th>
                    <th className="py-3 px-4">AMOUNT</th>
                    <th className="py-3 px-4">PAYMENT METHOD</th>
                    <th className="py-3 px-4">PAYMENT STATUS</th>
                    <th className="py-3 px-4">WALLET STATUS</th>
                    <th className="py-3 px-4">CREATED BY</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paymentsResponse.data.map((item) => {
                    const method = item.paymentMethod || "NOT_SET";
                    const pStatus = item.paymentStatus || "PAID";
                    const wStatus = item.walletStatus || (item.walletCredited ? "CREDITED" : "CREDITED");

                    return (
                      <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        
                        {/* DATE */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-xs text-slate-900 dark:text-white">
                            {format(new Date(item.paymentDate || item.createdAt), "dd MMM yyyy")}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {format(new Date(item.paymentDate || item.createdAt), "hh:mm a")}
                          </div>
                        </td>

                        {/* RETAILER */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-xs text-slate-900 dark:text-white">{item.retailerName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.retailerId?.retailerId || item.retailerId?._id?.slice(-8) || "N/A"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.retailerPhone || item.retailerId?.phone || ""}
                          </div>
                        </td>

                        {/* AMOUNT */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                          ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* PAYMENT METHOD PILL */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {pStatus === "UNPAID" || method === "NOT_SET" || method === "NOT_SPECIFIED" ? (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                              Not Paid
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800">
                              {method === "BANK_TRANSFER" ? "Bank Transfer" : method === "CASH" ? "Cash" : method}
                            </span>
                          )}
                        </td>

                        {/* PAYMENT STATUS PILL */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {pStatus === "PAID" && (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                              PAID ✓
                            </span>
                          )}
                          {pStatus === "UNPAID" && (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800">
                              UNPAID
                            </span>
                          )}
                        </td>

                        {/* WALLET STATUS PILL */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.isReversed || wStatus === "REVERSED" ? (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800">
                              REVERSED
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                              CREDITED
                            </span>
                          )}
                        </td>

                        {/* CREATED BY */}
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {item.createdByName || "Super Admin"}
                        </td>

                        {/* ACTIONS BUTTONS MATCHING SCREENSHOT */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* View Details Button */}
                            <button
                              onClick={() => { setSelectedPayment(item); setIsDetailsModalOpen(true); }}
                              className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400 font-bold text-xs flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>

                            {/* Mark Status Button with Distinct Styling */}
                            {pStatus === "UNPAID" ? (
                              <button
                                onClick={() => {
                                  setSelectedPayment(item);
                                  setTargetStatus("PAID");
                                  setIsChangeStatusModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Mark Paid
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedPayment(item);
                                  setTargetStatus("UNPAID");
                                  setIsChangeStatusModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Mark Unpaid
                              </button>
                            )}

                            {/* Options Popover (⋮) */}
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenuId(activeMenuId === item._id ? null : item._id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {activeMenuId === item._id && (
                                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-30 py-1 text-left animate-in fade-in duration-100">
                                  
                                  <button
                                    onClick={() => {
                                      setSelectedPayment(item);
                                      setTargetMethod((item.paymentMethod as any) || "UPI");
                                      setIsChangeMethodModalOpen(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Change Method
                                  </button>

                                  {!item.isReversed && wStatus !== "REVERSED" && (
                                    <button
                                      onClick={() => {
                                        setSelectedPayment(item);
                                        setIsReverseModalOpen(true);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 font-medium"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" /> Reverse Credit
                                    </button>
                                  )}

                                </div>
                              )}
                            </div>

                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* FOOTER PAGINATION BAR MATCHING SCREENSHOT */}
            <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>
                Showing 1 to {paymentsResponse.data.length} of {paymentsResponse.pagination.total} entries
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={`p-1.5 rounded-md border border-slate-200 dark:border-slate-800 ${page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-100"}`}
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>

                <span className="w-7 h-7 bg-blue-600 text-white font-bold rounded-md flex items-center justify-center text-xs">
                  {page}
                </span>

                <button
                  disabled={page >= paymentsResponse.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className={`p-1.5 rounded-md border border-slate-200 dark:border-slate-800 ${page >= paymentsResponse.pagination.pages ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-100"}`}
                >
                  <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* FOOTER COPYRIGHT MATCHING SCREENSHOT */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 pt-4 border-t border-slate-200/60 dark:border-slate-800">
        <div>© 2026 A1 Recharge. All rights reserved.</div>
        <div className="flex items-center gap-3">
          <span>v1.2.4</span>
          <span>|</span>
          <span className="hover:underline cursor-pointer">Support</span>
          <span>|</span>
          <span className="hover:underline cursor-pointer">Privacy</span>
          <span>|</span>
          <span className="hover:underline cursor-pointer">Terms</span>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* MODAL 1: ADD WALLET CREDIT MODAL */}
      {/* -------------------------------------------------- */}
      <ManualAdjustmentModal
        isOpen={isAddCreditModalOpen}
        onClose={() => {
          setIsAddCreditModalOpen(false);
          refetchPayments();
          refetchStats();
        }}
        defaultType="credit"
      />

      {/* -------------------------------------------------- */}
      {/* MODAL 2: PAYMENT DETAILS MODAL */}
      {/* -------------------------------------------------- */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Manual Wallet Credit Details
            </DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-2.5 text-xs font-normal">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Retailer</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedPayment.retailerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Retailer ID</span>
                <span className="font-mono font-medium">{selectedPayment.retailerId?.retailerId || selectedPayment.retailerId?._id?.slice(-8) || "N/A"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Mobile</span>
                <span className="font-mono font-medium">{selectedPayment.retailerPhone || selectedPayment.retailerId?.phone || "N/A"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">₹{selectedPayment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Payment Status</span>
                <span className={`font-bold ${selectedPayment.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedPayment.paymentStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Wallet Status</span>
                <span className="font-semibold text-blue-600">{selectedPayment.isReversed ? 'REVERSED' : 'CREDITED'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Reason</span>
                <span className="text-slate-800 dark:text-slate-200">{selectedPayment.notes || "Credit"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Balance Before</span>
                <span className="font-mono font-medium">₹{((selectedPayment.previousBalancePaise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Balance After</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">₹{((selectedPayment.closingBalancePaise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Created By</span>
                <span className="font-medium">{selectedPayment.createdByName || "Super Admin"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500">Created At</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{format(new Date(selectedPayment.createdAt), "dd MMM yyyy, hh:mm a")}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Updated At</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{format(new Date(selectedPayment.updatedAt || selectedPayment.createdAt), "dd MMM yyyy, hh:mm a")}</span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)} className="h-9 font-medium text-xs w-full">
              Close Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- */}
      {/* MODAL 3: CHANGE PAYMENT STATUS */}
      {/* -------------------------------------------------- */}
      <Dialog open={isChangeStatusModalOpen} onOpenChange={setIsChangeStatusModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">Change Payment Status</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update payment confirmation status without touching wallet money.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-3 text-xs">
              {targetStatus === "UNPAID" && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md text-amber-800 dark:text-amber-300 font-medium">
                  Payment status is being changed to UNPAID. The ₹{selectedPayment.amount.toFixed(2)} wallet credit will remain unchanged.
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Select Payment Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-medium text-xs"
                >
                  <option value="PAID">PAID (Payment Confirmed)</option>
                  <option value="UNPAID">UNPAID (Pending Confirmation)</option>
                </select>
              </div>

              {targetStatus === "PAID" && (
                <div className="space-y-1 pt-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Select Payment Method *</label>
                  <select
                    value={targetMethod}
                    onChange={(e) => setTargetMethod(e.target.value as any)}
                    className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-medium text-xs font-semibold"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsChangeStatusModalOpen(false)} className="h-9 font-medium text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStatusChange}
              disabled={updateStatusMutation.isPending}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4"
            >
              {updateStatusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Payment Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- */}
      {/* MODAL 4: CHANGE PAYMENT METHOD */}
      {/* -------------------------------------------------- */}
      <Dialog open={isChangeMethodModalOpen} onOpenChange={setIsChangeMethodModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">Change Payment Method</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update method used by retailer to pay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-slate-700 dark:text-slate-300">Select Payment Method</label>
              <select
                value={targetMethod}
                onChange={(e) => setTargetMethod(e.target.value as any)}
                className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-medium text-xs"
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsChangeMethodModalOpen(false)} className="h-9 font-medium text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMethodChange}
              disabled={updateMethodMutation.isPending}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4"
            >
              {updateMethodMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Payment Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- */}
      {/* MODAL 5: REVERSE WALLET CREDIT MODAL */}
      {/* -------------------------------------------------- */}
      <Dialog open={isReverseModalOpen} onOpenChange={setIsReverseModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reverse Wallet Credit
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Debits ₹{selectedPayment?.amount.toFixed(2)} from retailer wallet without deleting financial history.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-3 text-xs font-normal">
              <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-md border border-rose-200 dark:border-rose-800 space-y-0.5">
                <p className="font-semibold text-slate-900 dark:text-white">Original Credit: ₹{selectedPayment.amount.toFixed(2)}</p>
                <p className="text-rose-600 font-mono font-bold">Amount to Reverse: ₹{selectedPayment.amount.toFixed(2)}</p>
                <p className="text-slate-500">Retailer: {selectedPayment.retailerName}</p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Reversal Reason *</label>
                <Input
                  placeholder="e.g. Credit added by mistake / Chargeback"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="h-8 text-xs font-normal"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsReverseModalOpen(false)} className="h-9 font-medium text-xs">
              Cancel
            </Button>
            <Button onClick={handleConfirmReverse} disabled={reversePaymentMutation.isPending} className="h-9 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-4">
              {reversePaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reverse Wallet Credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
