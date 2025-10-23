'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function SeverityPie({ data }: { data: { name: string; value: number }[] }) {
  const palette = ['#ef4444', '#f59e0b', '#3b82f6', '#9ca3af'];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={110}
            innerRadius={50}
            paddingAngle={4}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RadialGauge({
  value,
  max = 100,
  label,
  color = '#6366f1',
}: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const data = [
    { name: 'value', value: pct, fill: color },
    { name: 'rest', value: 100 - pct, fill: '#e5e7eb' },
  ];
  return (
    <div className="relative h-48 w-48">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius={70}
            outerRadius={90}
            stroke="none"
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold text-neutral-900">{pct}%</span>
        {label ? <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span> : null}
      </div>
    </div>
  );
}

export function SparkArea({
  data,
  dataKey,
  gradientFrom = '#6366f1',
  gradientTo = 'rgba(99,102,241,0)',
}: {
  data: { [key: string]: number | string }[];
  dataKey: string;
  gradientFrom?: string;
  gradientTo?: string;
}) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientFrom} stopOpacity={0.85} />
              <stop offset="95%" stopColor={gradientTo} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip cursor={false} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={gradientFrom}
            fill="url(#sparkGradient)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopHeavyBar({ items }: { items: { url: string; transfer: number }[] }) {
  const data = items.map((item) => ({
    name: truncateUrl(item.url, 48),
    kb: Math.round((item.transfer ?? 0) / 1024),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="kb" fill="#3b82f6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBar({
  data,
  dataKey,
  categoryKey,
  color = '#f97316',
}: {
  data: { [key: string]: number | string }[];
  dataKey: string;
  categoryKey: string;
  color?: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey={categoryKey} type="category" width={150} />
          <Tooltip />
          <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function truncateUrl(url: string, maxLength: number): string {
  if (!url) return '';
  if (url.length <= maxLength) {
    return url;
  }
  return `${url.slice(0, maxLength - 3)}...`;
}
