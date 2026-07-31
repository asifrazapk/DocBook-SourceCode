import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Users, Stethoscope, MessagesSquare, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getAppointments,
  getDoctors,
  getPatients,
  getAnalyticsOverview,
  type Appointment,
  type Doctor,
  type Patient,
  type AnalyticsOverview,
} from '../../services/api'
import { Card, PageHeader, Spinner } from '../../components/ui/Card'
import { Input } from '../../components/ui/Field'
import { statusStyle } from '../../theme'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
]

export default function DashboardPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const [startDate, setStartDate] = useState(daysAgoISO(6))
  const [endDate, setEndDate] = useState(todayISO())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    Promise.all([
      getAppointments(clinicId, { pageSize: 100 }),
      getDoctors(clinicId, 1, 100),
      getPatients(clinicId, 1, 100),
      getAnalyticsOverview(clinicId, startDate, endDate),
    ])
      .then(([a, d, p, an]) => {
        setAppointments(a.data.items)
        setDoctors(d.data.items)
        setPatients(p.data.items)
        setAnalytics(an.data)
      })
      .finally(() => setLoading(false))
  }, [clinicId, startDate, endDate])

  const today = todayISO()
  const todaysAppts = useMemo(() => appointments.filter((a) => a.appointment_date === today), [appointments, today])
  const pending = useMemo(() => appointments.filter((a) => a.status === 'pending'), [appointments])
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.appointment_date >= today && a.status !== 'cancelled')
        .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time))
        .slice(0, 6),
    [appointments, today]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="An at-a-glance view of this clinic's activity."
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setStartDate(daysAgoISO(p.days))
                    setEndDate(todayISO())
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="!py-1.5 !text-xs w-[135px]" />
            <span className="text-slate-400 text-xs">to</span>
            <Input type="date" value={endDate} min={startDate} max={todayISO()} onChange={(e) => setEndDate(e.target.value)} className="!py-1.5 !text-xs w-[135px]" />
          </div>
        }
      />

      {/* Stat cards: appointments, conversations & messages (selected range), doctors, patients */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<CalendarCheck size={18} />} label="Appointments today" value={todaysAppts.length} accent={colors.primary} />
        <StatCard icon={<Clock size={18} />} label="Pending confirmation" value={pending.length} accent="#D97706" />
        <StatCard icon={<Stethoscope size={18} />} label="Active doctors" value={doctors.filter((d) => d.is_active).length} accent="#2563EB" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<MessagesSquare size={18} />} label="Conversations (selected range)" value={analytics?.totals.conversation_count ?? 0} accent="#7C3AED" />
        <StatCard icon={<MessagesSquare size={18} />} label="Messages (selected range)" value={analytics?.totals.message_count ?? 0} accent="#0891B2" />
        <StatCard icon={<Users size={18} />} label="Registered patients" value={patients.length} accent="#BE185D" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Doctors busy today -- answers "which doctor has appointments today" */}
        <Card noPad>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm">Doctors today</h2>
            <Link to="/admin/doctors" className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.primary }}>
              All doctors <ArrowRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {doctors.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No doctors yet.</p>}
            {doctors
              .slice()
              .sort((a, b) => (b.appointments_today ?? 0) - (a.appointments_today ?? 0))
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.specialty}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                      (d.appointments_today ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {d.appointments_today ?? 0} today
                  </span>
                </div>
              ))}
          </div>
        </Card>

        {/* Upcoming appointments (this clinic) */}
        <Card className="col-span-2" noPad>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm">Upcoming appointments</h2>
            <Link to="/admin/appointments/list" className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.primary }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcoming.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-10">No upcoming appointments.</p>
            )}
            {upcoming.map((a) => {
              const s = statusStyle(a.status)
              return (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.patient_name ?? `Patient #${a.patient_id}`}</p>
                    <p className="text-xs text-slate-400">
                      {a.doctor_name ?? 'Unassigned'} · {a.appointment_date} at {a.appointment_time.slice(0, 5)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${s.bg} ${s.text}`}>
                    {a.status}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
      </div>
    </Card>
  )
}
