"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  useWhatsAppTemplates, 
  useSyncWhatsAppTemplates, 
  WhatsAppTemplateItem 
} from "@/hooks/useWhatsAppBusiness";
import { 
  RefreshCw, Search, Sparkles, Send, CheckCircle2, 
  Clock, Shield, Info, Check, MessageSquare, Layers, Copy 
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WhatsAppTemplatesPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState("ALL");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const { data: templates, isLoading } = useWhatsAppTemplates({
    search: search || undefined,
    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
    language: selectedLanguage !== "ALL" ? selectedLanguage : undefined,
  });

  const { mutate: syncTemplates, isPending: isSyncing } = useSyncWhatsAppTemplates();

  const handleSync = () => {
    syncTemplates(undefined, {
      onSuccess: (data) => {
        setToastMsg(data.message || "Synced templates from Fast2SMS.");
        setTimeout(() => setToastMsg(null), 3500);
      },
      onError: (err: any) => {
        setToastMsg(err?.response?.data?.message || err.message);
        setTimeout(() => setToastMsg(null), 4000);
      }
    });
  };

  const handleUseTemplate = (tpl: WhatsAppTemplateItem) => {
    router.push(`/dashboard/whatsapp/send?messageId=${tpl.messageId}`);
  };

  // Helper to substitute example values into template body for live card preview
  const renderTemplateWithExamples = (tpl: WhatsAppTemplateItem) => {
    if (!tpl.bodyText) return "";
    let text = tpl.bodyText;
    if (tpl.exampleValues && Array.isArray(tpl.exampleValues)) {
      tpl.exampleValues.forEach((exVal: string, idx: number) => {
        text = text.replace(new RegExp(`{{\\s*${idx + 1}\\s*}}`, 'g'), exVal);
      });
    }
    return text;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-500" /> WhatsApp Approved Templates
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Meta WABA approved notification templates synchronized directly from Fast2SMS.
          </p>
        </div>

        <Button 
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} /> 
          {isSyncing ? "Syncing Fast2SMS..." : "Sync Templates"}
        </Button>
      </div>

      {/* Search & Filters Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search templates by name or body text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
          />
        </div>

        <select
          className="w-full sm:w-48 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          <option value="UTILITY">Utility</option>
          <option value="AUTHENTICATION">Authentication</option>
          <option value="MARKETING">Marketing</option>
        </select>

        <select
          className="w-full sm:w-36 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 h-11"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
        >
          <option value="ALL">All Languages</option>
          <option value="en">English (en)</option>
          <option value="en_US">English US (en_US)</option>
          <option value="hi">Hindi (hi)</option>
        </select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No WhatsApp Templates Found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6 font-medium">
            No WhatsApp templates matched your search criteria. Click below to sync templates from Fast2SMS WABA.
          </p>
          <Button onClick={handleSync} disabled={isSyncing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl">
            Sync Templates Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 text-[10px] font-extrabold uppercase">
                      {tpl.category}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      {tpl.language}
                    </Badge>
                  </div>
                  <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {tpl.status}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                    {tpl.templateName}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Msg ID: {tpl.messageId} • Temp ID: {tpl.templateId}
                  </p>
                </div>

                {/* WhatsApp Chat Card Preview */}
                <div className="p-4 bg-[#efeae2] dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-slate-900 dark:text-white font-sans text-xs shadow-inner">
                  {tpl.headerText && (
                    <p className="font-bold text-slate-900 dark:text-slate-100">{tpl.headerText}</p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">
                    {renderTemplateWithExamples(tpl)}
                  </p>
                  {tpl.footerText && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">{tpl.footerText}</p>
                  )}
                </div>

                {tpl.varCount > 0 && (
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <span className="font-bold text-emerald-600">{tpl.varCount} Variable(s):</span>
                    <span className="font-mono text-slate-400">
                      {Array.from({ length: tpl.varCount }, (_, i) => `{{${i + 1}}}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400">
                  Synced {format(new Date(tpl.lastSyncedAt), 'MMM dd')}
                </span>
                <Button
                  onClick={() => handleUseTemplate(tpl)}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
