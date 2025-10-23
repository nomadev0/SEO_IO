import { ReactNode } from 'react'
import { cn } from './utils'

export function Section({ title, actions, children, className }:{ title:string; actions?:ReactNode; children:ReactNode; className?:string }){
  return (
    <section className={cn('surface p-6', className)}>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h3 className='text-sm font-semibold text-[var(--colors-muted-foreground)] uppercase tracking-[0.2em]'>{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  )
}

