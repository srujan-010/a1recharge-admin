"use client";

import { useProvidersList, useRefreshProviderBalance } from "@/hooks/useProviders";
import { Loader2, Server, RefreshCw, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ProvidersPage() {
  const { data: providers, isLoading } = useProvidersList();
  const { mutate: refreshBalance, isPending } = useRefreshProviderBalance();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = (providerId: string) => {
    setSyncingId(providerId);
    refreshBalance(providerId, {
      onSettled: () => setSyncingId(null)
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="API Providers"
        description="Monitor underlying gateway providers and manually sync live wallet balances."
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-medium">Fetching API Provider Status...</p>
        </div>
      ) : providers?.length === 0 ? (
        <EmptyState 
          icon={Server} 
          title="No Providers Found" 
          description="The system has not registered any underlying API providers yet." 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers?.map((provider) => {
            const isSyncing = syncingId === provider._id || isPending;
            const isLowBalance = provider.balance < 400;
            const subtitle = provider.providerName === 'Fast2SMS' ? 'WhatsApp & SMS Gateway' : 'Recharge Gateway';

            return (
              <div 
                key={provider._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {provider.providerName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 px-2 py-1 rounded-full w-fit">
                      <ShieldCheck className="w-3.5 h-3.5" /> API Connected
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                    <Server className="w-6 h-6 text-primary" />
                  </div>
                </div>

                {/* Balance Stats */}
                <div className="p-6 space-y-6 flex-1">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Live Gateway Balance</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-4xl font-mono font-bold tracking-tight ${isLowBalance ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        ₹{provider.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-slate-500 font-medium mb-1">{provider.currency}</span>
                    </div>
                    {isLowBalance && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mt-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg w-fit border border-red-100 dark:border-red-900/30">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Critical Low Balance (&lt; ₹400)!
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Clock className="w-4 h-4" />
                    Last synced: {formatDistanceToNow(new Date(provider.lastCheckedAt), { addSuffix: true })}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    onClick={() => handleSync(provider._id)}
                    disabled={isSyncing}
                    className="w-full"
                    size="lg"
                  >
                    {isSyncing ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing API...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-2" /> Sync Balance</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
