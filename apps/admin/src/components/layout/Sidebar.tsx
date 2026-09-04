'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  ArrowLeftRight, 
  Settings, 
  Percent,
  Server,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Headphones,
  BarChart3,
  Bell,
  Radio,
  UserCog,
  FileCheck,
  MessageSquare,
  Cpu,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'SUPPORT';

type NavSection = {
  title: string;
  allowedRoles: Role[];
  items: { name: string; href: string; icon: any; allowedRoles: Role[]; hidden?: boolean }[];
};

const navSections: NavSection[] = [
  {
    title: 'DASHBOARD',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'],
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'] },
    ]
  },
  {
    title: 'RETAILERS',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    items: [
      { name: 'Retailers', href: '/dashboard/retailers', icon: Users, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
      { name: 'KYC Verification', href: '/dashboard/kyc?status=pending', icon: ShieldCheck, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
    ]
  },
  {
    title: 'FINANCE',
    allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'],
    items: [
      { name: 'Provider Wallet', href: '/dashboard/wallet', icon: Wallet, allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'] },
      { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'] },
    ]
  },
  {
    title: 'COMMISSION MANAGEMENT',
    allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'],
    items: [
      { name: 'Global Settings', href: '/dashboard/commissions', icon: Percent, allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'SUPPORT'] },
    ]
  },
  {
    title: 'RECHARGE SERVICES',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'],
    items: [
      { name: 'Recharge Transactions', href: '/dashboard/recharges', icon: Smartphone, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'] },
      { name: 'Operators', href: '/dashboard/operators', icon: Radio, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
      { name: 'Provider Management', href: '/dashboard/providers', icon: Server, allowedRoles: ['SUPER_ADMIN', 'FINANCE'] },
      { name: 'PlanAPI', href: '/dashboard/planapi', icon: Cpu, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'] },
    ]
  },
  {
    title: 'COMMUNICATION SERVICES',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    items: [
      { name: 'Fast2SMS', href: '/dashboard/fast2sms', icon: MessageSquare, allowedRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { name: 'Internal Notifications', href: '/dashboard/internal-notifications', icon: Bell, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
      { name: 'Firebase Push', href: '/dashboard/firebase-push', icon: Smartphone, allowedRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { name: 'Support Tickets', href: '/dashboard/support', icon: Headphones, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
    ]
  },
  {
    title: 'REPORTS',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'],
    items: [
      { name: 'Reports', href: '/dashboard/reports?type=revenue', icon: BarChart3, allowedRoles: ['SUPER_ADMIN', 'FINANCE'] },
      { name: 'Top Retailers', href: '/dashboard/reports/top-retailers', icon: Award, allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'] },
    ]
  },
  {
    title: 'SYSTEM',
    allowedRoles: ['SUPER_ADMIN'],
    items: [
      { name: 'App Configuration', href: '/dashboard/settings', icon: Settings, allowedRoles: ['SUPER_ADMIN'] },
      { name: 'Admin Management', href: '/dashboard/admins', icon: UserCog, allowedRoles: ['SUPER_ADMIN'] },
      { name: 'Audit Logs', href: '/dashboard/audit', icon: FileCheck, allowedRoles: ['SUPER_ADMIN'] },
    ]
  },
];

function SidebarNavItems({ isCollapsed, isMobileOpen, setIsMobileOpen, user, isLoading }: {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  user: any;
  isLoading: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userRole = (user?.role?.toUpperCase() || '') as Role;

  if (isLoading) {
    return (
      <div className="space-y-3 px-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ))}
      </div>
    );
  }

  return (
    <nav className="space-y-6">
      {navSections
        .filter((section) => !user || section.allowedRoles.includes(userRole))
        .map((section) => {
          const sectionItems = section.items.filter(item => !item.hidden && (!user || item.allowedRoles.includes(userRole)));
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1.5">
              {(!isCollapsed || isMobileOpen) && (
                <h3 className="px-3 text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  {section.title}
                </h3>
              )}

              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const [baseHref, query] = item.href.split('?');
                  
                  let isActive = false;
                  if (query) {
                    const urlParams = new URLSearchParams(query);
                    let allParamsMatch = true;
                    urlParams.forEach((val, key) => {
                      if (searchParams.get(key) !== val) {
                        allParamsMatch = false;
                      }
                    });
                    isActive = pathname === baseHref && allParamsMatch;
                  } else {
                    isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      title={(isCollapsed && !isMobileOpen) ? item.name : undefined}
                      className={cn(
                        'group relative flex items-center gap-3.5 rounded-2xl h-[56px] px-4 text-[16px] font-medium transition-all duration-200',
                        isActive
                          ? 'bg-blue-50/90 text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400 font-semibold shadow-2xs border-l-4 border-[#2563EB]'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/60 dark:hover:text-white'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'w-[22px] h-[22px] flex-shrink-0 transition-colors',
                          isActive ? 'text-[#2563EB] dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200'
                        )}
                        aria-hidden="true"
                      />
                      {(!isCollapsed || isMobileOpen) && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
    </nav>
  );
}

export function Sidebar() {
  const { user, isLoading, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    // Restore sidebar state from localStorage or auto-collapse for tablet (768px-1023px)
    const saved = localStorage.getItem('a1_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    } else if (window.innerWidth >= 768 && window.innerWidth < 1024) {
      setIsCollapsed(true);
    }

    const handleMobileToggle = () => setIsMobileOpen(prev => !prev);
    const handleMobileClose = () => setIsMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleMobileToggle);
    window.addEventListener('close-mobile-sidebar', handleMobileClose);

    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleMobileToggle);
      window.removeEventListener('close-mobile-sidebar', handleMobileClose);
    };
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('a1_sidebar_collapsed', String(next));
      return next;
    });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Brand Header */}
      <div className={cn(
        "flex h-[72px] items-center border-b border-[#E7ECF3] dark:border-slate-800 shrink-0 transition-all duration-200",
        (isCollapsed && !isMobileOpen) ? "justify-between px-3" : "justify-between px-6"
      )}>
        <Link href="/dashboard" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex h-11 w-11 items-center justify-center shrink-0">
            <img src="/logo.png" alt="A1 Recharge Logo" className="h-full w-full object-contain drop-shadow-sm" />
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex flex-col truncate">
              <span className="text-[18px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none truncate">
                A1 RECHARGE
              </span>
              <span className="text-[10px] font-extrabold text-[#2563EB] dark:text-blue-400 tracking-wider uppercase mt-1 truncate">
                Enterprise Admin
              </span>
            </div>
          )}
        </Link>

        {/* Collapse / Expand Toggle Button (Hidden on Mobile Drawer) */}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto py-6 px-3 scrollbar-thin">
        <Suspense fallback={
          <div className="space-y-3 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            ))}
          </div>
        }>
          <SidebarNavItems 
            isCollapsed={isCollapsed} 
            isMobileOpen={isMobileOpen} 
            setIsMobileOpen={setIsMobileOpen} 
            user={user} 
            isLoading={isLoading} 
          />
        </Suspense>
      </div>

      {/* Footer Profile & Logout Card */}
      <div className="border-t border-[#E7ECF3] p-4 dark:border-slate-800 shrink-0">
        {(!isCollapsed || isMobileOpen) ? (
          <div className="flex items-center justify-between rounded-2xl p-3 bg-slate-50 dark:bg-slate-900/60 border border-[#E7ECF3] dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name || 'Administrator'}</span>
                <span className="text-[10px] text-[#2563EB] dark:text-blue-400 font-bold tracking-wider uppercase truncate">{user?.role?.replace('_', ' ') || 'SUPER ADMIN'}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setIsMobileOpen(false);
                logout();
              }}
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors shrink-0"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-rose-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Permanent Sidebar (Identical structure on lg:) */}
      <aside 
        className={cn(
          "hidden md:flex sticky top-0 z-40 h-screen flex-col border-r border-[#E7ECF3] bg-white dark:border-slate-800 dark:bg-slate-950 transition-all duration-300 shrink-0",
          isCollapsed ? "w-[80px]" : "w-[300px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay (< 768px) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200" 
            onClick={() => setIsMobileOpen(false)} 
          />
          
          {/* Drawer Container */}
          <aside className="relative z-50 flex h-full w-[300px] flex-col border-r border-[#E7ECF3] bg-white dark:border-slate-800 dark:bg-slate-950 shadow-2xl animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
