import { useState, useEffect } from "react";
import { useManualAdjustment } from "@/hooks/useWallet";
import { X, AlertCircle, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  retailerName: string;
  defaultType?: "credit" | "debit";
}

export function ManualAdjustmentModal({ isOpen, onClose, userId, retailerName, defaultType = "credit" }: ManualAdjustmentModalProps) {
  const [type, setType] = useState<"credit" | "debit">(defaultType);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Sync type when defaultType changes
  useEffect(() => {
    setType(defaultType);
  }, [defaultType, isOpen]);
  
  const { mutate: adjustWallet, isPending, error } = useManualAdjustment();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    if (reason.trim().length < 5) return;

    const amountPaise = Math.round(Number(amount) * 100);
    const idempotencyKey = `manual_adj_${userId}_${Date.now()}`;

    adjustWallet(
      { userId, type, amountPaise, reason, idempotencyKey },
      {
        onSuccess: () => {
          onClose();
          setAmount("");
          setReason("");
          setType("credit");
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
          <h2 className="text-xl font-bold text-white tracking-tight">Manual Wallet Adjustment</h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{(error as any)?.response?.data?.message || error.message}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("credit")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold transition-all ${
                  type === "credit"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "bg-black/40 border-white/5 text-zinc-500 hover:bg-black/60"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" /> Credit (Add)
              </button>
              <button
                type="button"
                onClick={() => setType("debit")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold transition-all ${
                  type === "debit"
                    ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    : "bg-black/40 border-white/5 text-zinc-500 hover:bg-black/60"
                }`}
              >
                <ArrowDownRight className="w-4 h-4" /> Debit (Deduct)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Reason (Required for Audit Log)
            </label>
            <textarea
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none h-24"
              placeholder={`Reason for ${type}ing ₹${amount || '0'} to ${retailerName}...`}
            />
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !amount || reason.length < 5}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                isPending || !amount || reason.length < 5
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : type === "credit"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20"
                  : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
              }`}
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Confirm {type.charAt(0).toUpperCase() + type.slice(1)}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
