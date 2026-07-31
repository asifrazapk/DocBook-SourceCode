/**
 * Minimal, dependency-free SVG charts for the analytics dashboard. Kept
 * intentionally simple (no charting library) since this project's
 * package.json is managed outside this diff.
 */

interface AreaSeries {
  label: string
  color: string
  values: number[]
}

/** Smooth multi-series area chart (Overview/Deals-style widget). Builds a
 * simple Catmull-Rom-ish smoothing via quadratic bezier midpoints -- no
 * charting library needed. */
export function AreaChart({
  series,
  labels,
  height = 220,
}: {
  series: AreaSeries[]
  labels: string[]
  height?: number
}) {
  const width = 600
  const padding = 8
  const allValues = series.flatMap((s) => s.values)
  const max = Math.max(1, ...allValues)
  const min = Math.min(0, ...allValues)
  const range = max - min || 1
  const n = labels.length
  const step = n > 1 ? (width - padding * 2) / (n - 1) : 0

  const toPoints = (values: number[]) =>
    values.map((v, i) => ({
      x: padding + i * step,
      y: padding + (height - padding * 2) * (1 - (v - min) / range),
    }))

  const smoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return ''
    let d = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const midX = (p0.x + p1.x) / 2
      d += ` Q ${p0.x},${p0.y} ${midX},${(p0.y + p1.y) / 2}`
      d += ` Q ${p1.x},${p1.y} ${p1.x},${p1.y}`
    }
    return d
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`area-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {series.map((s, i) => {
          const points = toPoints(s.values)
          const line = smoothPath(points)
          const area = `${line} L ${points[points.length - 1]?.x ?? 0},${height - padding} L ${points[0]?.x ?? 0},${height - padding} Z`
          return (
            <g key={i}>
              <path d={area} fill={`url(#area-fill-${i})`} stroke="none" />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {labels.map((l, i) => (
          <span key={i} className="text-[10px] text-slate-400">{l}</span>
        ))}
      </div>
    </div>
  )
}

interface BarDatum {
  label: string
  value: number
}

export function BarChart({ data, color = '#0F5B4E', height = 160 }: { data: BarDatum[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = Math.max(2, (d.value / max) * (height - 4))
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group relative h-full">
              <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
                {d.value}
              </div>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: barHeight, backgroundColor: color, minWidth: 4 }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-400 truncate">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ values, color = '#0F5B4E', height = 40 }: { values: number[]; color?: string; height?: number }) {
  if (values.length === 0) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const width = 100
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function DonutStat({
  segments,
  size = 96,
}: {
  segments: { value: number; color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const radius = size / 2 - 8
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={8} />
        {segments.map((seg, i) => {
          const frac = seg.value / total
          const dash = frac * circumference
          const circle = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={8}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          )
          offset += dash
          return circle
        })}
      </g>
    </svg>
  )
}
