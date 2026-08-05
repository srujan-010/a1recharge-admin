"use client";

import { useState, useEffect } from "react";
import { Search, Bell, RefreshCw, Plus, LogOut, ShieldCheck, User, Sparkles, ChevronDown, CheckCircle2, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export function Header() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGlobalSync = () => {
    setIsSyncing(true);
    queryClient.invalidateQueries();
    setTimeout(() => {
      setIsSyncing(false);
      setToastMsg("All live feeds and metrics updated.");
      setTimeout(() => setToastMsg(null), 3000);
    }, 800);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 lg:px-8 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95 transition-all">
        
        {/* Toast Notification popup */}
        {toastMsg && (
          <div className="absolute top-20 right-4 sm:right-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 text-xs font-medium animate-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Left Section: Mobile Drawer Toggle + Logo + Global Search Bar */}
        <div className="flex flex-1 items-center gap-2 sm:gap-4 max-w-xs sm:max-w-md lg:max-w-lg">
          {/* Mobile Drawer Toggle & Logo Brand (< 768px) */}
          <div className="flex items-center gap-2 md:hidden shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
              title="Open Menu"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/dashboard" className="flex items-center shrink-0">
              <div className="h-9 w-9 flex items-center justify-center">
                <img src="/logo.png" alt="A1 Recharge Logo" className="h-full w-full object-contain drop-shadow-xs" />
              </div>
            </Link>
          </div>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between h-11 bg-slate-100/80 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 sm:px-4 text-slate-400 text-sm font-medium transition-all shadow-inner group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 truncate text-xs sm:text-sm">
                Search retailers, transactions, settings...
              </span>
            </div>
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-500 font-semibold shadow-2xs shrink-0">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right Nav Action Group */}
        <div className="flex items-center gap-3">

          {/* Sync Button */}
          <button
            onClick={handleGlobalSync}
            disabled={isSyncing}
            className="hidden sm:flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all shadow-2xs"
            title="Sync all queries"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Quick Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsQuickActionsOpen(prev => !prev)}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline font-semibold">Quick Action</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isQuickActionsOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <Link
                  href="/dashboard/retailers"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <User className="w-4 h-4 text-blue-500" />
                  <span>Manage Retailers</span>
                </Link>
                <Link
                  href="/dashboard/transactions"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Live Transactions</span>
                </Link>
                <Link
                  href="/dashboard/wallet-ledger"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-500" />
                  <span>Global Wallet Ledger</span>
                </Link>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(prev => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">System Alerts</span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">Live</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">A1Topup Provider Connected</p>
                    <p className="text-[11px] text-slate-500">Live balance updated successfully.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">System Security</p>
                    <p className="text-[11px] text-slate-500">Super Admin session authenticated.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md shadow-blue-500/20">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug truncate max-w-[110px]">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {user?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name || 'Administrator'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email || 'admin@a1recharge.com'}</p>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span>Security & Settings</span>
                </Link>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </header>

      {/* Global Command Palette (Ctrl+K Modal) */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
