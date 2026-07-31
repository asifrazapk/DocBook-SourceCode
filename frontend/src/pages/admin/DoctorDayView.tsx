import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, CalendarCheck, Clock3, RefreshCcw, LayoutList, ChevronDown } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { getDoctors, getDoctorDaySchedule, type Doctor, type DoctorDaySchedule } from '../../services/api'
import { Card, PageHeader, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { statusStyle } from '../../theme'
import BookingModal from './BookingModal'

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatLong(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function weekDatesFor(d: Date) {
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay()) // back up to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function DoctorDayView() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState<number | null>(searchParams.get('doctor_id') ? Number(searchParams.get('doctor_id')) : null)
  const [date, setDate] = useState<Date>(() => new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [schedule, setSchedule] = useState<DoctorDaySchedule | null>(null)
  const [weekSchedules, setWeekSchedules] = useState<Record<string, DoctorDaySchedule>>({})
  const [loading, setLoading] = useState(true)
  const [bookingTime, setBookingTime] = useState<string | null>(null)
  const [bookingDate, setBookingDate] = useState<Date>(date)

  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId, 1, 100).then((r) => {
      setDoctors(r.data.items)
      if (!doctorId && r.data.items.length > 0) setDoctorId(r.data.items[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  const weekDates = useMemo(() => weekDatesFor(date), [date])

  const load = () => {
    if (!clinicId || !doctorId) return
    setLoading(true)
    if (viewMode === 'day') {
      getDoctorDaySchedule(clinicId, doctorId, toISO(date))
        .then((r) => setSchedule(r.data))
        .finally(() => setLoading(false))
    } else {
      Promise.all(weekDates.map((d) => getDoctorDaySchedule(clinicId, doctorId, toISO(d))))
        .then((results) => {
          const map: Record<string, DoctorDaySchedule> = {}
          results.forEach((r, i) => {
            map[toISO(weekDates[i])] = r.data
          })
          setWeekSchedules(map)
        })
        .finally(() => setLoading(false))
    }
  }

  useEffect(load, [clinicId, doctorId, date, viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (doctorId) setSearchParams({ doctor_id: String(doctorId) }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId])

  const doctor = doctors.find((d) => d.id === doctorId)

  const calendarDays = useMemo(() => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    return cells
  }, [date])

  // Union of every time slot seen across the week, for the shared row axis
  // in week view (matching the reference: every column lines up on the
  // same times, some available, some booked, some blank if outside hours).
  const weekTimeRows = useMemo(() => {
    if (viewMode !== 'week') return []
    const times = new Set<string>()
    for (const d of weekDates) {
      const s = weekSchedules[toISO(d)]
      if (!s) continue
      s.available_slots.forEach((slot) => times.add(slot.start_time))
      s.appointments.filter((a) => a.status !== 'cancelled').forEach((a) => times.add(a.appointment_time.slice(0, 5)))
    }
    return [...times].sort()
  }, [viewMode, weekDates, weekSchedules])

  const openBooking = (d: Date, time?: string) => {
    setBookingDate(d)
    setBookingTime(time ?? '__manual__')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointments"
        subtitle={doctor ? `Viewing schedule for ${doctor.name}` : 'Select a doctor'}
        action={
          <div className="flex items-center gap-2">
            <div className="w-56">
              <SearchableSelect
                options={doctors.map((d) => ({ value: d.id, label: d.name, sublabel: d.specialty }))}
                value={doctorId ?? ''}
                onChange={(v) => setDoctorId(Number(v))}
                placeholder="Search doctor…"
              />
            </div>
            <Link to="/admin/appointments/list">
              <Button variant="secondary" icon={<LayoutList size={15} />}>
                List view
              </Button>
            </Link>
            <Button icon={<Plus size={15} />} onClick={() => openBooking(date)}>
              New Appointment
            </Button>
          </div>
        }
      />

      {/* Stat cards (day view's own doctor/day counts) */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<CalendarDays size={18} />} label="Total Slots" sub="Available today" value={schedule?.stats.total_slots ?? 0} accent={colors.primary} />
        <StatCard icon={<CalendarCheck size={18} />} label="Booked" sub={formatLong(date).split(',')[0]} value={schedule?.stats.booked ?? 0} accent="#059669" />
        <StatCard icon={<Clock3 size={18} />} label="Available" sub="Open slots" value={schedule?.stats.available ?? 0} accent="#D97706" />
        <StatCard icon={<RefreshCcw size={18} />} label="Rescheduled" sub="Need rescheduling" value={schedule?.stats.rescheduled ?? 0} accent="#0891B2" />
      </div>

      <Card noPad>
        {/* Date nav header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-900 text-sm">
              {viewMode === 'day' ? formatLong(date) : `${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            </p>
            <p className="text-xs text-slate-400">
              {doctor?.name} ({doctor?.default_slot_duration_minutes ?? 30} min slots)
              {viewMode === 'week' && ` · ${toISO(weekDates[0])} - ${toISO(weekDates[6])}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - (viewMode === 'week' ? 7 : 1)))
              }
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setDate(new Date())}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() =>
                setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + (viewMode === 'week' ? 7 : 1)))
              }
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <ChevronRight size={14} />
            </button>
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'day' | 'week')}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer"
                style={{ borderColor: colors.primary, color: colors.primary }}
              >
                <option value="day">Day view</option>
                <option value="week">Week view</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.primary }} />
            </div>
          </div>
        </div>

        {viewMode === 'day' ? (
          <div className="grid grid-cols-3 gap-0">
            {/* Available time slots */}
            <div className="col-span-2 p-5 border-r border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800 text-sm">Available Time Slots</p>
                <span className="text-xs text-slate-400">{doctor?.default_slot_duration_minutes ?? 30} min duration</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner />
                </div>
              ) : !schedule || schedule.available_slots.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No open slots for this day.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {schedule.available_slots.map((s) => (
                    <button
                      key={s.start_time}
                      onClick={() => openBooking(date, s.start_time)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-slate-300 transition-colors text-left"
                    >
                      <div>
                        <span className="font-semibold text-sm text-slate-800">{s.start_time}</span>
                        <span className="text-xs text-slate-400 ml-2">{doctor?.default_slot_duration_minutes ?? 30} minutes</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: colors.primary }}>
                        + Click to book
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mini calendar + appointments for date */}
            <div className="p-5">
              <MiniCalendar date={date} calendarDays={calendarDays} onSelect={setDate} color={colors.primary} />

              <p className="text-xs font-semibold text-slate-500 mt-5 mb-2">Appointments for {date.getDate()}/{date.getMonth() + 1}</p>
              {!schedule || schedule.appointments.length === 0 ? (
                <p className="text-xs text-slate-400">No appointments scheduled</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {schedule.appointments.map((a) => {
                    const s = statusStyle(a.status)
                    return (
                      <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{a.appointment_time.slice(0, 5)} · {a.patient_name}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>{a.status}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <p className="font-semibold text-slate-800 text-sm mb-3">Weekly Schedule</p>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((d, i) => {
                  const iso = toISO(d)
                  const daySchedule = weekSchedules[iso]
                  const isToday = iso === toISO(new Date())
                  const availableTimes = new Set((daySchedule?.available_slots ?? []).map((s) => s.start_time))
                  const bookedByTime = new Map(
                    (daySchedule?.appointments ?? [])
                      .filter((a) => a.status !== 'cancelled')
                      .map((a) => [a.appointment_time.slice(0, 5), a])
                  )
                  return (
                    <div key={iso} className={`rounded-lg border ${isToday ? '' : 'border-slate-100'}`} style={isToday ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
                      <div className={`text-center py-2 border-b ${isToday ? '' : 'border-slate-100 bg-slate-50'}`} style={isToday ? { backgroundColor: `${colors.primary}14` } : undefined}>
                        <p className="text-[10px] font-semibold text-slate-400">{DAY_LABELS[i]}</p>
                        <p className="text-sm font-bold text-slate-800">{d.getDate()}</p>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto p-1 space-y-1">
                        {weekTimeRows.length === 0 ? (
                          <p className="text-[10px] text-slate-300 text-center py-4">—</p>
                        ) : (
                          weekTimeRows.map((t) => {
                            const isAvailable = availableTimes.has(t)
                            const booked = bookedByTime.get(t)
                            if (!isAvailable && !booked) {
                              return <div key={t} className="h-8" /> // keep row alignment across columns
                            }
                            return (
                              <button
                                key={t}
                                onClick={() => isAvailable && openBooking(d, t)}
                                disabled={!isAvailable}
                                title={booked ? booked.patient_name ?? 'Booked' : undefined}
                                className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                                  booked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-slate-700 hover:border-slate-300 border border-transparent'
                                }`}
                              >
                                <span className="font-semibold">{t}</span>
                                <br />
                                <span className="text-[10px]">{booked ? (booked.patient_name ?? 'Booked') : 'Available'}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100 text-center">
              <div>
                <p className="text-lg font-bold" style={{ color: colors.primary }}>
                  {Object.values(weekSchedules).reduce((s, sc) => s + sc.stats.total_slots, 0)}
                </p>
                <p className="text-xs text-slate-400">Total Slots</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">
                  {Object.values(weekSchedules).reduce((s, sc) => s + sc.stats.booked, 0)}
                </p>
                <p className="text-xs text-slate-400">Booked</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">
                  {Object.values(weekSchedules).reduce((s, sc) => s + sc.stats.available, 0)}
                </p>
                <p className="text-xs text-slate-400">Available</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {bookingTime && clinicId && doctorId && (
        <BookingModal
          clinicId={clinicId}
          doctorId={doctorId}
          date={toISO(bookingDate)}
          initialTime={bookingTime === '__manual__' ? undefined : bookingTime}
          onClose={() => setBookingTime(null)}
          onBooked={() => {
            setBookingTime(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, sub, value, accent }: { icon: React.ReactNode; label: string; sub: string; value: number; accent: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
          <p className="text-[11px] text-slate-400">{sub}</p>
        </div>
      </div>
    </Card>
  )
}

function MiniCalendar({
  date,
  calendarDays,
  onSelect,
  color,
}: {
  date: Date
  calendarDays: (Date | null)[]
  onSelect: (d: Date) => void
  color: string
}) {
  const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onSelect(new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="text-slate-400 hover:text-slate-700">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-slate-700">{monthLabel}</span>
        <button onClick={() => onSelect(new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="text-slate-400 hover:text-slate-700">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((d, i) => {
          const isSelected = d && d.toDateString() === date.toDateString()
          return (
            <button
              key={i}
              disabled={!d}
              onClick={() => d && onSelect(d)}
              className="aspect-square flex items-center justify-center text-xs rounded-md transition-colors"
              style={isSelected ? { backgroundColor: color, color: 'white' } : undefined}
            >
              {d ? (
                <span className={!isSelected ? 'text-slate-600 hover:bg-slate-100 rounded-md w-full h-full flex items-center justify-center' : ''}>
                  {d.getDate()}
                </span>
              ) : (
                ''
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
