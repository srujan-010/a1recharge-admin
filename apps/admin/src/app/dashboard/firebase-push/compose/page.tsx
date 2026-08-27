"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSendPushNotification } from "@/hooks/useFirebasePush";
import { usePushTemplates, PushTemplate } from "@/hooks/usePushTemplates";
import { useRetailersList, Retailer } from "@/hooks/useRetailers";
import { 
  Send, Loader2, Image as ImageIcon, Link as LinkIcon, 
  AlertTriangle, Target, Clock, Settings2, Sparkles, X, Check, Star,
  Smartphone, Search, UserCheck, ShieldCheck, Info, CheckCircle2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Indian States & Major Districts Mapping for Filter UX
const INDIAN_STATES_DISTRICTS: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Kakinada", "Rajahmundry", "Tirupati"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Mahbubnagar", "Nalgonda"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Amravati", "Kolhapur"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Ballari"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Meerut", "Noida", "Ghaziabad", "Prayagraj"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Kharagpur"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur"]
};

function ComposePushContent() {
  const searchParams = useSearchParams();

  // Campaign Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [priority, setPriority] = useState("normal");
  const [ttl, setTtl] = useState("2419200"); // 4 weeks default

  // Audience & Targeting State
  const [audienceType, setAudienceType] = useState<"ALL" | "MULTIPLE" | "SINGLE">("ALL");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  
  // Single Retailer Search State
  const [retailerSearch, setRetailerSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);

  // Modals & UI State
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // API Hooks
  const { data: templates } = usePushTemplates({ search: templateSearch || undefined });
  const { mutate: sendPush, isPending } = useSendPushNotification();
  const { data: retailersData, isLoading: retailersLoading } = useRetailersList(
    1, 
    20, 
    retailerSearch, 
    'all', 
    'all'
  );

  // Districts based on selected state
  const availableDistricts = useMemo(() => {
    if (!stateFilter || !INDIAN_STATES_DISTRICTS[stateFilter]) return [];
    return INDIAN_STATES_DISTRICTS[stateFilter];
  }, [stateFilter]);

  // Reset district when state changes
  const handleStateChange = (val: string) => {
    setStateFilter(val);
    setDistrictFilter("");
  };

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
    setToast({ message: `Applied template "${tpl.name}"` });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setToast({ message: "Notification Title and Message Body are required.", isError: true });
      return;
    }

    if (audienceType === "SINGLE" && !selectedRetailer) {
      setToast({ message: "Please search and select a target retailer.", isError: true });
      return;
    }

    const recipientPayload = audienceType === "SINGLE" 
      ? [selectedRetailer!._id]
      : audienceType;

    sendPush({
      title: title.trim(),
      body: body.trim(),
      imageUrl: imageUrl.trim() || undefined,
      deepLink: deepLink || undefined,
      priority,
      recipients: recipientPayload,
      filters: (audienceType === 'ALL' || audienceType === 'MULTIPLE') ? {
        state: stateFilter || undefined,
        district: districtFilter || undefined,
        kycStatus: kycStatus || undefined,
      } : undefined
    }, {
      onSuccess: (data) => {
        setToast({ message: data.message || "Push notification dispatched successfully." });
        setTitle("");
        setBody("");
        setImageUrl("");
        setDeepLink("");
        setSelectedRetailer(null);
        setRetailerSearch("");
        setTimeout(() => setToast(null), 4000);
      },
      onError: (err: any) => {
        setToast({ message: err?.response?.data?.message || err.message || "Failed to dispatch campaign.", isError: true });
        setTimeout(() => setToast(null), 5000);
      }
    });
  };

  return (
    <div className="max-w-7xl space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          toast.isError ? 'bg-rose-950 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          {toast.isError ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Target Audience & Delivery Settings (4 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Target Audience */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" /> Target Audience
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Select who should receive this notification.</p>
            </div>
            
            {/* Audience Type Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Audience Scope</label>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'ALL', label: 'All Retailers', desc: 'Broadcast to all active devices' },
                  { id: 'MULTIPLE', label: 'Targeted Segment', desc: 'Filter by State, District & KYC' },
                  { id: 'SINGLE', label: 'Single Retailer', desc: 'Search and target a specific retailer' },
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      audienceType === opt.id
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/10 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audienceType"
                      value={opt.id}
                      checked={audienceType === opt.id}
                      onChange={() => setAudienceType(opt.id as any)}
                      className="mt-0.5 text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Targeted Segment Filters */}
            {(audienceType === 'ALL' || audienceType === 'MULTIPLE') && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  {audienceType === 'MULTIPLE' ? 'Segment Filters (Required)' : 'Optional Demographic Filters'}
                </p>
                
                {/* State Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">State</label>
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={stateFilter}
                    onChange={(e) => handleStateChange(e.target.value)}
                  >
                    <option value="">All States</option>
                    {Object.keys(INDIAN_STATES_DISTRICTS).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* District Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">District</label>
                  <select
                    disabled={!stateFilter || availableDistricts.length === 0}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  >
                    <option value="">{stateFilter ? 'All Districts' : 'Select State First'}</option>
                    {availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* KYC Status Select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">KYC Status</label>
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
              </div>
            )}

            {/* Single Retailer Selection */}
            {audienceType === 'SINGLE' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Search Retailer</p>
                
                {selectedRetailer ? (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {selectedRetailer.name || selectedRetailer.phone}
                        <Badge className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0">SELECTED</Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {selectedRetailer.phone} • {selectedRetailer.retailerId}
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setSelectedRetailer(null)} 
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 relative">
                    <Input
                      type="text"
                      placeholder="Search name, phone, or retailer ID..."
                      value={retailerSearch}
                      onChange={(e) => setRetailerSearch(e.target.value)}
                      className="h-10 text-xs bg-white dark:bg-slate-900"
                    />

                    {retailersLoading && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 py-1"><Loader2 className="w-3 h-3 animate-spin text-orange-500" /> Searching retailers...</div>
                    )}

                    {retailersData?.data && retailersData.data.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-lg">
                        {retailersData.data.map(r => (
                          <div
                            key={r._id}
                            onClick={() => setSelectedRetailer(r)}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">{r.name || r.phone}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r.phone} ({r.retailerId})</div>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              r.fcmToken ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}>
                              {r.fcmToken ? 'Registered' : 'No Token'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Delivery Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-slate-400" /> Delivery Settings
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Configure priority & expiration rules for FCM.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Delivery Priority</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="normal">Normal — Respects Android Doze Mode</option>
                  <option value="high">High — Immediate wake & dispatch</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Time to Live (TTL)</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                >
                  <option value="2419200">4 Weeks (Maximum storage)</option>
                  <option value="86400">24 Hours</option>
                  <option value="3600">1 Hour</option>
                  <option value="0">0 (Deliver immediately or discard)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Creative, Preview & Dispatch (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Campaign Creative */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6">
            
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-500" /> Campaign Creative
                </h2>
                <p className="text-xs text-slate-500 font-medium">Compose the notification content to be displayed on retailer devices.</p>
              </div>

              {/* SINGLE CHOOSE TEMPLATE BUTTON */}
              <Button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                variant="outline"
                className="gap-2 h-10 px-4 rounded-xl border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-500/10 hover:bg-orange-100 font-bold text-xs shadow-sm shrink-0"
              >
                <Sparkles className="w-4 h-4 text-orange-500" /> Choose Template
              </Button>
            </div>

            <div className="space-y-5">
              {/* Title Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Notification Title *</label>
                  <span className="text-[10px] font-bold text-slate-400">{title.length}/65</span>
                </div>
                <Input 
                  type="text" 
                  required
                  maxLength={65}
                  placeholder="e.g. 🎉 Mega Commission Boost Active Today!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-bold h-12 text-base bg-slate-50 dark:bg-slate-950"
                />
              </div>

              {/* Message Body Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">Message Body *</label>
                  <span className="text-[10px] font-bold text-slate-400">{body.length}/240</span>
                </div>
                <textarea 
                  required
                  rows={3}
                  maxLength={240}
                  placeholder="Recharge now and enjoy great savings on your next transaction."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow resize-none"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Banner Image URL & Deep Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Banner Image URL
                    </label>
                    {imageUrl && (
                      <button type="button" onClick={() => setImageUrl("")} className="text-[10px] text-rose-500 font-bold hover:underline">Clear</button>
                    )}
                  </div>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/banner.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-11 text-xs bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <LinkIcon className="w-3.5 h-3.5" /> Open when tapped
                  </label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 h-11"
                    value={deepLink}
                    onChange={(e) => setDeepLink(e.target.value)}
                  >
                    <option value="">No Deep Link (Open App Main Screen)</option>
                    <option value="/wallet">Open Wallet (/wallet)</option>
                    <option value="/history">Open Transaction History (/history)</option>
                    <option value="/kyc">Open KYC Details (/kyc)</option>
                    <option value="/support">Open Support Center (/support)</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Notification Live Preview */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-orange-400" /> Notification Lockscreen Preview
              </h3>
              <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold">
                Live Preview
              </Badge>
            </div>

            {/* Mobile Push Notification Mock */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center text-white text-[10px] font-black">
                    A1
                  </div>
                  <span className="text-xs font-bold text-slate-200">A1 Recharge</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">now</span>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-extrabold text-white">
                  {title || "Notification Title"}
                </div>
                <div className="text-xs text-slate-300 font-medium line-clamp-2">
                  {body || "Message body will appear here on retailer device..."}
                </div>
              </div>

              {imageUrl && (
                <div className="rounded-xl overflow-hidden h-32 bg-slate-950 border border-slate-700">
                  <img src={imageUrl} alt="Banner Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}

              {deepLink && (
                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-orange-400 font-bold">
                  <span>Action: Opens {deepLink}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Send Campaign Action */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">Ready to dispatch campaign?</p>
              <p className="text-[11px] text-slate-500 font-medium">
                {audienceType === 'SINGLE' 
                  ? (selectedRetailer ? `Targeting 1 retailer: ${selectedRetailer.name || selectedRetailer.phone}` : 'Please select a retailer')
                  : 'Targeting registered active devices'}
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending || !title.trim() || !body.trim() || (audienceType === 'SINGLE' && !selectedRetailer)}
              className="bg-orange-500 hover:bg-orange-600 text-white h-12 px-8 rounded-xl text-sm font-black shadow-lg shadow-orange-500/20 transition-all shrink-0"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {isPending ? "Sending Campaign..." : "Send Campaign"}
            </Button>
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
                  No push templates found. Create templates in the Templates tab.
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
