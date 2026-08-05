"use client";

import { useState } from "react";
import { useDeviceTokens, useTestPushNotification, useDeleteDeviceToken } from "@/hooks/useFirebasePush";
import { Loader2, Search, Smartphone, Apple, Send, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function DeviceTokensPage() {
  const { data: devices, isLoading } = useDeviceTokens();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { mutate: testPush, isPending: testLoading } = useTestPushNotification();
  const { mutate: deleteToken, isPending: deleteLoading } = useDeleteDeviceToken();
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  const filteredDevices = devices?.filter((d: any) => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm) ||
    d.retailerId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleTest = (userId: string, token: string) => {
    setActiveTestId(userId);
    testPush({
      fcmToken: token,
      title: "Test Connection",
      body: "Firebase Cloud Messaging is working perfectly!"
    }, {
      onSettled: () => setActiveTestId(null),
      onSuccess: () => alert("Test notification sent to device!"),
      onError: (err: any) => alert(err.message)
    });
  };

  const handleDelete = (userId: string) => {
    if (window.confirm("Are you sure you want to delete this device registration? The user will need to reopen the app to register again.")) {
      deleteToken(userId);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-orange-500" /> Registered Devices
          </h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">Manage active device registrations and debug FCM tokens.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            type="text" 
            placeholder="Search retailer name, ID or phone..." 
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Retailer</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Device Details</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">FCM Token</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Last Registered</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDevices?.map((user: any) => (
                  <tr key={user._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white">{user.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold text-slate-500">{user.retailerId}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="text-xs font-semibold text-slate-500">{user.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          {/* Assuming Android for now since we built it for Android mostly */}
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {user.deviceManufacturer} {user.deviceModel || 'Unknown Device'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                            Android {user.androidVersion} • App v{user.appVersion}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400 font-mono">
                          {user.fcmToken?.substring(0, 16)}...
                        </code>
                        <button 
                          onClick={() => handleCopy(user.fcmToken)}
                          className="text-slate-400 hover:text-orange-500 transition-colors"
                          title="Copy Full Token"
                        >
                          {copiedToken === user.fcmToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {user.tokenUpdatedAt ? format(new Date(user.tokenUpdatedAt), "dd MMM yyyy, h:mm a") : 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5">Last Login: {user.lastLogin ? format(new Date(user.lastLogin), "dd MMM") : 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => handleTest(user._id, user.fcmToken)}
                          disabled={testLoading && activeTestId === user._id}
                          size="sm" 
                          variant="outline" 
                          className="h-8 font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          {testLoading && activeTestId === user._id ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Send className="w-3 h-3 mr-1.5" />}
                          Test
                        </Button>
                        <Button 
                          onClick={() => handleDelete(user._id)}
                          disabled={deleteLoading}
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!filteredDevices || filteredDevices.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No registered devices found. Users must open the mobile app and grant permissions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
