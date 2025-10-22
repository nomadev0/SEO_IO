'use client';

type OverviewCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  badge?: string;
};

export function OverviewCard({ title, value, hint, badge }: OverviewCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between text-sm text-neutral-500">
        <span>{title}</span>
        {badge ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold text-neutral-900">
        {typeof value === 'number' ? value.toLocaleString('es-ES') : value}
      </div>
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}
