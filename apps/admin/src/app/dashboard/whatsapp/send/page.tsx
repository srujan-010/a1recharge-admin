"use client";

import { useState, useMemo } from "react";
import { 
  useWhatsAppTemplates, 
  useSendWhatsAppCampaign, 
  WhatsAppTemplateItem 
} from "@/hooks/useWhatsAppBusiness";
import { 
  Send, Loader2, Image as ImageIcon, FileText, Target, 
  MessageSquare, Sparkles, X, Check, Eye, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ComposeWhatsAppPage() {
  const [recipients, setRecipients] = useState<"ALL" | "MULTIPLE" | "SINGLE">("ALL");
  const [targetMobile, setTargetMobile] = useState("");
  
  // Advanced filters
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [kycStatus, setKycStatus] = useState("");

  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateItem | null>(null);
  const [varInputs, setVarInputs] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");
  const [documentFilename, setDocumentFilename] = useState("");
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const { data: templates } = useWhatsAppTemplates({ search: templateSearch || undefined });
  const { mutate: sendCampaign, isPending } = useSendWhatsAppCampaign();

  const handleSelectTemplate = (tpl: WhatsAppTemplateItem) => {
    setSelectedTemplate(tpl);
    const initialInputs: Record<string, string> = {};
    if (tpl.exampleValues && Array.isArray(tpl.exampleValues) && tpl.exampleValues.length > 0) {
      tpl.exampleValues.forEach((val: string, idx: number) => {
        initialInputs[`var_${idx + 1}`] = val;
      });
    } else {
      for (let i = 1; i <= (tpl.varCount || 0); i++) {
        initialInputs[`var_${i}`] = "";
      }
    }
    setVarInputs(initialInputs);
    setIsTemplateModalOpen(false);
  };

  const handleVarChange = (key: string, val: string) => {
    setVarInputs(prev => ({ ...prev, [key]: val }));
  };

  const formattedPipeVariables = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.varCount) return "";
    const arr: string[] = [];
    for (let i = 1; i <= selectedTemplate.varCount; i++) {
      arr.push(varInputs[`var_${i}`] || "");
    }
    return arr.join("|");
  }, [selectedTemplate, varInputs]);

  // Render live preview body text with var replacements
  const renderedPreviewBody = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.bodyText) return "";
    let text = selectedTemplate.bodyText;
    for (let i = 1; i <= (selectedTemplate.varCount || 0); i++) {
      const replacement = varInputs[`var_${i}`] || `{{${i}}}`;
      text = text.replace(new RegExp(`{{\\s*${i}\\s*}}`, 'g'), replacement);
    }
    return text;
  }, [selectedTemplate, varInputs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      setToastMsg("Please select a WhatsApp template first.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    sendCampaign({
      recipients,
      targetMobile: recipients === 'SINGLE' ? targetMobile : undefined,
      messageId: selectedTemplate.messageId,
      templateId: selectedTemplate.templateId,
      variablesValues: formattedPipeVariables,
      mediaUrl: mediaUrl || undefined,
      documentFilename: documentFilename || undefined,
      filters: recipients === 'MULTIPLE' ? {
        state: stateFilter || undefined,
        district: districtFilter || undefined,
        kycStatus: kycStatus || undefined,
      } : undefined
    }, {
      onSuccess: (data) => {
        setToastMsg(data.message || "WhatsApp campaign dispatched successfully.");
        setTargetMobile("");
        setMediaUrl("");
        setDocumentFilename("");
        setTimeout(() => setToastMsg(null), 3500);
      },
      onError: (err: any) => {
        setToastMsg(err?.response?.data?.message || err.message);
        setTimeout(() => setToastMsg(null), 4500);
      }
    });
  };

  return (
    <div className="max-w-5xl space-y-6 animate-in fade-in duration-500 pb-16">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Targeting & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" /> Target Audience
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Recipients</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value as any)}
                >
                  <option value="ALL">All Active Retailers</option>
                  <option value="MULTIPLE">Targeted Segment</option>
                  <option value="SINGLE">Single Retailer (Custom Mobile)</option>
                </select>
              </div>

              {recipients === 'SINGLE' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Target Mobile Number *</label>
                  <Input 
                    type="tel"
                    required
                    placeholder="e.g. 9100329521"
                    value={targetMobile}
                    onChange={(e) => setTargetMobile(e.target.value)}
                    className="h-11 text-sm font-semibold"
                  />
                </div>
              )}

              {recipients === 'MULTIPLE' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/10 space-y-3">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Segment Filters</p>
                  
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
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
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

          {/* Media Header Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" /> Media Header (Optional)
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Public Media URL (Image/Video/PDF)</label>
                <Input 
                  type="url"
                  placeholder="https://example.com/banner.png or document.pdf"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="h-11 text-xs"
                />
              </div>

              {mediaUrl.endsWith('.pdf') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">PDF Document Title</label>
                  <Input 
                    type="text"
                    placeholder="e.g. A1 Recharge Plan Guide.pdf"
                    value={documentFilename}
                    onChange={(e) => setDocumentFilename(e.target.value)}
                    className="h-11 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Creative / Variables Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6">
            
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  WhatsApp Campaign Composer
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an approved WABA template and enter dynamic variable values.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                variant="outline"
                className="gap-2 h-11 px-5 rounded-xl border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold text-xs shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-emerald-500" /> Choose Approved Template
              </Button>
            </div>

            {/* Template Info Banner */}
            {!selectedTemplate ? (
              <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Template Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  Click "Choose Approved Template" above to pick a Meta WABA template synced from Fast2SMS.
                </p>
                <Button type="button" onClick={() => setIsTemplateModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 rounded-xl">
                  Choose Template
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                        {selectedTemplate.category}
                      </Badge>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {selectedTemplate.templateName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Message ID: {selectedTemplate.messageId} • Language: {selectedTemplate.language} • {selectedTemplate.varCount} Variable(s)
                    </p>
                  </div>

                  <Button type="button" variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)} className="text-xs font-bold">
                    Change
                  </Button>
                </div>

                {/* Variable Input Fields */}
                {selectedTemplate.varCount > 0 && (
                  <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Dynamic Variables Input ({selectedTemplate.varCount})
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        Formatted Pipe: "{formattedPipeVariables}"
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: selectedTemplate.varCount }, (_, i) => i + 1).map(num => (
                        <div key={num}>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                            Variable {`{{${num}}}`}
                          </label>
                          <Input 
                            type="text" 
                            required
                            placeholder={`Value for {{${num}}}`}
                            value={varInputs[`var_${num}`] || ""}
                            onChange={(e) => handleVarChange(`var_${num}`, e.target.value)}
                            className="h-11 font-semibold text-xs bg-white dark:bg-slate-900"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta WhatsApp Chat Box Preview */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Meta WhatsApp Message Live Preview
                  </p>
                  <div className="bg-[#efeae2] dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-slate-900 dark:text-white max-w-lg font-sans shadow-sm">
                    {selectedTemplate.headerText && (
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedTemplate.headerText}</p>
                    )}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                      {renderedPreviewBody}
                    </p>
                    {selectedTemplate.footerText && (
                      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">{selectedTemplate.footerText}</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isPending || !selectedTemplate}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-10 rounded-xl text-[16px] font-black shadow-xl shadow-emerald-600/25 transition-all active:scale-95 gap-2"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Send WhatsApp Campaign
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </form>

      {/* CHOOSE APPROVED TEMPLATE MODAL */}
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
                <Sparkles className="w-5 h-5 text-emerald-500" /> Select Approved WABA Template
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Choose a Meta-approved WhatsApp template fetched from Fast2SMS.
              </p>
            </div>

            <Input 
              type="text"
              placeholder="Search templates by name or body text..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="h-10 text-xs"
            />

            <div className="overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
              {!templates || templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-medium">
                  No approved WhatsApp templates found. Click "Sync Templates" to fetch from Fast2SMS.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1.5 pr-4">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                          {tpl.category}
                        </Badge>
                        <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                          {tpl.templateName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium">
                        {tpl.bodyText}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Msg ID: {tpl.messageId} • {tpl.varCount} Variable(s)
                      </p>
                    </div>

                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0"
                    >
                      Select
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
