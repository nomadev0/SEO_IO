'use client'
import { ReactNode } from 'react'
import { cn } from './utils'


export function StatCard({
label, value, delta, icon
}: { label: string; value: string|number; delta?: string; icon?: ReactNode }){
return (
<div className="kpi">
<div>
<div className="subtle">{label}</div>
<div className="stat mt-1">{value}</div>
{delta && <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{delta}</div>}
</div>
{icon && <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 grid place-items-center">{icon}</div>}
</div>
)
}