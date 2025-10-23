'use client'
import React from 'react'


export function Gauge({ value=0, size=86, stroke=10, label="Score" }:{ value:number; size?:number; stroke?:number; label?:string }){
const r = (size - stroke)/2
const c = 2*Math.PI*r
const clamped = Math.max(0, Math.min(100, value))
const dash = (clamped/100)*c
return (
<div className="relative" style={{width:size,height:size}}>
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
<circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth={stroke}
className="text-gray-200 dark:text-white/10" fill="none"/>
<circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth={stroke}
className="text-brand-500" fill="none" strokeLinecap="round"
strokeDasharray={`${dash} ${c-dash}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>
</svg>
<div className="absolute inset-0 grid place-items-center">
<div className="text-center">
<div className="text-xl font-semibold">{clamped}</div>
<div className="text-[10px] text-gray-500 dark:text-white/60">{label}</div>
</div>
</div>
</div>
)
}