"use client";

import Link from "next/link";
import { usePushNotificationHistory } from "@/hooks/useFirebasePush";
import { format } from "date-fns";
import { Loader2, History as HistoryIcon, Image as ImageIcon, Link as LinkIcon, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CampaignHistoryPage() {
  const { data: history, isLoading } = usePushNotificationHistory();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-full pb-10">
      
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-orange-500" /> Campaign Log
          </h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">Review previously sent push notifications and delivery statuses.</p>
        </div>
        <Button variant="outline" className="h-10 rounded-xl font-bold bg-slate-50">
          Export Log
        </Button>
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
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Campaign</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Recipients</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Sent By</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Sent Time</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history?.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col max-w-sm">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {log.title}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                          {log.body}
                        </span>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {log.imageUrl && <span className="flex items-center gap-1 text-blue-500"><ImageIcon className="w-3 h-3"/> Image</span>}
                          {log.deepLink && <span className="flex items-center gap-1 text-purple-500"><LinkIcon className="w-3 h-3"/> {log.deepLink}</span>}
                          {log.priority === 'high' && <span className="flex items-center gap-1 text-rose-500"><AlertTriangle className="w-3 h-3"/> High Priority</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.userId ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{log.userId.name}</span>
                          <span className="text-xs text-slate-500">{log.userId.phone}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">Deleted User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'DELIVERED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Delivered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-[11px] font-bold uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{log.sentBy?.name || 'System'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                        {format(new Date(log.createdAt), "dd MMM yyyy, h:mm a")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/firebase-push/compose?title=${encodeURIComponent(log.title)}&body=${encodeURIComponent(log.body)}&imageUrl=${encodeURIComponent(log.imageUrl || '')}&deepLink=${encodeURIComponent(log.deepLink || '')}`}>
                        <Button variant="ghost" size="sm" className="h-8 font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                          Duplicate
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!history || history.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No campaign history found.
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
