import { useState, useEffect } from "react";
import { useManualAdjustment } from "@/hooks/useWallet";
import { useRetailersList, Retailer } from "@/hooks/useRetailers";
import { X, AlertCircle, ArrowUpRight, ArrowDownRight, Loader2, QrCode, Banknote, Building2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  retailerName?: string;
  currentBalanceRupees?: number;
  defaultType?: "credit" | "debit";
}

export function ManualAdjustmentModal({
  isOpen,
  onClose,
  userId: initialUserId = "",
  retailerName: initialRetailerName = "",
  currentBalanceRupees: initialBalance = 0,
  defaultType = "credit"
}: ManualAdjustmentModalProps) {
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [retailerSearch, setRetailerSearch] = useState("");
  const [type, setType] = useState<"credit" | "debit">(defaultType);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Credit");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "BANK_TRANSFER" | "OTHER">("UPI");

  const { data: retailersData } = useRetailersList(1, 50, retailerSearch);

  // Sync type when defaultType changes
  useEffect(() => {
    setType(defaultType);
    if (defaultType === "debit") {
      setReason("Debit adjustment");
    } else {
      setReason("Credit");
    }
  }, [defaultType, isOpen]);

  const activeUserId = initialUserId || selectedRetailer?._id || "";
  const matchedRetailer = retailersData?.data?.find(r => r._id === activeUserId);
  const activeRetailerName = initialRetailerName || selectedRetailer?.name || matchedRetailer?.name || "Select Retailer";
  const activeRetailerIdCode = selectedRetailer?.retailerId || matchedRetailer?.retailerId || "";

  const activeBalance = (initialBalance !== undefined && initialBalance !== null && !isNaN(Number(initialBalance)))
    ? Number(initialBalance)
    : selectedRetailer
    ? ((selectedRetailer.walletBalancePaise || 0) / 100)
    : matchedRetailer
    ? ((matchedRetailer.walletBalancePaise || 0) / 100)
    : 0;

  const { mutate: adjustWallet, isPending, error } = useManualAdjustment();

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const newBalanceRupees = type === "credit"
    ? activeBalance + numAmount
    : Math.max(0, activeBalance - numAmount);

  const isFormValid = !!activeUserId && numAmount > 0 && (type === "debit" || paymentStatus === "UNPAID" || !!paymentMethod);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUserId) {
      toast.error("Please select a retailer first.");
      return;
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }
    if (type === "credit" && paymentStatus === "PAID" && !paymentMethod) {
      toast.error("Please select a payment method for a paid payment.");
      return;
    }

    const amountPaise = Math.round(numAmount * 100);
    const idempotencyKey = `ADM_${type.toUpperCase()}_${activeUserId}_${Date.now()}`;

    // UNPAID does NOT require paymentMethod
    const finalMethod = type === "credit" ? (paymentStatus === "PAID" ? paymentMethod : undefined) : "ADMIN_ADJUSTMENT";

    adjustWallet(
      {
        userId: activeUserId,
        type,
        amountPaise,
        reason: reason.trim() || (type === "credit" ? "Credit" : "Debit"),
        paymentMethod: finalMethod,
        paymentStatus: type === "credit" ? paymentStatus : "PAID",
        idempotencyKey
      },
      {
        onSuccess: (res) => {
          toast.success(res?.message || `Successfully applied ${type} of ₹${numAmount.toFixed(2)}.`);
          onClose();
          setAmount("");
          setReason("Credit");
          setSelectedRetailer(null);
          setType("credit");
          setPaymentStatus("PAID");
          setPaymentMethod("UPI");
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err.message || "Wallet adjustment failed.");
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {type === "credit" ? "Add Wallet Credit" : "Manual Wallet Debit"}
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              {type === "credit"
                ? "Record a wallet credit and payment status for this retailer."
                : "Deduct money from retailer wallet for admin adjustments."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-normal">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-start gap-2 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">{(error as any)?.response?.data?.message || error.message}</p>
            </div>
          )}

          {/* Retailer Info Header */}
          {initialUserId ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">{activeRetailerName}</span>
                {activeRetailerIdCode && <span className="ml-1.5 text-slate-500 font-mono">({activeRetailerIdCode})</span>}
              </div>
              <div className="text-slate-500">
                Current Balance: <span className="font-mono font-bold text-slate-900 dark:text-white">₹{activeBalance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Select Retailer *</label>
              <select
                value={selectedRetailer?._id || ""}
                onChange={(e) => {
                  const found = retailersData?.data?.find((r) => r._id === e.target.value);
                  setSelectedRetailer(found || null);
                }}
                className="w-full h-9 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose Retailer --</option>
                {retailersData?.data?.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} ({r.retailerId || r.phone}) — Bal: ₹{((r.walletBalancePaise || 0) / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Adjustment Type Switch (Credit vs Debit) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("credit")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "credit"
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-600 dark:text-blue-400"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Credit (Add Money)
              </button>
              <button
                type="button"
                onClick={() => setType("debit")}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "debit"
                    ? "bg-rose-50 dark:bg-rose-950/60 border-rose-600 text-rose-600 dark:text-rose-400"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" /> Debit (Deduct Money)
              </button>
            </div>
          </div>

          {/* Amount & Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-slate-900 dark:text-white text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                placeholder={type === "credit" ? "e.g. Credit" : "e.g. Debit adjustment"}
              />
            </div>
          </div>

          {/* PAYMENT SECTION FOR CREDIT */}
          {type === "credit" && (
            <div className="p-3 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              
              {/* Payment Status Segmented Control */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Payment Status *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("PAID")}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                      paymentStatus === "PAID"
                        ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    PAID
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("UNPAID")}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                      paymentStatus === "UNPAID"
                        ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    UNPAID
                  </button>
                </div>
              </div>

              {/* Conditional Payment Method Display */}
              {paymentStatus === "PAID" ? (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full h-9 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <div className="h-9 px-3 bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>Not Paid — Payment not confirmed</span>
                    <span className="text-[10px] text-amber-600 font-bold uppercase">Disabled</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    Payment method can be selected after payment is confirmed.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* PAYMENT SECTION FOR DEBIT */}
          {type === "debit" && (
            <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-medium">Classification:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">Admin Adjustment</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-medium">Payment Method:</span>
                <span className="font-semibold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                  Admin Adjustment
                </span>
              </div>
            </div>
          )}

          {/* Simple Balance Preview (Requirement 6 & 10) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Current Balance:</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">₹{activeBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Credit Amount:</span>
              <span className="font-mono font-bold text-emerald-600">+₹{numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 text-slate-900 dark:text-white font-semibold">
              <span>New Balance:</span>
              <span className="font-mono font-bold text-sm">₹{newBalanceRupees.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !isFormValid}
              className={`flex-1 h-9 flex items-center justify-center gap-1.5 px-4 rounded-lg font-semibold text-xs transition-all shadow-xs ${
                isPending || !isFormValid
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                  : type === "credit"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Confirm {type === "credit" ? `Credit ₹${numAmount.toFixed(2)}` : `Debit ₹${numAmount.toFixed(2)}`}</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
