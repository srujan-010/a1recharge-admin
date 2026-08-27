import React from 'react';

export type AccountTypeFilterValue = 'all' | 'PERSONAL' | 'BUSINESS';

interface AccountTypeFilterProps {
  value: AccountTypeFilterValue | string;
  onChange: (value: AccountTypeFilterValue) => void;
  showAll?: boolean;
  className?: string;
  variant?: 'tabs' | 'select';
}

export function AccountTypeFilter({
  value,
  onChange,
  showAll = true,
  className = '',
  variant = 'tabs',
}: AccountTypeFilterProps) {
  const normalizedValue = (value || 'all').toLowerCase();

  if (variant === 'select') {
    return (
      <select
        value={normalizedValue}
        onChange={(e) => onChange(e.target.value.toLowerCase() === 'all' ? 'all' : (e.target.value.toUpperCase() as AccountTypeFilterValue))}
        className={`h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] ${className}`}
      >
        {showAll && <option value="all">Account Type: All</option>}
        <option value="personal">Personal</option>
        <option value="business">Business</option>
      </select>
    );
  }

  return (
    <div className={`inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 ${className}`}>
      {showAll && (
        <button
          type="button"
          onClick={() => onChange('all')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            normalizedValue === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange('PERSONAL')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
          normalizedValue === 'personal'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${normalizedValue === 'personal' ? 'bg-white' : 'bg-blue-500'}`} />
        Personal
      </button>
      <button
        type="button"
        onClick={() => onChange('BUSINESS')}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
          normalizedValue === 'business'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${normalizedValue === 'business' ? 'bg-white' : 'bg-purple-500'}`} />
        Business
      </button>
    </div>
  );
}
