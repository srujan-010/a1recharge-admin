'use client';

import { useState, useEffect } from 'react';
import { 
  IndianRupee, Wallet, Users, ArrowUpRight, Activity, Sparkles, 
  CheckCircle2, AlertTriangle, Clock, Percent, DollarSign, 
  UserCheck, ShieldCheck, MessageSquare, Bell, CreditCard, RefreshCw, Smartphone, Tv, Zap, Droplet, Flame, Gamepad2, Globe, QrCode, ArrowDownLeft
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStats, useLiveFeed } from '@/hooks/useDashboard';
import { usePaymentOverview } from '@/hooks/useReports';
import { useSocket } from '@/hooks/useSocket';
import { LiveProviderCard } from '@/components/dashboard/LiveProviderCard';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState<'today' | '7d' | '30d' | 'month'>('today');

  const { data: stats, isLoading: isStatsLoading } = useDashboardStats(timeFilter);
  const { data: paymentOverview, isLoading: isPaymentLoading } = usePaymentOverview({ period: timeFilter });
  const { data: initialFeed, isLoading: isFeedLoading } = useLiveFeed();
  const { socket, isConnected } = useSocket();

  const [liveFeed, setLiveFeed] = useState<any[]>([]);

  // Mask Customer Mobile Number: 94407XXXXX
  const maskMobile = (mobile?: string) => {
    if (!mobile) return 'N/A';
    const cleaned = String(mobile).replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const last10 = cleaned.slice(-10);
      return `${last10.substring(0, 5)}XXXXX`;
    }
    return mobile;
  };

  // Safe Distance Formatting
  const formatTimeAgo = (dateVal: any) => {
    if (!dateVal) return 'Just now';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Just now';
    try {
      return formatDistanceToNow(d, { addSuffix: true });
    } catch (e) {
      return 'Just now';
    }
  };

  // Set initial feed on load
  useEffect(() => {
    if (initialFeed && Array.isArray(initialFeed)) {
      setLiveFeed(initialFeed);
    }
  }, [initialFeed]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!socket) return;

    const handleNewTxn = (newTxn: any) => {
      const formattedTxn = {
        id: newTxn._id || String(Date.now()),
        orderId: newTxn.orderId || `A1R${String(newTxn._id || Date.now()).substring(0, 8).toUpperCase()}`,
        service: newTxn.service || 'Mobile Recharge',
        operator: newTxn.operatorCode || newTxn.providerName || 'Recharge',
        amount: typeof newTxn.amount === 'number' ? newTxn.amount.toFixed(2) : (newTxn.amount || '0.00'),
        status: (newTxn.status || 'SUCCESS').toUpperCase(),
        retailerName: newTxn.userId?.name || newTxn.userId?.phone || 'Retailer',
        mobileNumber: newTxn.mobileNumber || '',
        timestamp: new Date().toISOString(),
        isNew: true
      };

      setLiveFeed(prev => [formattedTxn, ...prev].slice(0, 15));
    };

    socket.on('new_transaction', handleNewTxn);

    return () => {
      socket.off('new_transaction', handleNewTxn);
    };
  }, [socket]);

  // Calculated metrics for Recharge Analytics
  const successCount = stats?.rechargeCount || 0;
  const pendingCount = stats?.pendingRecharges || 0;
  const failedCount = stats?.failedRecharges || 0;
  const totalAttempted = stats?.totalRecharges || (successCount + pendingCount + failedCount);
  
  // SUCCESS RATE FIX: If totalAttempted is 0, display 0% (NEVER 100%)
  const successRate = totalAttempted > 0 
    ? (stats?.successRate !== undefined ? stats.successRate : parseFloat(((successCount / totalAttempted) * 100).toFixed(1)))
    : 0;

  // Service Title & Icon Helper
  const getServiceHeader = (serviceStr: string, operatorCode: string) => {
    const s = (serviceStr || '').toLowerCase();
    const op = (operatorCode || '').toUpperCase();

    if (s.includes('dth') || op.includes('DTH') || op.includes('TATA') || op.includes('DISH') || op.includes('SUN')) {
      return { title: '📺 DTH Recharge', icon: <Tv className="w-4 h-4 text-purple-600" /> };
    }
    if (s.includes('electricity') || s.includes('bill') || op.includes('MSEDC')) {
      return { title: '⚡ Electricity Bill', icon: <Zap className="w-4 h-4 text-amber-500" /> };
    }
    if (s.includes('water')) {
      return { title: '💧 Water Bill', icon: <Droplet className="w-4 h-4 text-cyan-500" /> };
    }
    if (s.includes('gas')) {
      return { title: '🔥 Gas Booking', icon: <Flame className="w-4 h-4 text-orange-500" /> };
    }
    if (s.includes('gift') || s.includes('card')) {
      return { title: '🎮 Gift Card', icon: <Gamepad2 className="w-4 h-4 text-pink-500" /> };
    }
    if (s.includes('broadband')) {
      return { title: '🌐 Broadband Recharge', icon: <Globe className="w-4 h-4 text-indigo-500" /> };
    }

    return { title: '📱 Mobile Recharge', icon: <Smartphone className="w-4 h-4 text-blue-600" /> };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* Dashboard Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="type-dashboard-title text-slate-900 dark:text-white">
              Dashboard
            </h1>
            {isConnected && (
              <span className="inline-flex items-center text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Socket Connected
              </span>
            )}
          </div>
          <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400">
            Real-time overview of platform revenue, transaction volume, and network metrics.
          </p>
        </div>
      </div>

      {/* Primary KPI Cards Grid (Revenue & Commission) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        
        {/* KPI 1: Today's Recharge Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-900/40 shadow-2xs">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                ₹{stats?.rechargeVolume ? Number(stats.rechargeVolume).toLocaleString('en-IN') : '0.00'}
              </div>
              <p className="type-card-label">
                Today's Recharge Volume
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Total Gross Transaction</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">Live DB Feed</span>
          </div>
        </div>

        {/* KPI 2: Commission Received */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-900/40 shadow-2xs">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                ₹{stats?.providerCommission ? Number(stats.providerCommission).toLocaleString('en-IN') : '0.00'}
              </div>
              <p className="type-card-label">
                Commission Received from A1 Topup
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Provider Payouts</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Real-time</span>
          </div>
        </div>

        {/* KPI 3: Commission Paid to Retailers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-900/40 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                ₹{stats?.retailerCommission ? Number(stats.retailerCommission).toLocaleString('en-IN') : '0.00'}
              </div>
              <p className="type-card-label">
                Commission Paid to Retailers
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Retailer Payouts</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">Real-time</span>
          </div>
        </div>

        {/* KPI 4: Net Company Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-900/40 shadow-2xs">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                ₹{stats?.netProfit ? Number(stats.netProfit).toLocaleString('en-IN') : '0.00'}
              </div>
              <p className="type-card-label">
                Net Company Profit
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Net Earnings</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">100% Margin</span>
          </div>
        </div>
      </div>

      {/* Secondary KPI Cards Grid (Operational) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* KPI 5: Today's Recharges */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-900/40 shadow-2xs">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                {stats?.rechargeCount ? stats.rechargeCount.toLocaleString('en-IN') : '0'}
              </div>
              <p className="type-card-label">
                Successful Recharges
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Completed orders</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Today</span>
          </div>
        </div>

        {/* KPI 6: Total Retailers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-900/40 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
              Active Network
            </span>
          </div>

          {isStatsLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="type-card-value text-slate-900 dark:text-white">
                {stats?.totalRetailers ? stats.totalRetailers.toLocaleString('en-IN') : '0'}
              </div>
              <p className="type-card-label">
                Total Retailers
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between type-caption">
            <span>Active count:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats?.activeRetailers || 0} Retailers</span>
          </div>
        </div>

        {/* KPI 7: Live Provider Balance Card */}
        <LiveProviderCard providerName="A1Topup" />
      </div>

      {/* Payment Type Financial Overview (Wallet vs UPI) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card A: Wallet Movement Overview */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Wallet Transactions Overview</h3>
                <p className="text-[11px] text-slate-500 font-medium">Real DB wallet ledger debit/credit movement</p>
              </div>
            </div>
            <Badge variant="outline" className="uppercase font-bold text-[10px] border-blue-200 dark:border-blue-800 text-blue-600">
              WALLET
            </Badge>
          </div>

          {isPaymentLoading ? (
            <div className="h-16 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Total Credits</p>
                <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  +₹{paymentOverview?.walletOverview.totalCreditsRupees.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Total Debits</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  -₹{paymentOverview?.walletOverview.totalDebitsRupees.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Net Movement</p>
                <p className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                  ₹{paymentOverview?.walletOverview.netMovementRupees.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Card B: UPI Collections Overview */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">UPI Transactions Overview</h3>
                <p className="text-[11px] text-slate-500 font-medium">Actual UPI wallet top-ups & direct payments</p>
              </div>
            </div>
            <Badge variant="outline" className="uppercase font-bold text-[10px] border-emerald-200 dark:border-emerald-800 text-emerald-600">
              UPI
            </Badge>
          </div>

          {isPaymentLoading ? (
            <div className="h-16 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">UPI Collections</p>
                <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ₹{paymentOverview?.upiOverview.totalCollectionsRupees.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Successful Txns</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {paymentOverview?.upiOverview.successCount || 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Pending / Failed</p>
                <p className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {(paymentOverview?.upiOverview.pendingCount || 0) + (paymentOverview?.upiOverview.failedCount || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Operational Grid: Recharge Analytics & Recent System Activity */}
      <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-7">
        
        {/* Left Section (4 Cols): Recharge Analytics Widget */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="type-section-heading text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5.5 h-5.5 text-blue-600" /> Recharge Analytics
              </h2>
              <p className="type-caption mt-0.5">Operational recharge metrics & financial performance</p>
            </div>

            {/* Time Period Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {(['today', '7d', '30d', 'month'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                    timeFilter === filter
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {filter === 'today' ? 'Today' : filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : 'Month'}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Metrics Cards Grid */}
          {isStatsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : !stats ? (
            <div className="py-16 text-center text-slate-400 text-sm font-medium">
              No recharge activity available for the selected period.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-1">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Successful</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {successCount.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-emerald-600 font-semibold">Completed Orders</p>
              </div>

              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 space-y-1">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {pendingCount.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-amber-600 font-semibold">Awaiting Provider</p>
              </div>

              <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-1">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Failed</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {failedCount.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-rose-600 font-semibold">Recharges Returned</p>
              </div>

              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-1">
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Success Rate</span>
                  <Percent className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {successRate}%
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Network Reliability</p>
              </div>

              <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-1">
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Recharge Volume</span>
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white truncate">
                  ₹{stats?.rechargeVolume ? Number(stats.rechargeVolume).toLocaleString('en-IN') : '0.00'}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Gross Recharge Value</p>
              </div>

              <div className="p-4 bg-teal-50/60 dark:bg-teal-950/20 rounded-2xl border border-teal-100 dark:border-teal-900/30 space-y-1">
                <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Commission</span>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-teal-600 dark:text-teal-400 truncate">
                  ₹{stats?.providerCommission ? Number(stats.providerCommission).toLocaleString('en-IN') : '0.00'}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Net Earned</p>
              </div>

            </div>
          )}
        </div>

        {/* Right Section (3 Cols): Recent System Activity Widget */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[20px] p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="type-section-heading text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5.5 h-5.5 text-indigo-600" /> Recent System Activity
            </h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Realtime
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[360px] pr-1 custom-scrollbar">
            {isFeedLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : !liveFeed || liveFeed.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm font-medium">
                No recharge activity found.
              </div>
            ) : (
              liveFeed.map((txn: any) => {
                const statusStr = (txn.status || 'SUCCESS').toUpperCase();
                const isSuccess = statusStr === 'SUCCESS';
                const isFailed = statusStr === 'FAILED';
                const serviceInfo = getServiceHeader(txn.service, txn.operator);

                return (
                  <div 
                    key={txn.id} 
                    className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                      txn.isNew 
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' 
                        : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            {serviceInfo.title}
                          </span>
                        </div>
                        
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 font-medium">
                          <p>Operator: <span className="font-bold text-slate-800 dark:text-slate-200">{txn.operator || 'Jio'}</span></p>
                          <p>Retailer: <span className="font-bold text-slate-800 dark:text-slate-200">{txn.retailerName || 'Retailer'}</span></p>
                          <p>Customer: <span className="font-mono text-slate-500">{maskMobile(txn.mobileNumber)}</span></p>
                          <p className="text-[10px] text-slate-400 font-mono">Txn ID: {txn.orderId || 'A1R_TXN'}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono">₹{txn.amount}</p>
                        
                        {isSuccess ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 text-[9px] font-bold gap-1 py-0">
                            <CheckCircle2 className="w-2.5 h-2.5" /> SUCCESS
                          </Badge>
                        ) : isFailed ? (
                          <Badge variant="destructive" className="text-[9px] font-bold gap-1 py-0">
                            <AlertTriangle className="w-2.5 h-2.5" /> FAILED
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-bold gap-1 py-0">
                            <Clock className="w-2.5 h-2.5" /> PENDING
                          </Badge>
                        )}
                        
                        <p className="text-[10px] text-slate-400 font-mono pt-1">{formatTimeAgo(txn.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
