"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  usePushTemplates, 
  useCreateTemplate, 
  useUpdateTemplate, 
  useDeleteTemplate, 
  useToggleFavoriteTemplate, 
  useDuplicateTemplate,
  PushTemplate
} from "@/hooks/usePushTemplates";

import { 
  Plus, Search, Star, Copy, Trash2, Edit3, Eye, Send, Loader2, 
  Sparkles, Filter, Tag, Check, Image as ImageIcon, Link as LinkIcon, 
  AlertTriangle, Shield, Clock, Smartphone, Info, X, Zap
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { id: 'ALL', label: 'All Templates' },
  { id: 'RECHARGE', label: 'Recharge' },
  { id: 'WALLET', label: 'Wallet' },
  { id: 'OFFERS', label: 'Offers' },
  { id: 'FESTIVAL', label: 'Festival' },
  { id: 'KYC', label: 'KYC' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'SYSTEM', label: 'System' },
  { id: 'PROMOTION', label: 'Promotion' },
  { id: 'ANNOUNCEMENT', label: 'Announcement' },
  { id: 'CUSTOM', label: 'Custom' },
];

export default function TemplatesPage() {
  const router = useRouter();

  // State filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "SYSTEM" | "CUSTOM">("ALL");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PushTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PushTemplate | null>(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<PushTemplate | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sample Data for Live Android Preview
  const [sampleName, setSampleName] = useState("Srujan");
  const [sampleAmount, setSampleAmount] = useState("199");
  const [sampleOperator, setSampleOperator] = useState("Jio");
  const [sampleNumber, setSampleNumber] = useState("9876543210");

  const renderSamplePreview = (templateText: string, vars: Record<string, string>) => {
    if (!templateText) return "";
    const now = new Date();
    const sampleCtx: Record<string, string> = {
      name: vars.name || "Srujan",
      retailer: vars.name || "Srujan",
      retailerId: "RET8921",
      amount: vars.amount || "199",
      operator: vars.operator || "Jio",
      number: vars.number || "9876543210",
      mobile: vars.number || "9876543210",
      balance: "1250",
      newBalance: "1250",
      currentBalance: "1250",
      transactionId: "TXN778921",
      orderId: "TXN778921",
      reason: "Service Deposit",
      date: now.toLocaleDateString("en-IN"),
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      appName: "A1 Recharge",
      device: "Android Device",
      ip: "103.22.45.12",
    };

    return templateText.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      return sampleCtx[key] !== undefined ? sampleCtx[key] : "";
    }).replace(/  +/g, " ").trim();
  };

  // Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("RECHARGE");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formBannerImage, setFormBannerImage] = useState("");
  const [formDeepLink, setFormDeepLink] = useState("");
  const [formPriority, setFormPriority] = useState<"high" | "normal">("normal");
  const [formTtl, setFormTtl] = useState(2419200);
  const [formTags, setFormTags] = useState("");
  const [formIsFavorite, setFormIsFavorite] = useState(false);

  // React Query Hooks
  const { data: templates, isLoading, refetch } = usePushTemplates({
    search: search || undefined,
    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
    isFavorite: showFavoritesOnly || undefined,
    isSystemTemplate: filterType === "SYSTEM" ? true : filterType === "CUSTOM" ? false : undefined,
  });

  const { mutate: createTemplate, isPending: isCreating } = useCreateTemplate();
  const { mutate: updateTemplate, isPending: isUpdating } = useUpdateTemplate();
  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteTemplate();
  const { mutate: toggleFavorite } = useToggleFavoriteTemplate();
  const { mutate: duplicateTemplate, isPending: isDuplicating } = useDuplicateTemplate();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Variable Detector
  const detectedVariables = useMemo(() => {
    const text = `${formTitle} ${formBody}`;
    const matches = text.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/{{\s*|\s*}}/g, ''))));
  }, [formTitle, formBody]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormCategory("RECHARGE");
    setFormTitle("");
    setFormBody("");
    setFormBannerImage("");
    setFormDeepLink("");
    setFormPriority("normal");
    setFormTtl(2419200);
    setFormTags("");
    setFormIsFavorite(false);
    setIsFormOpen(true);
  };

  const openEditModal = (tpl: PushTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormTitle(tpl.title);
    setFormBody(tpl.body);
    setFormBannerImage(tpl.bannerImage || "");
    setFormDeepLink(tpl.deepLink || "");
    setFormPriority(tpl.priority || "normal");
    setFormTtl(tpl.ttl || 2419200);
    setFormTags(tpl.tags ? tpl.tags.join(", ") : "");
    setFormIsFavorite(tpl.isFavorite);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formTitle || !formBody) return;

    const payload = {
      name: formName,
      category: formCategory,
      title: formTitle,
      body: formBody,
      bannerImage: formBannerImage || null,
      deepLink: formDeepLink || null,
      priority: formPriority,
      ttl: Number(formTtl),
      tags: formTags ? formTags.split(",").map(t => t.trim()).filter(Boolean) : [],
      isFavorite: formIsFavorite,
    };

    if (editingTemplate) {
      updateTemplate({ id: editingTemplate._id, payload }, {
        onSuccess: () => {
          showToast("Push notification template updated.");
          setIsFormOpen(false);
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || err.message);
        }
      });
    } else {
      createTemplate(payload, {
        onSuccess: () => {
          showToast("New push notification template created.");
          setIsFormOpen(false);
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || err.message);
        }
      });
    }
  };

  const handleToggleFavorite = (tpl: PushTemplate) => {
    toggleFavorite(tpl._id, {
      onSuccess: (res) => {
        showToast(res.message);
      }
    });
  };

  const handleDuplicate = (tpl: PushTemplate) => {
    duplicateTemplate(tpl._id, {
      onSuccess: () => {
        showToast(`Cloned template "${tpl.name} (Copy)" created.`);
      }
    });
  };

  const handleDelete = () => {
    if (!deleteConfirmTemplate) return;
    deleteTemplate(deleteConfirmTemplate._id, {
      onSuccess: () => {
        showToast("Template deleted.");
        setDeleteConfirmTemplate(null);
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message);
        setDeleteConfirmTemplate(null);
      }
    });
  };

  const handleUseTemplate = (tpl: PushTemplate) => {
    // Navigate to Compose tab with pre-filled state via query params or session storage
    const params = new URLSearchParams({
      templateId: tpl._id,
      title: tpl.title,
      body: tpl.body,
      imageUrl: tpl.bannerImage || "",
      deepLink: tpl.deepLink || "",
      priority: tpl.priority || "normal",
    });
    router.push(`/dashboard/firebase-push/compose?${params.toString()}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
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
            <Sparkles className="w-6 h-6 text-orange-500" /> Push Notification Templates
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Create, manage, and dynamically bind push notification templates for manual campaigns and automated business events.
          </p>
        </div>

        <Button 
          onClick={openCreateModal}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Create New Template
        </Button>
      </div>

      {/* Search & Filters Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input 
              type="text"
              placeholder="Search templates by name, title, body, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
            />
          </div>

          {/* Filter Type Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex-1 sm:flex-initial ${filterType === "ALL" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType("SYSTEM")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex-1 sm:flex-initial ${filterType === "SYSTEM" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"}`}
            >
              System Defaults
            </button>
            <button
              onClick={() => setFilterType("CUSTOM")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex-1 sm:flex-initial ${filterType === "CUSTOM" ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm" : "text-slate-500"}`}
            >
              Custom
            </button>
          </div>

          {/* Favorite Only Button */}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`h-11 px-4 gap-2 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 ${showFavoritesOnly ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? "fill-white" : "text-amber-500"}`} />
            Favorites
          </Button>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Templates Found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6 font-medium">
            No notification templates match your search or filter criteria. Create your first custom template now!
          </p>
          <Button onClick={openCreateModal} className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 px-6 rounded-xl">
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Card Top Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5">
                      {tpl.category}
                    </Badge>
                    {tpl.isSystemTemplate && (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 text-[10px] font-bold px-2 py-0.5">
                        System Default
                      </Badge>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleFavorite(tpl)}
                    className="text-slate-400 hover:text-amber-500 transition-colors p-1"
                    title={tpl.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Star className={`w-4 h-4 ${tpl.isFavorite ? "text-amber-500 fill-amber-500" : ""}`} />
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug group-hover:text-orange-500 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                    Used {tpl.usageCount || 0} times • Added {format(new Date(tpl.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>

                {/* Preview Box */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {tpl.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {tpl.body}
                  </p>
                </div>

                {/* Variables pills */}
                {tpl.variables && tpl.variables.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vars:</span>
                    {tpl.variables.map((v) => (
                      <span key={v} className="text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {/* Android Preview */}
                  <button
                    onClick={() => setPreviewTemplate(tpl)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Preview Android Notification"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    disabled={isDuplicating}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Duplicate Template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEditModal(tpl)}
                    className="p-2 text-slate-400 hover:text-orange-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Template"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  {!tpl.isSystemTemplate && (
                    <button
                      onClick={() => setDeleteConfirmTemplate(tpl)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Button
                  onClick={() => handleUseTemplate(tpl)}
                  size="sm"
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-orange-500 dark:hover:bg-orange-500 dark:hover:text-white font-bold text-xs h-9 px-3 rounded-lg transition-colors gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 my-8 relative">
            
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {editingTemplate ? "Edit Template" : "Create Push Template"}
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Design reusable push notification presets with dynamic variable placeholders.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Template Name *</label>
                  <Input 
                    type="text" 
                    required
                    placeholder="e.g. Recharge Success Notification"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-11 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Category *</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 h-11"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Notification Title *</span>
                  <span className={formTitle.length > 65 ? "text-red-500" : "text-slate-400"}>{formTitle.length}/65</span>
                </label>
                <Input 
                  type="text" 
                  required
                  maxLength={65}
                  placeholder="e.g. Recharge Successful 🎉"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="h-12 font-bold text-base"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Message Body *</span>
                  <span className={formBody.length > 240 ? "text-red-500" : "text-slate-400"}>{formBody.length}/240</span>
                </label>
                <textarea 
                  required
                  rows={3}
                  maxLength={240}
                  placeholder="e.g. Your recharge of ₹{{amount}} for {{mobile}} was successful."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow resize-none"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                />
              </div>

              {/* Detected Variables Pill Box */}
              {detectedVariables.length > 0 && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 mr-2">Detected Variables:</span>
                    {detectedVariables.map(v => (
                      <span key={v} className="inline-block bg-white dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 font-mono text-[11px] px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 mr-1.5">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Banner Image URL
                  </label>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/banner.jpg"
                    value={formBannerImage}
                    onChange={(e) => setFormBannerImage(e.target.value)}
                    className="h-11 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Deep Link Action
                  </label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 h-11"
                    value={formDeepLink}
                    onChange={(e) => setFormDeepLink(e.target.value)}
                  >
                    <option value="">None (Open Main App)</option>
                    <option value="/wallet">Wallet Page (/wallet)</option>
                    <option value="/history">Transaction History (/history)</option>
                    <option value="/kyc">KYC Details (/kyc)</option>
                    <option value="/support">Support Center (/support)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Priority</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 h-11"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                  >
                    <option value="normal">Normal (Standard Delivery)</option>
                    <option value="high">High (Immediate Wake)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Tags (Comma Separated)</label>
                  <Input 
                    type="text" 
                    placeholder="recharge, success, automated"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="h-11 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="form-is-favorite"
                  checked={formIsFavorite}
                  onChange={(e) => setFormIsFavorite(e.target.checked)}
                  className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="form-is-favorite" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Mark as Favorite Template ⭐
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="h-11 px-5 rounded-xl font-bold">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 px-7 rounded-xl shadow-lg shadow-orange-500/25"
                >
                  {isCreating || isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANDROID NOTIFICATION PREVIEW MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 relative overflow-hidden">
            
            <button 
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                Android System Preview
              </Badge>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Push Preview</h3>
            </div>

            {/* Android Device Notification Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 space-y-3 font-sans">
              
              {/* App Status Header */}
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center text-white font-bold text-[10px]">
                    A1
                  </div>
                  <span className="font-bold text-slate-200">A1 Recharge</span>
                  <span>•</span>
                  <span>Just now</span>
                </div>
                <Smartphone className="w-3.5 h-3.5" />
              </div>

              {/* Sample Data Live Controls */}
              <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Sample Data Context</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    type="text" 
                    placeholder="Name" 
                    value={sampleName} 
                    onChange={(e) => setSampleName(e.target.value)} 
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                  <Input 
                    type="text" 
                    placeholder="Amount" 
                    value={sampleAmount} 
                    onChange={(e) => setSampleAmount(e.target.value)} 
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                  <Input 
                    type="text" 
                    placeholder="Operator" 
                    value={sampleOperator} 
                    onChange={(e) => setSampleOperator(e.target.value)} 
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                  <Input 
                    type="text" 
                    placeholder="Mobile Number" 
                    value={sampleNumber} 
                    onChange={(e) => setSampleNumber(e.target.value)} 
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Title & Body */}
              <div className="space-y-1 text-left">
                <h4 className="text-sm font-bold text-white leading-snug">
                  {renderSamplePreview(previewTemplate.title, { name: sampleName, amount: sampleAmount, operator: sampleOperator, number: sampleNumber })}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {renderSamplePreview(previewTemplate.body, { name: sampleName, amount: sampleAmount, operator: sampleOperator, number: sampleNumber })}
                </p>
              </div>

              {/* Banner Image Preview */}
              {previewTemplate.bannerImage && (
                <div className="rounded-lg overflow-hidden h-32 bg-slate-800 border border-slate-700">
                  <img src={previewTemplate.bannerImage} alt="Banner" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Deep Link Action Footer */}
              {previewTemplate.deepLink && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-orange-400 font-semibold">
                  <span>Action Route: {previewTemplate.deepLink}</span>
                  <Send className="w-3 h-3" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setPreviewTemplate(null)}
                className="w-full h-11 rounded-xl font-bold"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SOFT DELETE CONFIRMATION MODAL */}
      {deleteConfirmTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 text-center">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete Template?</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirmTemplate.name}"</span>? This will perform a soft deletion.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirmTemplate(null)} 
                className="h-11 px-6 rounded-xl font-bold flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-xl flex-1 shadow-lg shadow-red-600/20"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
