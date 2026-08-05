"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Send, LayoutTemplate, History, 
  LineChart, Settings, MessageSquare, ShieldCheck
} from "lucide-react";

export default function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Dashboard", href: "/dashboard/whatsapp", icon: LayoutDashboard },
    { name: "Send Message", href: "/dashboard/whatsapp/send", icon: Send },
    { name: "Templates", href: "/dashboard/whatsapp/templates", icon: LayoutTemplate },
    { name: "Campaign History", href: "/dashboard/whatsapp/history", icon: History },
    { name: "Analytics", href: "/dashboard/whatsapp/analytics", icon: LineChart },
    { name: "Settings", href: "/dashboard/whatsapp/settings", icon: Settings },
  ];

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent leading-tight flex items-center gap-2">
              WhatsApp Business Center
            </h1>
            <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
              Official WhatsApp Business Cloud API powered by Fast2SMS. Manage WABA details, approved Meta templates, and dynamic variable campaigns.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto custom-scrollbar" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  isActive
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300",
                  "group inline-flex items-center gap-2 border-b-2 py-4 px-2 text-sm font-bold whitespace-nowrap transition-colors"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
