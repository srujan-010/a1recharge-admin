"use client";

import React from 'react';
import { 
  X, 
  UserCheck, 
  ExternalLink, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Smartphone, 
  Radio, 
  Wallet, 
  QrCode, 
  Clock, 
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { TopRetailerItem } from '@/hooks/useTopRetailers';
import { Badge } from '@/components/ui/badge';
import { AccountTypeBadge } from '@/components/ui/account-type-badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TopRetailerDetailDrawerProps {
  retailer: TopRetailerItem | null;
  periodName: string;
  onClose: () => void;
}

export function TopRetailerDetailDrawer({
  retailer,
  periodName,
  onClose,
}: TopRetailerDetailDrawerProps) {
  if (!retailer) return null;

  const volumeRupees = (retailer.rechargeVolumePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const commissionRupees = (retailer.commissionPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const avgRupees = (retailer.averageRechargePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const mobileVolRupees = (retailer.serviceBreakdown.mobile.volumePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dthVolRupees = (retailer.serviceBreakdown.dth.volumePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const walletVolRupees = (retailer.paymentMethodBreakdown.wallet.volumePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const upiVolRupees = (retailer.paymentMethodBreakdown.upi.volumePaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalVol = retailer.rechargeVolumePaise || 1;
  const mobilePct = Math.min(100, Math.round((retailer.serviceBreakdown.mobile.volumePaise / totalVol) * 100));
  const dthPct = Math.min(100, Math.round((retailer.serviceBreakdown.dth.volumePaise / totalVol) * 100));

  const walletPct = Math.min(100, Math.round((retailer.paymentMethodBreakdown.wallet.volumePaise / totalVol) * 100));
  const upiPct = Math.min(100, Math.round((retailer.paymentMethodBreakdown.upi.volumePaise / totalVol) * 100));

  const formatPeriodTitle = (name: string) => {
    switch (name) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'this_year': return 'This Year';
      case 'all': return 'All Time';
      case 'custom': return 'Custom Period';
      default: return name;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
              #{retailer.rank}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {retailer.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-medium">{retailer.retailerCode}</span>
                <span>•</span>
                <AccountTypeBadge type={retailer.accountType} size="sm" />
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. Period Scope Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-semibold">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Active Period: <span className="font-bold">{formatPeriodTitle(periodName)}</span>
            </div>
            <Badge variant="outline" className="bg-white/80 dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
              Rank #{retailer.rank}
            </Badge>
          </div>

          {/* 2. Core Financial Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {/* Recharge Volume */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs text-muted-foreground block font-medium">Recharge Volume</span>
              <span className="text-xl font-mono font-extrabold text-slate-900 dark:text-white block mt-1">
                ₹{volumeRupees}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Gross Authoritative Volume
              </span>
            </div>

            {/* Commission Generated */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 block font-medium">Commission Generated</span>
              <span className="text-xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                ₹{commissionRupees}
              </span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium block mt-1">
                Historical Earned
              </span>
            </div>
          </div>

          {/* 3. Transaction Statistics */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" /> Performance Metrics
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted-foreground block">Successful</span>
                <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                  {retailer.successfulRecharges}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted-foreground block">Failed</span>
                <span className="font-mono font-bold text-base text-rose-600 dark:text-rose-400">
                  {retailer.failedRecharges}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-muted-foreground block">Success Rate</span>
                <span className="font-mono font-bold text-base text-indigo-600 dark:text-indigo-400">
                  {retailer.successRate}%
                </span>
              </div>
            </div>

            {/* Success Rate Visual Progress */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Success Rate Progress</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{retailer.successRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    retailer.successRate >= 90 ? 'bg-emerald-500' : retailer.successRate >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${retailer.successRate}%` }}
                />
              </div>
            </div>

            {/* Average & Last Recharge */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <span className="text-xs text-muted-foreground block">Average Recharge</span>
                <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
                  ₹{avgRupees}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Last Recharge</span>
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                  {retailer.lastRechargeAt ? new Date(retailer.lastRechargeAt).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Service Breakdown (Mobile vs DTH) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" /> Service Breakdown
            </h3>

            <div className="space-y-3">
              {/* Mobile Recharge */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Mobile Recharge</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₹{mobileVolRupees}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({retailer.serviceBreakdown.mobile.count} tx)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${mobilePct}%` }} />
                </div>
              </div>

              {/* DTH Recharge */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">DTH Recharge</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₹{dthVolRupees}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({retailer.serviceBreakdown.dth.count} tx)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dthPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 5. Payment Method Funding Breakdown */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-primary" /> Recharge Funding Method
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold">Wallet Funded</span>
                </div>
                <span className="text-sm font-mono font-extrabold text-slate-900 dark:text-white block">
                  ₹{walletVolRupees}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {retailer.paymentMethodBreakdown.wallet.count} recharges ({walletPct}%)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold">UPI Funded</span>
                </div>
                <span className="text-sm font-mono font-extrabold text-slate-900 dark:text-white block">
                  ₹{upiVolRupees}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {retailer.paymentMethodBreakdown.upi.count} recharges ({upiPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* 6. Retailer Profile Links */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">Phone & Contact</span>
              <span className="text-sm font-medium font-mono">{retailer.phone}</span>
            </div>
            <Link
              href={`/dashboard/retailers/${retailer.retailerId}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              Full Profile <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <Link
            href={`/dashboard/transactions?retailerId=${retailer.retailerCode}`}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-primary font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            View All Transactions <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Button
            onClick={onClose}
            variant="outline"
            className="text-xs font-bold px-4"
          >
            Close
          </Button>
        </div>

      </div>
    </>
  );
}
