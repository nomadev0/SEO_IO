'use client'
import { Line, LineChart, ResponsiveContainer } from 'recharts'


export function Sparkline({ data }:{ data:{x:string|number;y:number}[] }){
const chart = data.map(d=>({x:d.x, y:d.y}))
return (
<div className="h-16 w-full">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={chart} margin={{left:0,right:0,top:6,bottom:0}}>
<Line type="monotone" dataKey="y" dot={false} strokeWidth={2} />
</LineChart>
</ResponsiveContainer>
</div>
)
}