import React from 'react';

export type AccountType = 'PERSONAL' | 'BUSINESS' | string;

interface AccountTypeBadgeProps {
  type?: AccountType | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AccountTypeBadge({ type, className = '', size = 'md' }: AccountTypeBadgeProps) {
  const accountType = type ? type.toUpperCase() : 'UNKNOWN';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-bold tracking-wider',
    md: 'px-2.5 py-1 text-xs font-bold tracking-wider',
    lg: 'px-3 py-1.5 text-xs font-extrabold tracking-widest',
  }[size];

  if (accountType === 'BUSINESS') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 uppercase shadow-xs ${sizeClasses} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400"></span>
        BUSINESS
      </span>
    );
  }

  if (accountType === 'PERSONAL') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 uppercase shadow-xs ${sizeClasses} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>
        PERSONAL
      </span>
    );
  }

  // Fallback for missing or unclassified data
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 uppercase shadow-xs ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
      UNKNOWN
    </span>
  );
}
