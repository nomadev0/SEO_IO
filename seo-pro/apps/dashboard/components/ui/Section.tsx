import { ReactNode } from 'react';
import { cn } from './utils';

interface SectionProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ title, actions, children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn('surface p-6', className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-[var(--colors-muted-foreground)] uppercase tracking-[0.2em]">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

