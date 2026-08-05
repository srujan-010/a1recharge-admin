"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  useWhatsAppTemplates, 
  useSyncWhatsAppTemplates, 
  useCreateWhatsAppTemplate,
  useUpdateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  useDuplicateWhatsAppTemplate,
  WhatsAppTemplateItem 
} from "@/hooks/useWhatsAppBusiness";
import { 
  RefreshCw, Search, Sparkles, Send, CheckCircle2, 
  MessageSquare, Check, Loader2, Plus, Edit3, Trash2, Copy, Eye, X, 
  FileText, Image as ImageIcon, MapPin, ShoppingBag, Layers, Percent, ArrowRight, CheckCheck, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Fast2SMSTemplatesPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplateItem | null>(null);
  const [editTemplate, setEditTemplate] = useState<WhatsAppTemplateItem | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  // Wizard Form state
  const [formType, setFormType] = useState<string>("TEXT");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("UTILITY");
  const [formLanguage, setFormLanguage] = useState("en_US");
  const [formHeaderType, setFormHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("NONE");
  const [formHeaderText, setFormHeaderText] = useState("");
  const [formBodyText, setFormBodyText] = useState("");
  const [formFooterText, setFormFooterText] = useState("");
  const [formButtons, setFormButtons] = useState<Array<{ type: string; text: string; url?: string; phoneNumber?: string }>>([]);
  const [exampleInputs, setExampleInputs] = useState<Record<string, string>>({});

  const { data: templates, isLoading } = useWhatsAppTemplates({
    search: search || undefined,
    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
    language: selectedLanguage !== "ALL" ? selectedLanguage : undefined,
    status: selectedStatus !== "ALL" ? selectedStatus : undefined,
  });

  const { mutate: syncTemplates, isPending: isSyncing } = useSyncWhatsAppTemplates();
  const { mutate: createTemplate, isPending: isCreating } = useCreateWhatsAppTemplate();
  const { mutate: updateTemplate, isPending: isUpdating } = useUpdateWhatsAppTemplate();
  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteWhatsAppTemplate();
  const { mutate: duplicateTemplate, isPending: isDuplicating } = useDuplicateWhatsAppTemplate();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Automatic variable detection from body text
  const detectedVariables = useMemo(() => {
    if (!formBodyText) return [];
    const matches = formBodyText.match(/{{\s*\d+\s*}}/g) || [];
    const unique = [...new Set(matches.map(m => m.replace(/\D/g, '')))];
    return unique.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [formBodyText]);

  // Live rendered body text for wizard preview
  const livePreviewBody = useMemo(() => {
    if (!formBodyText) return "";
    let text = formBodyText;
    detectedVariables.forEach(varNum => {
      const val = exampleInputs[`var_${varNum}`] || `{{${varNum}}}`;
      text = text.replace(new RegExp(`{{\\s*${varNum}\\s*}}`, 'g'), val);
    });
    return text;
  }, [formBodyText, detectedVariables, exampleInputs]);

  // Reset wizard form
  const resetWizard = () => {
    setWizardStep(1);
    setFormType("TEXT");
    setFormName("");
    setFormCategory("UTILITY");
    setFormLanguage("en_US");
    setFormHeaderType("NONE");
    setFormHeaderText("");
    setFormBodyText("");
    setFormFooterText("");
    setFormButtons([]);
    setExampleInputs({});
    setIsWizardOpen(false);
  };

  // Handle Wizard Submit
  const handleWizardSubmit = () => {
    if (!formName || !formBodyText) {
      showToast("Template Name and Body Text are required.");
      return;
    }

    const exVals: string[] = detectedVariables.map(v => exampleInputs[`var_${v}`] || `Sample ${v}`);

    createTemplate({
      templateName: formName,
      category: formCategory,
      language: formLanguage,
      templateType: formType,
      headerText: formHeaderType === 'TEXT' ? formHeaderText : undefined,
      bodyText: formBodyText,
      footerText: formFooterText || undefined,
      buttons: formButtons,
      mediaType: (formHeaderType === 'IMAGE' || formHeaderType === 'VIDEO' || formHeaderType === 'DOCUMENT') ? formHeaderType : 'NONE',
      exampleValues: exVals,
    }, {
      onSuccess: (res) => {
        showToast(res.message || `Template "${formName}" created successfully.`);
        resetWizard();
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message);
      }
    });
  };

  // Handle Delete
  const handleConfirmDelete = () => {
    if (!deleteTemplateId) return;
    deleteTemplate(deleteTemplateId, {
      onSuccess: (res) => {
        showToast(res.message || "Template deleted successfully.");
        setDeleteTemplateId(null);
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message);
      }
    });
  };

  // Handle Duplicate
  const handleDuplicate = (tpl: WhatsAppTemplateItem) => {
    duplicateTemplate(tpl._id, {
      onSuccess: (res) => {
        showToast(res.message || `Duplicated as "${res.data?.templateName}".`);
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || err.message);
      }
    });
  };

  // Helper to render template body with example values
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

  const templateTypesList = [
    { id: 'TEXT', title: 'Text Template', desc: 'Standard text notification message with dynamic variables', icon: FileText },
    { id: 'MEDIA', title: 'Media Template', desc: 'Header image, video, or PDF document file', icon: ImageIcon },
    { id: 'CTA', title: 'Call To Action (CTA)', desc: 'Interactive URL link and phone call buttons', icon: ArrowRight },
    { id: 'LOCATION', title: 'Location Template', desc: 'Share address or live geolocation coordinates', icon: MapPin },
    { id: 'COUPON', title: 'Coupon Code', desc: 'Promotional discount coupon code with copy CTA', icon: Percent },
    { id: 'CATALOG', title: 'Catalog Template', desc: 'E-commerce product catalog showcase', icon: ShoppingBag },
    { id: 'CAROUSEL', title: 'Carousel Template', desc: 'Multi-card swappable product carousel', icon: Layers },
    { id: 'FLOW', title: 'Flows Template', desc: 'Interactive Meta WhatsApp form flow', icon: Sparkles },
  ];

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
            <Sparkles className="w-6 h-6 text-indigo-600" /> WhatsApp Template Management
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Meta WABA approved notification templates synchronized directly from Fast2SMS Cloud API.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button 
            onClick={() => syncTemplates()}
            disabled={isSyncing}
            variant="outline"
            className="h-11 px-5 rounded-xl font-bold text-xs gap-2 border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} /> 
            {isSyncing ? "Syncing Fast2SMS..." : "Sync Templates"}
          </Button>

          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-600/20 text-xs gap-2"
          >
            <Plus className="w-4 h-4" /> Create WhatsApp Template
          </Button>
        </div>
      </div>

      {/* Search & Filters Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search templates by name, body text, or message ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
          />
        </div>

        <select
          className="w-full sm:w-44 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          <option value="UTILITY">Utility</option>
          <option value="AUTHENTICATION">Authentication</option>
          <option value="MARKETING">Marketing</option>
        </select>

        <select
          className="w-full sm:w-36 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
        >
          <option value="ALL">All Languages</option>
          <option value="en">English (en)</option>
          <option value="en_US">English US (en_US)</option>
          <option value="hi">Hindi (hi)</option>
          <option value="te">Telugu (te)</option>
        </select>

        <select
          className="w-full sm:w-36 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Templates Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-4">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No WhatsApp Templates Found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6 font-medium">
            No templates matched your search criteria. Click below to create a new template or sync from Fast2SMS.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => setIsWizardOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl text-xs">
              Create WhatsApp Template
            </Button>
            <Button onClick={() => syncTemplates()} disabled={isSyncing} variant="outline" className="h-11 px-6 rounded-xl font-bold text-xs">
              Sync Templates
            </Button>
          </div>
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
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 text-[10px] font-extrabold uppercase">
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
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
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
                    <span className="font-bold text-indigo-600">{tpl.varCount} Variable(s):</span>
                    <span className="font-mono text-slate-400">
                      {Array.from({ length: tpl.varCount }, (_, i) => `{{${i + 1}}}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setPreviewTemplate(tpl)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
                    title="Preview Meta Card"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDuplicate(tpl)}
                    disabled={isDuplicating}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
                    title="Duplicate Template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteTemplateId(tpl._id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" 
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  onClick={() => router.push(`/dashboard/fast2sms/send?messageId=${tpl.messageId}`)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================== */}
      {/* 4-STEP TEMPLATE CREATION WIZARD MODAL */}
      {/* =================================================== */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] flex flex-col relative">
            
            <button 
              onClick={resetWizard}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Wizard Header & Progress Bar */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  {wizardStep}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Create WhatsApp Template Wizard
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {wizardStep === 1 && "Step 1: Choose Template Type"}
                    {wizardStep === 2 && "Step 2: Fill Template Details & Dynamic Variables"}
                    {wizardStep === 3 && "Step 3: WhatsApp Meta Live Phone Preview"}
                    {wizardStep === 4 && "Step 4: Confirm & Submit to Fast2SMS"}
                  </p>
                </div>
              </div>

              {/* Progress Steps Indicator */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((stepNum) => (
                  <div 
                    key={stepNum}
                    className={`h-2 rounded-full transition-all ${
                      wizardStep >= stepNum ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: CHOOSE TEMPLATE TYPE */}
            {wizardStep === 1 && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select WhatsApp Template Type
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {templateTypesList.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => { setFormType(t.id); setWizardStep(2); }}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                        formType === t.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-600'
                          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50 dark:bg-slate-950'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <t.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{t.title}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: FILL DETAILS & AUTO VARIABLE DETECTION */}
            {wizardStep === 2 && (
              <div className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Template Name *</label>
                    <Input 
                      type="text"
                      required
                      placeholder="e.g. recharge_success_v2"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="h-11 font-semibold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Category</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white h-11"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="UTILITY">Utility</option>
                      <option value="MARKETING">Marketing</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Language</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white h-11"
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value)}
                    >
                      <option value="en_US">English US (en_US)</option>
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="te">Telugu (te)</option>
                    </select>
                  </div>
                </div>

                {/* Header Option */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Header Format</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white h-11"
                    value={formHeaderType}
                    onChange={(e) => setFormHeaderType(e.target.value as any)}
                  >
                    <option value="NONE">None</option>
                    <option value="TEXT">Text Header</option>
                    <option value="IMAGE">Image Header</option>
                    <option value="VIDEO">Video Header</option>
                    <option value="DOCUMENT">Document (PDF) Header</option>
                  </select>
                </div>

                {formHeaderType === 'TEXT' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Header Text</label>
                    <Input 
                      type="text"
                      placeholder="e.g. A1 Recharge Notification"
                      value={formHeaderText}
                      onChange={(e) => setFormHeaderText(e.target.value)}
                      className="h-11 font-semibold text-xs"
                    />
                  </div>
                )}

                {/* Body Text Input */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                    <span>Message Body Text * (Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for dynamic variables)</span>
                    <span className="text-indigo-600 font-mono text-[11px]">{detectedVariables.length} Variable(s) Detected</span>
                  </label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="Hello {{1}}, your recharge of ₹{{2}} for {{3}} has been successfully processed! TXN: {{4}}"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                  />
                </div>

                {/* AUTOMATIC VARIABLE GENERATION INPUTS */}
                {detectedVariables.length > 0 && (
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Automatically Detected Variables ({detectedVariables.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detectedVariables.map(varNum => (
                        <div key={varNum}>
                          <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block mb-1">
                            Example Value for {`{{${varNum}}}`} *
                          </label>
                          <Input 
                            type="text"
                            placeholder={`e.g. Srujan`}
                            value={exampleInputs[`var_${varNum}`] || ""}
                            onChange={(e) => setExampleInputs({ ...exampleInputs, [`var_${varNum}`]: e.target.value })}
                            className="h-10 text-xs bg-white dark:bg-slate-900"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Text Input */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Footer Text (Optional)</label>
                  <Input 
                    type="text"
                    placeholder="e.g. Thank you for choosing A1 Recharge"
                    value={formFooterText}
                    onChange={(e) => setFormFooterText(e.target.value)}
                    className="h-11 font-semibold text-xs"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: META WHATSAPP LIVE PREVIEW */}
            {wizardStep === 3 && (
              <div className="space-y-4 flex-1 flex flex-col items-center justify-center py-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  WhatsApp Meta Message Card Live Preview
                </p>
                <div className="bg-[#efeae2] dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-slate-900 dark:text-white max-w-md w-full font-sans shadow-lg">
                  {formHeaderType === 'TEXT' && formHeaderText && (
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{formHeaderText}</p>
                  )}
                  {formHeaderType !== 'NONE' && formHeaderType !== 'TEXT' && (
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs">
                      [{formHeaderType} HEADER PREVIEW]
                    </div>
                  )}
                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    {livePreviewBody || "Body text preview will render here..."}
                  </p>
                  {formFooterText && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">{formFooterText}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: CONFIRM & SUBMIT */}
            {wizardStep === 4 && (
              <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCheck className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">Ready to Submit Template</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                    Template "{formName}" will be submitted to Fast2SMS & Meta WABA for approval.
                  </p>
                </div>
              </div>
            )}

            {/* Wizard Navigation Buttons Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {wizardStep > 1 ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setWizardStep((wizardStep - 1) as any)}
                  className="h-11 px-5 rounded-xl font-bold text-xs"
                >
                  Back
                </Button>
              ) : <div />}

              {wizardStep < 4 ? (
                <Button 
                  type="button" 
                  onClick={() => {
                    if (wizardStep === 2 && (!formName || !formBodyText)) {
                      showToast("Template Name and Body Text are required.");
                      return;
                    }
                    setWizardStep((wizardStep + 1) as any);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl text-xs shadow-lg shadow-indigo-600/20"
                >
                  Next Step
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={handleWizardSubmit}
                  disabled={isCreating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 px-10 rounded-xl text-sm shadow-xl shadow-emerald-600/20 gap-2"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Submit Template
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteTemplateId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Delete WhatsApp Template?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteTemplateId(null)} className="h-10 px-4 text-xs font-bold">
                Cancel
              </Button>
              <Button onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white h-10 px-5 text-xs font-bold">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
