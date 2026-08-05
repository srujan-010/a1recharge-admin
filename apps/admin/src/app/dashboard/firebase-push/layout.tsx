"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Send, History, Smartphone, LayoutTemplate, LineChart } from "lucide-react";

export default function FirebasePushLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Dashboard", href: "/dashboard/firebase-push", icon: LayoutDashboard },
    { name: "Compose Push", href: "/dashboard/firebase-push/compose", icon: Send },
    { name: "Campaign History", href: "/dashboard/firebase-push/history", icon: History },
    { name: "Device Tokens", href: "/dashboard/firebase-push/devices", icon: Smartphone },
    { name: "Templates", href: "/dashboard/firebase-push/templates", icon: LayoutTemplate },
    { name: "Analytics", href: "/dashboard/firebase-push/analytics", icon: LineChart },
  ];

  return (
    <div className="space-y-6 max-w-full mx-auto pb-20">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent leading-tight flex items-center gap-3">
          Firebase Push Notifications
        </h1>
        <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 max-w-2xl">
          Send native Android push notifications to your retailers. Schedule campaigns, track delivery rates, and manage device registrations via FCM v1.
        </p>
      </div>

      {/* Tabs */}
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
                    ? "border-orange-500 text-orange-600 dark:text-orange-500"
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
