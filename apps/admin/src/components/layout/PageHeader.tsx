import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, filters, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8", className)}>
      <div className="flex-1 min-w-0">
        <h1 className="text-[32px] font-bold tracking-tight text-slate-900 dark:text-white truncate leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text.5 font-medium text-slate-500 dark:text-slate-400 text-[17px]">
            {description}
          </p>
        )}
      </div>
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
        {filters && (
          <div className="flex items-center gap-2 bg-slate-50/80 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {filters}
          </div>
        )}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
