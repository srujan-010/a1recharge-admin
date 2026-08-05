"use client";

import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings, AppSettings } from "@/hooks/useSettings";
import { Save, Loader2, Settings2, Smartphone, ShieldAlert, Zap, Phone, CheckCircle, Image as ImageIcon, Plus, Trash2 } from "lucide-react";

// UI Components
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { data: initialSettings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [settings, setSettings] = useState<Partial<AppSettings>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const handleSave = () => {
    updateSettings(settings, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    });
  };

  const updateField = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent: 'features' | 'appVersion', field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
  };

  const addBanner = () => {
    setSettings(prev => ({
      ...prev,
      banners: [...(prev.banners || []), { imageUrl: '', link: '', isActive: true }]
    }));
  };

  const removeBanner = (index: number) => {
    setSettings(prev => ({
      ...prev,
      banners: (prev.banners || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const updateBanner = (index: number, field: string, value: any) => {
    setSettings(prev => {
      const newBanners = [...(prev.banners || [])];
      newBanners[index] = { ...newBanners[index], [field]: value };
      return { ...prev, banners: newBanners };
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Remote Config"
          description="Configure global app behaviors without requiring a Play Store update."
        />
        <Button
          onClick={handleSave}
          disabled={isPending}
          size="lg"
          className="shadow-md"
        >
          {isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : saveSuccess ? <CheckCircle className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {saveSuccess ? "Saved Successfully" : "Save Configurations"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Maintenance Panel */}
        <div className={`col-span-1 md:col-span-2 rounded-2xl border p-6 transition-colors shadow-sm ${
          settings.maintenanceMode 
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${settings.maintenanceMode ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${settings.maintenanceMode ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                  System Maintenance Mode
                </h2>
                <p className="text-muted-foreground text-sm mt-1 max-w-2xl font-medium">
                  Enabling this will instantly block all retailers from using the app. They will see the custom message below and cannot log in or make transactions until you disable it.
                </p>
              </div>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-2">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={settings.maintenanceMode || false}
                onChange={(e) => updateField('maintenanceMode', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {settings.maintenanceMode && (
            <div className="mt-6 animate-in slide-in-from-top-2">
              <label className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 block">Maintenance Message for Users</label>
              <textarea
                rows={2}
                className="w-full bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                value={settings.maintenanceMessage}
                onChange={(e) => updateField('maintenanceMessage', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Feature Switches</h2>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Instantly hide services in the app if providers go down.</p>
          </div>

          <div className="space-y-3">
            {['bbps', 'aeps', 'dmt', 'insurance', 'pan'].map((feature) => (
              <div key={feature} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-sm">{feature}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.features?.[feature as keyof typeof settings.features] || false}
                    onChange={(e) => updateNestedField('features', feature, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* App Version Control */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">App Version Control</h2>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Force users to update the Flutter app to the latest build.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Latest Version Code</label>
              <Input 
                type="text" 
                value={settings.appVersion?.latestVersion || ''}
                onChange={(e) => updateNestedField('appVersion', 'latestVersion', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Minimum Supported Version</label>
              <Input 
                type="text" 
                value={settings.appVersion?.minimumSupportedVersion || ''}
                onChange={(e) => updateNestedField('appVersion', 'minimumSupportedVersion', e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
               <input 
                  type="checkbox" 
                  className="w-5 h-5 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  checked={settings.appVersion?.forceUpdate || false}
                  onChange={(e) => updateNestedField('appVersion', 'forceUpdate', e.target.checked)}
                />
                <div>
                  <span className="font-bold text-indigo-900 dark:text-indigo-300 block text-sm mb-1">Strict Force Update</span>
                  <span className="text-xs font-medium text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">If checked, ignores minimum versions and forces EVERYONE to the latest version immediately on app launch.</span>
                </div>
            </div>
          </div>
        </div>

        {/* Content Management (Banners) */}
        <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">App Banners</h2>
              </div>
              <p className="text-sm text-muted-foreground font-medium">Configure the dynamic banners displayed on the mobile app home screen.</p>
            </div>
            <Button onClick={addBanner} variant="outline" className="shrink-0">
              <Plus className="w-4 h-4 mr-2" /> Add Banner
            </Button>
          </div>
          
          <div className="space-y-4">
            {settings.banners?.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No banners configured.</p>
              </div>
            ) : (
              settings.banners?.map((banner: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Image URL</label>
                      <Input 
                        type="text" 
                        placeholder="https://example.com/image.png"
                        value={banner.imageUrl}
                        onChange={(e) => updateBanner(idx, 'imageUrl', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Link (Optional)</label>
                      <Input 
                        type="text" 
                        placeholder="e.g. /offers or external URL"
                        value={banner.link}
                        onChange={(e) => updateBanner(idx, 'link', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-4 w-full sm:w-auto sm:pt-6 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-4 mt-2 sm:mt-0">
                    <label className="relative inline-flex items-center cursor-pointer" title="Toggle active status">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={banner.isActive}
                        onChange={(e) => updateBanner(idx, 'isActive', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                    <Button 
                      variant="destructive"
                      size="icon"
                      onClick={() => removeBanner(idx)}
                      title="Remove Banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Support Details</h2>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Contact information displayed in the retailer app help section.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Support Phone</label>
              <Input 
                type="text" 
                value={settings.supportNumber || ''}
                onChange={(e) => updateField('supportNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">WhatsApp Number</label>
              <Input 
                type="text" 
                value={settings.whatsappNumber || ''}
                onChange={(e) => updateField('whatsappNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Support Email</label>
              <Input 
                type="text" 
                value={settings.supportEmail || ''}
                onChange={(e) => updateField('supportEmail', e.target.value)}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
