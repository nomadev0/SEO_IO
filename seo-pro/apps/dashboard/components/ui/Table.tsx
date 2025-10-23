import { ReactNode } from 'react'


export function Table({ columns, rows }:{ columns:string[]; rows:(ReactNode[])[] }){
return (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="text-left text-gray-500 dark:text-white/60">
<tr>{columns.map((c,i)=>(<th key={i} className="px-3 py-2 font-medium">{c}</th>))}</tr>
</thead>
<tbody>
{rows.map((r,i)=>(
<tr key={i} className="border-t border-gray-100 dark:border-white/10">
{r.map((cell,j)=>(<td key={j} className="px-3 py-2">{cell}</td>))}
</tr>
))}
</tbody>
</table>
</div>
)
}