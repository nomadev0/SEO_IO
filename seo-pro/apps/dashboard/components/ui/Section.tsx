import { ReactNode } from 'react'
export function Section({ title, actions, children }:{ title:string; actions?:ReactNode; children:ReactNode }){
return (
<section className="card">
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-medium text-gray-500 dark:text-white/70">{title}</h3>
{actions}
</div>
{children}
</section>
)
}