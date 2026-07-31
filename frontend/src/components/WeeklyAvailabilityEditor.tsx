import { Plus, Trash2 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { DAY_NAMES } from '../theme'

export interface DayRange {
  id: string
  start_time: string
  end_time: string
  existingId?: number // set when this range is already persisted (schedule modal only)
}

export interface DayState {
  enabled: boolean
  ranges: DayRange[]
}

export type WeekState = DayState[] // always 7 entries, index 0=Sunday ... 6=Saturday

export function emptyWeek(): WeekState {
  return Array.from({ length: 7 }, () => ({ enabled: false, ranges: [] }))
}

interface Props {
  week: WeekState
  onChange: (week: WeekState) => void
}

/** Vertical per-day availability editor: each day is its own row with an
 * on/off toggle and, when on, one or more time ranges ("+ Add hours" adds
 * another — two ranges in the same day is how a lunch break is expressed,
 * no separate break fields needed). Shared by the Add Doctor wizard and the
 * standalone Schedule modal so both stay visually and behaviorally
 * identical. */
export default function WeeklyAvailabilityEditor({ week, onChange }: Props) {
  const { colors } = useTheme()

  const toggleDay = (i: number) => {
    const day = week[i]
    const next = [...week]
    if (!day.enabled && day.ranges.length === 0) {
      next[i] = { enabled: true, ranges: [{ id: crypto.randomUUID(), start_time: '09:00', end_time: '17:00' }] }
    } else {
      next[i] = { ...day, enabled: !day.enabled }
    }
    onChange(next)
  }

  const addRange = (i: number) => {
    const next = [...week]
    next[i] = { ...next[i], ranges: [...next[i].ranges, { id: crypto.randomUUID(), start_time: '09:00', end_time: '17:00' }] }
    onChange(next)
  }

  const removeRange = (i: number, rangeId: string) => {
    const next = [...week]
    next[i] = { ...next[i], ranges: next[i].ranges.filter((r) => r.id !== rangeId) }
    onChange(next)
  }

  const updateRange = (i: number, rangeId: string, field: 'start_time' | 'end_time', value: string) => {
    const next = [...week]
    next[i] = {
      ...next[i],
      ranges: next[i].ranges.map((r) => (r.id === rangeId ? { ...r, [field]: value } : r)),
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {week.map((day, i) => (
        <div key={i} className="border border-slate-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: day.enabled ? colors.primary : '#CBD5E1' }}
              >
                {DAY_NAMES[i][0]}
              </span>
              <span className="text-sm font-semibold text-slate-700">{DAY_NAMES[i]}</span>
            </div>
            <div className="flex items-center gap-3">
              {day.enabled && (
                <button onClick={() => addRange(i)} className="text-xs font-semibold" style={{ color: colors.primary }}>
                  + Add hours
                </button>
              )}
              <button
                onClick={() => toggleDay(i)}
                className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                style={{ backgroundColor: day.enabled ? colors.primary : '#CBD5E1' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                  style={{ transform: day.enabled ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
          {day.enabled && (
            <div className="space-y-2">
              {day.ranges.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={r.start_time}
                    onChange={(e) => updateRange(i, r.id, 'start_time', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={r.end_time}
                    onChange={(e) => updateRange(i, r.id, 'end_time', e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                  />
                  {day.ranges.length > 1 && (
                    <button onClick={() => removeRange(i, r.id)} className="text-rose-400 hover:text-rose-600 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Flattens a WeekState into {day_of_week, start_time, end_time}[] ready to
 * submit — used by both the wizard (fresh creation) and the schedule modal
 * (only the *new* ranges without an existingId need this). */
export function flattenWeek(week: WeekState) {
  const entries: { day_of_week: number; start_time: string; end_time: string }[] = []
  week.forEach((day, i) => {
    if (!day.enabled) return
    for (const r of day.ranges) {
      if (r.end_time > r.start_time) {
        entries.push({ day_of_week: i, start_time: r.start_time, end_time: r.end_time })
      }
    }
  })
  return entries
}
