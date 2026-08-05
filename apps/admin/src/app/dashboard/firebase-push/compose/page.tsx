"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSendPushNotification } from "@/hooks/useFirebasePush";
import { usePushTemplates, PushTemplate } from "@/hooks/usePushTemplates";
import { 
  Send, Loader2, Image as ImageIcon, Link as LinkIcon, 
  AlertTriangle, Target, Clock, Settings2, Sparkles, X, Check, Star 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function ComposePushContent() {
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [priority, setPriority] = useState("normal");
  const [recipients, setRecipients] = useState("ALL");
  
  // Advanced filters
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [ttl, setTtl] = useState("2419200"); // 4 weeks default

  const [toast, setToast] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const { data: templates } = usePushTemplates({ search: templateSearch || undefined });
  const { mutate: sendPush, isPending } = useSendPushNotification();

  // Populate from query params if navigated from Templates page
  useEffect(() => {
    const paramTitle = searchParams.get("title");
    const paramBody = searchParams.get("body");
    const paramImage = searchParams.get("imageUrl");
    const paramRoute = searchParams.get("deepLink");
    const paramPriority = searchParams.get("priority");

    if (paramTitle) setTitle(paramTitle);
    if (paramBody) setBody(paramBody);
    if (paramImage) setImageUrl(paramImage);
    if (paramRoute) setDeepLink(paramRoute);
    if (paramPriority) setPriority(paramPriority);
  }, [searchParams]);

  const applyTemplate = (tpl: PushTemplate) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setImageUrl(tpl.bannerImage || "");
    setDeepLink(tpl.deepLink || "");
    setPriority(tpl.priority || "normal");
    if (tpl.ttl) setTtl(String(tpl.ttl));
    setIsTemplateModalOpen(false);
    setToast(`Applied template "${tpl.name}"`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    
    sendPush({
      title,
      body,
      imageUrl,
      deepLink,
      priority,
      recipients,
      filters: (recipients === 'ALL' || recipients === 'MULTIPLE') ? {
        state: stateFilter || undefined,
        district: districtFilter || undefined,
        kycStatus: kycStatus || undefined,
      } : undefined
    }, {
      onSuccess: (data) => {
        setToast(data.message || "Push notification dispatched successfully.");
        setTitle("");
        setBody("");
        setImageUrl("");
        setDeepLink("");
        setTimeout(() => setToast(null), 3000);
      },
      onError: (err: any) => {
        setToast(err?.response?.data?.message || err.message);
        setTimeout(() => setToast(null), 4000);
      }
    });
  };

  return (
    <div className="max-w-5xl space-y-6 animate-in fade-in duration-500">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Targeting & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-orange-500" /> Target Audience
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Recipients</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                >
                  <option value="ALL">All Retailers</option>
                  <option value="MULTIPLE">Targeted Segment</option>
                  <option value="SINGLE" disabled>Single Retailer (Use Device Tokens tab)</option>
                </select>
              </div>

              {(recipients === 'ALL' || recipients === 'MULTIPLE') && (
                <div className="p-4 bg-orange-50 dark:bg-orange-500/5 rounded-xl border border-orange-100 dark:border-orange-500/10 space-y-3">
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-2">Advanced Filters</p>
                  
                  <Input 
                    type="text" 
                    placeholder="State (e.g. Maharashtra)" 
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="h-10 text-xs bg-white dark:bg-slate-900"
                  />
                  <Input 
                    type="text" 
                    placeholder="District (e.g. Mumbai)" 
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="h-10 text-xs bg-white dark:bg-slate-900"
                  />
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={kycStatus}
                    onChange={(e) => setKycStatus(e.target.value)}
                  >
                    <option value="">Any KYC Status</option>
                    <option value="verified">KYC Verified</option>
                    <option value="pending">KYC Pending</option>
                    <option value="rejected">KYC Rejected</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Settings2 className="w-5 h-5 text-slate-400" /> Delivery Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Priority
                </label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="normal">Normal (Respects Doze Mode)</option>
                  <option value="high">High (Immediate Wake)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time to Live (TTL)
                </label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                >
                  <option value="2419200">4 Weeks (Maximum)</option>
                  <option value="86400">24 Hours</option>
                  <option value="3600">1 Hour</option>
                  <option value="0">0 (Deliver immediately or discard)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Creative / Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            
            <div className="flex items-center justify-between gap-4 mb-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Campaign Creative
              </h2>

              {/* CHOOSE TEMPLATE BUTTON */}
              <Button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                variant="outline"
                className="gap-2 h-10 px-4 rounded-xl border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-500/10 hover:bg-orange-100 font-bold text-xs shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-orange-500" /> Choose Template
              </Button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 block">Notification Title *</label>
                <Input 
                  type="text" 
                  required
                  maxLength={65}
                  placeholder="e.g. 🎉 Mega Festival Offer is here!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-bold h-14 text-lg"
                />
                <div className="text-right mt-1 text-[10px] font-medium text-slate-400">{title.length}/65</div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 block">Message Body *</label>
                <textarea 
                  required
                  rows={4}
                  maxLength={240}
                  placeholder="Tap to claim your guaranteed cashback up to ₹500 today!"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 text-[15px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow resize-none"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="text-right mt-1 text-[10px] font-medium text-slate-400">{body.length}/240</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Banner Image URL
                  </label>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/banner.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-12"
                  />
                  {imageUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-24 bg-slate-100 dark:bg-slate-800 relative">
                      <img src={imageUrl} alt="Banner Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Deep Link Action
                  </label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow h-12"
                    value={deepLink}
                    onChange={(e) => setDeepLink(e.target.value)}
                  >
                    <option value="">None (Open App Main Screen)</option>
                    <option value="/wallet">Wallet Page (/wallet)</option>
                    <option value="/history">Transaction History (/history)</option>
                    <option value="/kyc">KYC Details (/kyc)</option>
                    <option value="/support">Support Center (/support)</option>
                  </select>
                </div>
              </div>

            </div>

            <div className="pt-8 mt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => setIsTemplateModalOpen(true)} className="h-12 px-6 rounded-xl font-bold">
                Choose Template
              </Button>
              <Button
                type="submit"
                disabled={isPending || !title || !body}
                className="bg-orange-500 hover:bg-orange-600 text-white h-14 px-10 rounded-xl text-[16px] font-black shadow-xl shadow-orange-500/25 transition-all active:scale-95"
              >
                {isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                Send Campaign
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* CHOOSE TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 max-h-[85vh] flex flex-col relative">
            
            <button 
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" /> Select Notification Template
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Choose a saved template to automatically pre-fill your campaign creative.
              </p>
            </div>

            <Input 
              type="text"
              placeholder="Filter templates..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="h-10 text-xs"
            />

            <div className="overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
              {!templates || templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-medium">
                  No push templates found.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    onClick={() => applyTemplate(tpl)}
                    className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 dark:hover:border-orange-500 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200">
                          {tpl.category}
                        </Badge>
                        <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                          {tpl.name}
                        </span>
                        {tpl.isFavorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {tpl.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {tpl.body}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0"
                    >
                      Apply
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)} className="h-10 px-5 rounded-xl font-bold">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComposePushPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-slate-400 font-medium">
        Loading Push Composer...
      </div>
    }>
      <ComposePushContent />
    </Suspense>
  );
}
