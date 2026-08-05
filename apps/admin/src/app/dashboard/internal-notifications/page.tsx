"use client";

import { useState } from "react";
import { useRecentBroadcasts, useSendBroadcast } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { Loader2, Bell, MessageSquare, AlertCircle, Info, CheckCircle, Search, Filter, Mail, MailOpen, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const categoryConfig = {
  SUCCESS: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  INFO: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  WARNING: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  ERROR: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  OFFER: { icon: Tag, color: "text-purple-500", bg: "bg-purple-500/10" },
  SYSTEM: { icon: Bell, color: "text-slate-500", bg: "bg-slate-500/10" },
};

export default function InternalNotificationsPage() {
  const { data: broadcasts, isLoading } = useRecentBroadcasts();
  const { mutate: sendBroadcast, isPending } = useSendBroadcast();
  
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("INFO");
  const [action, setAction] = useState("");

  const filteredBroadcasts = broadcasts?.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "ALL" || b.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    sendBroadcast(
      { title, message, category, action },
      {
        onSuccess: () => {
          setIsComposeOpen(false);
          setTitle("");
          setMessage("");
          setCategory("INFO");
          setAction("");
        },
        onError: (err: any) => alert(err.response?.data?.message || err.message)
      }
    );
  };

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight flex items-center gap-3">
            Internal Notifications
          </h1>
          <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 max-w-xl">
            In-app messages and announcements displayed in the mobile app's notification center.
          </p>
        </div>

        <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-blue-500/25 transition-all">
              <MessageSquare className="w-5 h-5 mr-2" />
              New Broadcast
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[24px]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                Compose Broadcast
              </DialogTitle>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Title</label>
                <Input 
                  required
                  placeholder="e.g. Scheduled Maintenance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-semibold text-slate-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Message</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="App will be down from 2 AM to 4 AM."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Category</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="INFO">Information</option>
                    <option value="SUCCESS">Success</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Alert / Error</option>
                    <option value="OFFER">Promotional Offer</option>
                    <option value="SYSTEM">System Notice</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Action Route (Optional)</label>
                  <Input 
                    placeholder="e.g. /wallet"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl text-white font-bold shadow-lg shadow-blue-500/25 mt-4">
                {isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <MessageSquare className="w-5 h-5 mr-2" />}
                Broadcast Now
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            type="text" 
            placeholder="Search broadcasts..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm font-medium"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className="pl-11 pr-8 py-0 h-12 w-full sm:w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="INFO">Info</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="OFFER">Offers</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBroadcasts?.map((notification: any) => {
            const config = categoryConfig[notification.category as keyof typeof categoryConfig] || categoryConfig.INFO;
            const Icon = config.icon;

            return (
              <div 
                key={notification._id} 
                className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow group relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full opacity-5 ${config.bg}`} />
                
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{notification.title}</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      {format(new Date(notification.createdAt), "dd MMM yyyy, h:mm a")}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium line-clamp-3 mb-6 min-h-[60px]">
                  {notification.message}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                      {notification.category}
                    </span>
                    {notification.action && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Route: {notification.action}
                      </span>
                    )}
                  </div>
                  
                  {/* Mock Read/Unread Analytics for Internal System */}
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="flex items-center gap-1.5" title="Delivered">
                      <Mail className="w-4 h-4" />
                      <span className="text-xs font-bold">100%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredBroadcasts?.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                <Search className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No broadcasts found</h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination mock */}
      {filteredBroadcasts && filteredBroadcasts.length > 0 && (
        <div className="flex justify-center pt-8">
          <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" className="font-bold rounded-xl" disabled>Previous</Button>
            <Button variant="secondary" size="sm" className="font-bold rounded-xl w-10 h-10 p-0">1</Button>
            <Button variant="ghost" size="sm" className="font-bold rounded-xl w-10 h-10 p-0 text-slate-500">2</Button>
            <Button variant="ghost" size="sm" className="font-bold rounded-xl">Next</Button>
          </div>
        </div>
      )}

    </div>
  );
}
