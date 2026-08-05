"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Wallet, MessageSquare, Send, LayoutTemplate, 
  History, LineChart, Settings, Smartphone, FileCheck2, ScrollText, Sparkles
} from "lucide-react";

export default function Fast2SMSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Dashboard", href: "/dashboard/fast2sms", icon: LayoutDashboard },
    { name: "Wallet", href: "/dashboard/fast2sms/wallet", icon: Wallet },
    { name: "WhatsApp", href: "/dashboard/fast2sms/whatsapp", icon: MessageSquare },
    { name: "Templates", href: "/dashboard/fast2sms/templates", icon: LayoutTemplate },
    { name: "Compose", href: "/dashboard/fast2sms/send", icon: Send },
    { name: "Campaigns", href: "/dashboard/fast2sms/campaigns", icon: History },
    { name: "Wallet Transactions", href: "/dashboard/fast2sms/wallet-transactions", icon: Wallet },
    { name: "Logs", href: "/dashboard/fast2sms/logs", icon: ScrollText },
    { name: "Analytics", href: "/dashboard/fast2sms/analytics", icon: LineChart },
    { name: "Settings", href: "/dashboard/fast2sms/settings", icon: Settings },
  ];

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent leading-tight flex items-center gap-2">
              WhatsApp Business Center
            </h1>
            <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
              Enterprise Meta Business Suite powered by Fast2SMS. Manage WABA details, templates, campaign dispatches, live delivery reports, logs, and analytics.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Subnav */}
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
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
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
