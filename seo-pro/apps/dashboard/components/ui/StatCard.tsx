'use client'
import { ReactNode } from 'react';
import { cn } from './utils';

type StatCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  accent?: 'primary' | 'neutral';
};

export function StatCard({ label, value, delta, icon, accent = 'neutral' }: StatCardProps) {
  return (
    <div
      className={cn(
        'surface flex items-start justify-between gap-4 p-6 transition hover:-translate-y-0.5 hover:shadow-md',
        accent === 'primary' ? 'bg-[var(--colors-primary-default)] text-[var(--colors-primary-foreground)]' : ''
      )}
    >
      <div>
        <div
          className={cn(
            'text-xs uppercase tracking-[0.2em]',
            accent === 'primary' ? 'text-[var(--colors-primary-foreground)]/70' : 'text-[var(--colors-muted-foreground)]'
          )}
        >
          {label}
        </div>
        <div className="stat mt-2">{value}</div>
        {delta && (
          <div
            className={cn(
              'mt-2 text-xs font-medium',
              accent === 'primary' ? 'text-[var(--colors-primary-foreground)]/80' : 'text-emerald-600'
            )}
          >
            {delta}
          </div>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            'h-12 w-12 rounded-full grid place-items-center',
            accent === 'primary' ? 'bg-white/15' : 'bg-[var(--colors-accent-default)]'
          )}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
