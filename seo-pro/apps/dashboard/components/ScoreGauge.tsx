'use client';

type ScoreGaugeProps = {
  score: number | null | undefined;
  label?: string;
  size?: number;
};

const SEGMENTS = [
  { color: '#22c55e', limit: 90 },
  { color: '#f97316', limit: 60 },
  { color: '#ef4444', limit: 0 },
];

export function ScoreGauge({ score, label, size = 148 }: ScoreGaugeProps) {
  const value = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : null;
  const bg = buildGradient(value);
  const thickness = size * 0.2;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: bg,
        }}
      >
        <div
          className="flex flex-col items-center justify-center rounded-full bg-white text-center"
          style={{
            width: size - thickness,
            height: size - thickness,
          }}
        >
          <span className="text-xs uppercase text-neutral-500">Score</span>
          <span className="text-2xl font-semibold text-neutral-900">
            {value !== null ? `${Math.round(value)}` : 'n/d'}
          </span>
        </div>
      </div>
      {label ? <span className="text-sm text-neutral-600">{label}</span> : null}
    </div>
  );
}

function buildGradient(score: number | null) {
  if (score === null) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }
  const segments = SEGMENTS.map((segment) => ({
    ...segment,
    start: segment.limit,
  })).sort((a, b) => a.limit - b.limit);

  let color = '#22c55e';
  for (const segment of segments) {
    if (score >= segment.limit) {
      color = segment.color;
      break;
    }
  }

  const angle = (score / 100) * 360;
  return `conic-gradient(${color} 0deg ${angle}deg, #e5e7eb ${angle}deg 360deg)`;
}
