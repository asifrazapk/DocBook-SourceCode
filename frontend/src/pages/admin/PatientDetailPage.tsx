import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, UserPlus, Layers, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import {
  getPatient,
  getPatientAppointments,
  updateAppointment,
  cancelAppointment,
  type Patient,
  type Appointment,
} from '../../services/api'
import { Card, Spinner, EmptyState } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { statusStyle, avatarColor, initials } from '../../theme'
import { useTheme } from '../../context/ThemeContext'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { colors } = useTheme()
  const toast = useToast()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const load = () => {
    if (!id) return
    setLoading(true)
    Promise.all([getPatient(Number(id)), getPatientAppointments(Number(id))])
      .then(([p, a]) => {
        setPatient(p.data)
        setAppointments(a.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  const stats = useMemo(() => {
    const confirmed = appointments.filter((a) => a.status === 'confirmed' || a.status === 'completed').length
    const pending = appointments.filter((a) => a.status === 'pending').length
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length
    return { total: appointments.length, confirmed, pending, cancelled }
  }, [appointments])

  const markStatus = async (appt: Appointment, status: string) => {
    try {
      await updateAppointment(appt.id, { status })
      toast.show(`Appointment #${appt.id} marked ${status}.`)
      load()
    } catch {
      toast.show('Could not update the appointment.', 'error')
    }
  }

  const doCancel = async () => {
    if (!cancelling) return
    setCancelLoading(true)
    try {
      await cancelAppointment(cancelling.id)
      toast.show(`Appointment #${cancelling.id} cancelled.`)
      load()
    } catch {
      toast.show('Could not cancel the appointment.', 'error')
    } finally {
      setCancelLoading(false)
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (!patient) {
    return <EmptyState title="Patient not found" />
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/patients" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.primary }}>
        <ArrowLeft size={13} /> Back to Patients
      </Link>

      {/* Header */}
      <Card>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: avatarColor(patient.id) }}
          >
            {initials(patient.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-400">
              ID: #{String(patient.id).padStart(6, '0')} | {patient.phone}
            </p>
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {patient.source === 'chat' ? (
                <>
                  <MessageSquare size={11} /> Added via chat
                </>
              ) : (
                <>
                  <UserPlus size={11} /> Added manually
                </>
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Layers size={17} />} label="Total" value={stats.total} accent="#3B82F6" />
        <StatCard icon={<CheckCircle2 size={17} />} label="Confirmed" value={stats.confirmed} accent="#22C55E" />
        <StatCard icon={<Clock3 size={17} />} label="Pending" value={stats.pending} accent="#EAB308" />
        <StatCard icon={<XCircle size={17} />} label="Cancelled" value={stats.cancelled} accent="#EF4444" />
      </div>

      {/* Appointment history */}
      <Card noPad>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm">Appointment History</h2>
        </div>
        {appointments.length === 0 ? (
          <EmptyState title="No appointments yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Date & time', 'Doctor', 'Reason', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((a) => {
                const s = statusStyle(a.status)
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-600">
                      {a.appointment_date} · {a.appointment_time.slice(0, 5)}
                    </td>
                    <td className="px-5 py-3 font-medium" style={{ color: colors.primary }}>
                      {a.doctor_name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[200px] truncate">{a.reason ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{a.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        {a.status === 'pending' && (
                          <button onClick={() => markStatus(a, 'confirmed')} className="text-xs font-semibold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded">
                            Confirm
                          </button>
                        )}
                        {a.status === 'confirmed' && (
                          <button onClick={() => markStatus(a, 'completed')} className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2 py-1 rounded">
                            Mark done
                          </button>
                        )}
                        {a.status !== 'cancelled' && a.status !== 'completed' && (
                          <button onClick={() => setCancelling(a)} className="text-xs font-semibold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel appointment"
        message={`Cancel this appointment on ${cancelling?.appointment_date}?`}
        confirmLabel="Cancel appointment"
        onConfirm={doCancel}
        onCancel={() => setCancelling(null)}
        loading={cancelLoading}
      />
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
          <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
      </div>
    </Card>
  )
}
