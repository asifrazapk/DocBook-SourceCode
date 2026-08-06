import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Stethoscope, FileText, ChevronLeft, ChevronRight, ChevronDown, CalendarClock, X } from 'lucide-react'
import { useDoctorAuth } from '../../context/DoctorAuthContext'
import {
  getMySchedule,
  getMyAppointments,
  addMyPrescription,
  rescheduleMyAppointment,
  cancelMyAppointment,
  type DoctorDaySchedule,
  type Appointment,
} from '../../services/api'

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}
function todayISO() {
  return toISO(new Date())
}
function weekDatesFor(d: Date) {
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-rose-50 text-rose-600',
  rescheduled: 'bg-sky-50 text-sky-700',
}

export default function DoctorDashboardPage() {
  const { user, logout } = useDoctorAuth()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [date, setDate] = useState(new Date())
  const [schedule, setSchedule] = useState<DoctorDaySchedule | null>(null)
  const [rangeAppointments, setRangeAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [prescribingFor, setPrescribingFor] = useState<Appointment | null>(null)
  const [reschedulingFor, setReschedulingFor] = useState<Appointment | null>(null)
  const [cancellingFor, setCancellingFor] = useState<Appointment | null>(null)

  const weekDates = useMemo(() => weekDatesFor(date), [date])
  const calendarDays = useMemo(() => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const startOffset = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    return cells
  }, [date])

  const load = () => {
    if (!user) {
      navigate('/doctor/login')
      return
    }
    setLoading(true)
    if (viewMode === 'day') {
      getMySchedule(toISO(date)).then((r) => setSchedule(r.data)).finally(() => setLoading(false))
    } else if (viewMode === 'week') {
      getMyAppointments(undefined, toISO(weekDates[0]), toISO(weekDates[6]))
        .then((r) => setRangeAppointments(r.data.filter((a) => a.status !== 'cancelled')))
        .finally(() => setLoading(false))
    } else {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      getMyAppointments(undefined, toISO(monthStart), toISO(monthEnd))
        .then((r) => setRangeAppointments(r.data.filter((a) => a.status !== 'cancelled')))
        .finally(() => setLoading(false))
    }
  }

  useEffect(load, [user, date, viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const a of rangeAppointments) {
      if (!map[a.appointment_date]) map[a.appointment_date] = []
      map[a.appointment_date].push(a)
    }
    return map
  }, [rangeAppointments])

  const step = (dir: 1 | -1) => {
    setDate((d) => {
      if (viewMode === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      if (viewMode === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * 7)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir)
    })
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center text-white">
            <Stethoscope size={17} />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{user.name}</p>
            <p className="text-xs text-slate-400">Doctor Portal</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout()
            navigate('/doctor/login')
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-500"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg font-bold text-slate-900">My Schedule</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => step(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setDate(new Date())} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50">
              Today
            </button>
            <button onClick={() => step(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
              <ChevronRight size={14} />
            </button>
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'day' | 'week' | 'month')}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-teal-700 text-teal-700 text-xs font-semibold cursor-pointer"
              >
                <option value="day">Day view</option>
                <option value="week">Week view</option>
                <option value="month">Month view</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-teal-700" />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        ) : viewMode === 'day' ? (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total slots', value: schedule?.stats.total_slots ?? 0 },
                { label: 'Booked', value: schedule?.stats.booked ?? 0 },
                { label: 'Available', value: schedule?.stats.available ?? 0 },
                { label: 'Rescheduled', value: schedule?.stats.rescheduled ?? 0 },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-bold text-slate-900 text-sm">Appointments for {toISO(date)}</h2>
              </div>
              {!schedule || schedule.appointments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No appointments this day.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {schedule.appointments.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      appt={a}
                      onPrescribe={() => setPrescribingFor(a)}
                      onReschedule={() => setReschedulingFor(a)}
                      onCancel={() => setCancellingFor(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : viewMode === 'week' ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((d, i) => {
                const iso = toISO(d)
                const dayAppts = byDay[iso] ?? []
                const isToday = iso === todayISO()
                return (
                  <div key={iso} className={`rounded-lg border ${isToday ? 'border-teal-700 border-2' : 'border-slate-100'}`}>
                    <div className={`text-center py-2 border-b border-slate-100 ${isToday ? 'bg-teal-50' : 'bg-slate-50'}`}>
                      <p className="text-[10px] font-semibold text-slate-400">{DAY_LABELS[i]}</p>
                      <p className="text-sm font-bold text-slate-800">{d.getDate()}</p>
                    </div>
                    <div className="p-1.5 space-y-1 min-h-[80px]">
                      {dayAppts.length === 0 ? (
                        <p className="text-[10px] text-slate-300 text-center py-3">—</p>
                      ) : (
                        dayAppts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setDate(d)
                              setViewMode('day')
                            }}
                            className="w-full text-left px-1.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-[10px]"
                          >
                            <span className="font-semibold">{a.appointment_time.slice(0, 5)}</span> {a.patient_name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DAY_LABELS.map((lbl) => (
                <div key={lbl} className="text-center text-[10px] font-semibold text-slate-400 py-1">
                  {lbl}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((d, i) => {
                if (!d) return <div key={i} />
                const iso = toISO(d)
                const dayAppts = byDay[iso] ?? []
                const isToday = iso === todayISO()
                return (
                  <button
                    key={iso}
                    onClick={() => {
                      setDate(d)
                      setViewMode('day')
                    }}
                    className={`aspect-square rounded-lg border p-1.5 text-left flex flex-col hover:border-slate-300 ${isToday ? 'border-teal-700 border-2' : 'border-slate-100'}`}
                  >
                    <span className="text-xs font-semibold text-slate-700">{d.getDate()}</span>
                    {dayAppts.length > 0 && (
                      <span className="mt-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 self-start">
                        {dayAppts.length} occupied
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {prescribingFor && <PrescriptionModal appointment={prescribingFor} onClose={() => setPrescribingFor(null)} />}
      {reschedulingFor && (
        <RescheduleModal appointment={reschedulingFor} onClose={() => setReschedulingFor(null)} onDone={() => { setReschedulingFor(null); load() }} />
      )}
      {cancellingFor && (
        <CancelModal appointment={cancellingFor} onClose={() => setCancellingFor(null)} onDone={() => { setCancellingFor(null); load() }} />
      )}
    </div>
  )
}

function AppointmentRow({
  appt,
  onPrescribe,
  onReschedule,
  onCancel,
}: {
  appt: Appointment
  onPrescribe: () => void
  onReschedule: () => void
  onCancel: () => void
}) {
  const canModify = appt.status !== 'cancelled' && appt.status !== 'completed'
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {appt.appointment_time.slice(0, 5)} — {appt.patient_name}
          </p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[appt.status] ?? 'bg-slate-100 text-slate-500'}`}>{appt.status}</span>
        </div>
        <p className="text-xs text-slate-400">{appt.reason ?? 'General consultation'}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onPrescribe} className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 px-2.5 py-1.5 rounded-lg">
          <FileText size={13} /> Prescription
        </button>
        {canModify && (
          <>
            <button onClick={onReschedule} className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 px-2.5 py-1.5 rounded-lg">
              <CalendarClock size={13} /> Reschedule
            </button>
            <button onClick={onCancel} className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg">
              <X size={13} /> Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PrescriptionModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const [diagnosis, setDiagnosis] = useState('')
  const [prescription, setPrescription] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await addMyPrescription({
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        diagnosis: diagnosis || null,
        prescription: prescription || null,
        notes: notes || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <h2 className="font-bold text-slate-900 mb-3">Prescription — {appointment.patient_name}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Report / diagnosis</label>
            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Prescription</label>
            <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Cancel</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RescheduleModal({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const [newDate, setNewDate] = useState(appointment.appointment_date)
  const [newTime, setNewTime] = useState(appointment.appointment_time.slice(0, 5))
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await rescheduleMyAppointment(appointment.id, { new_date: newDate, new_time: newTime, note: note || null })
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'That time may already be booked — please pick another.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <h2 className="font-bold text-slate-900 mb-3">Reschedule — {appointment.patient_name}</h2>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New date</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New time</label>
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Cancel</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg disabled:opacity-60">
            {submitting ? 'Saving…' : 'Confirm reschedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelModal({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await cancelMyAppointment(appointment.id, note || null)
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <h2 className="font-bold text-slate-900 mb-2">Cancel appointment?</h2>
        <p className="text-sm text-slate-500 mb-3">
          {appointment.patient_name} on {appointment.appointment_date} at {appointment.appointment_time.slice(0, 5)}
        </p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Keep it</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg disabled:opacity-60">
            {submitting ? 'Cancelling…' : 'Cancel appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
