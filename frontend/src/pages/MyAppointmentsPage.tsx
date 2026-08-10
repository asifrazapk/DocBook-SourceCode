import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, Plus, CalendarClock, X, FileText, Video } from 'lucide-react'
import ChatLogin, { type ChatIdentity } from '../components/ChatLogin'
import {
  getMyAppointmentsByPhone,
  getMyMedicalRecordsByPhone,
  patientRescheduleAppointment,
  patientCancelAppointment,
  patientEnableTelemedicine,
  getDoctors,
  getDoctorDaySchedule,
  createAppointment,
  type Appointment,
  type MedicalRecord,
  type Doctor,
} from '../services/api'
import { useClinic } from '../context/ClinicContext'
import { useTheme } from '../context/ThemeContext'

const IDENTITY_KEY = 'idoc_patient_identity'

function loadIdentity(): ChatIdentity | null {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null')
  } catch {
    return null
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-rose-50 text-rose-600',
  rescheduled: 'bg-sky-50 text-sky-700',
}

export default function MyAppointmentsPage() {
  const { clinic, clinicId } = useClinic()
  const { colors } = useTheme()
  const [identity, setIdentity] = useState<ChatIdentity | null>(loadIdentity)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showBooking, setShowBooking] = useState(false)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)

  const handleLogin = (id: ChatIdentity) => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  const load = () => {
    if (!clinicId || !identity) return
    setLoading(true)
    Promise.all([
      getMyAppointmentsByPhone(clinicId, identity.phone),
      getMyMedicalRecordsByPhone(clinicId, identity.phone),
    ])
      .then(([a, r]) => {
        setAppointments(a.data)
        setRecords(r.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [clinicId, identity]) // eslint-disable-line react-hooks/exhaustive-deps

  const startVideoCall = async (a: Appointment) => {
    if (!clinicId || !identity) return
    if (a.video_room_key) {
      window.open(`https://meet.jit.si/${a.video_room_key}`, '_blank')
      return
    }
    try {
      const res = await patientEnableTelemedicine(a.id, clinicId, identity.phone)
      if (res.data.video_room_key) window.open(`https://meet.jit.si/${res.data.video_room_key}`, '_blank')
      load()
    } catch {
      /* best-effort -- if this fails the button just doesn't open anything */
    }
  }

  const recordsByAppt = useMemo(() => {
    const map: Record<number, MedicalRecord> = {}
    for (const r of records) map[r.appointment_id] = r
    return map
  }, [records])

  if (!identity) {
    return <ChatLogin clinicName={clinic?.name} onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-bold text-sm text-slate-900">My Appointments</h1>
            <p className="text-xs text-slate-400">{clinic?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowBooking(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <Plus size={14} /> Book appointment
        </button>
      </header>

      <div className="max-w-lg mx-auto p-5">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16">
            <CalendarCheck size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No appointments found for {identity.phone}.</p>
            <button onClick={() => setShowBooking(true)} className="inline-block mt-4 text-sm font-semibold" style={{ color: colors.primary }}>
              Book your first appointment →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((a) => {
              const record = recordsByAppt[a.id]
              const canModify = a.status !== 'cancelled' && a.status !== 'completed'
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-semibold text-slate-800 text-sm">
                      {a.appointment_date} at {a.appointment_time.slice(0, 5)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {a.is_telemedicine && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">Video visit</span>
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {a.doctor_name ?? 'Doctor not assigned'} {a.reason ? `· ${a.reason}` : ''}
                  </p>
                  {a.status_note && <p className="text-xs text-slate-400 mb-2 italic">"{a.status_note}"</p>}

                  {record && (record.diagnosis || record.prescription || record.notes) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <FileText size={11} /> Doctor's report
                      </p>
                      {record.diagnosis && <p className="text-xs text-slate-600"><span className="font-semibold">Diagnosis:</span> {record.diagnosis}</p>}
                      {record.prescription && <p className="text-xs text-slate-600"><span className="font-semibold">Prescription:</span> {record.prescription}</p>}
                      {record.notes && <p className="text-xs text-slate-400"><span className="font-semibold">Notes:</span> {record.notes}</p>}
                    </div>
                  )}

                  {canModify && (
                    <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => startVideoCall(a)}
                        className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 px-2 py-1 rounded"
                      >
                        <Video size={12} /> {a.is_telemedicine ? 'Join' : 'Request'} Video
                      </button>
                      <button
                        onClick={() => setRescheduling(a)}
                        className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"
                      >
                        <CalendarClock size={12} /> Reschedule
                      </button>
                      <button
                        onClick={() => setCancelling(a)}
                        className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showBooking && clinicId && (
        <BookingModal clinicId={clinicId} identity={identity} onClose={() => setShowBooking(false)} onBooked={() => { setShowBooking(false); load() }} />
      )}
      {rescheduling && clinicId && (
        <RescheduleModal
          appt={rescheduling}
          clinicId={clinicId}
          phone={identity.phone}
          onClose={() => setRescheduling(null)}
          onDone={() => { setRescheduling(null); load() }}
        />
      )}
      {cancelling && clinicId && (
        <CancelModal
          appt={cancelling}
          clinicId={clinicId}
          phone={identity.phone}
          onClose={() => setCancelling(null)}
          onDone={() => { setCancelling(null); load() }}
        />
      )}
    </div>
  )
}

function BookingModal({
  clinicId,
  identity,
  onClose,
  onBooked,
}: {
  clinicId: number
  identity: ChatIdentity
  onClose: () => void
  onBooked: () => void
}) {
  const { colors } = useTheme()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [slots, setSlots] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDoctors(clinicId, 1, 100).then((r) => {
      setDoctors(r.data.items)
      if (r.data.items.length > 0) setDoctorId(r.data.items[0].id)
    })
  }, [clinicId])

  useEffect(() => {
    if (!doctorId) return
    setSlotsLoading(true)
    setSelectedTime(null)
    getDoctorDaySchedule(clinicId, doctorId, date)
      .then((r) => setSlots(r.data.available_slots.map((s) => s.start_time)))
      .finally(() => setSlotsLoading(false))
  }, [clinicId, doctorId, date])

  const submit = async () => {
    if (!doctorId || !selectedTime) {
      setError('Please pick a doctor and a time.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createAppointment({
        clinic_id: clinicId,
        doctor_id: doctorId,
        patient_name: identity.name,
        patient_phone: identity.phone,
        appointment_date: date,
        appointment_times: [selectedTime],
        reason: reason || null,
      })
      onBooked()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'That time may have just been taken — please pick another.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-slate-900 mb-3">Book an appointment</h2>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor</label>
        <select value={doctorId ?? ''} onChange={(e) => setDoctorId(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
        <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Available times</label>
        {slotsLoading ? (
          <p className="text-xs text-slate-400 py-2">Loading…</p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No open slots this day — try another date.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {slots.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className="px-2 py-2 rounded-lg text-xs font-semibold border"
                style={selectedTime === t ? { backgroundColor: colors.primary, color: 'white', borderColor: 'transparent' } : { borderColor: '#E2E8F0' }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Cancel</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ backgroundColor: colors.primary }}>
            {submitting ? 'Booking…' : 'Book appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RescheduleModal({
  appt,
  clinicId,
  phone,
  onClose,
  onDone,
}: {
  appt: Appointment
  clinicId: number
  phone: string
  onClose: () => void
  onDone: () => void
}) {
  const { colors } = useTheme()
  const [date, setDate] = useState(appt.appointment_date)
  const [slots, setSlots] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!appt.doctor_id) return
    setSlotsLoading(true)
    setSelectedTime(null)
    getDoctorDaySchedule(clinicId, appt.doctor_id, date)
      .then((r) => {
        const available = r.data.available_slots.map((s) => s.start_time)
        const ownTime = appt.appointment_time.slice(0, 5)
        if (date === appt.appointment_date && !available.includes(ownTime)) available.push(ownTime)
        setSlots(available.sort())
      })
      .finally(() => setSlotsLoading(false))
  }, [appt, clinicId, date])

  const submit = async () => {
    if (!selectedTime) {
      setError('Select a new time.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await patientRescheduleAppointment(appt.id, { clinic_id: clinicId, phone, appointment_date: date, appointment_time: selectedTime })
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
        <h2 className="font-bold text-slate-900 mb-3">Reschedule with {appt.doctor_name}</h2>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <label className="block text-xs font-semibold text-slate-600 mb-1">New date</label>
        <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />

        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Available times</label>
        {slotsLoading ? (
          <p className="text-xs text-slate-400 py-2">Loading…</p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No open slots this day — try another date.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {slots.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className="px-2 py-2 rounded-lg text-xs font-semibold border"
                style={selectedTime === t ? { backgroundColor: colors.primary, color: 'white', borderColor: 'transparent' } : { borderColor: '#E2E8F0' }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Cancel</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60" style={{ backgroundColor: colors.primary }}>
            {submitting ? 'Saving…' : 'Confirm reschedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelModal({
  appt,
  clinicId,
  phone,
  onClose,
  onDone,
}: {
  appt: Appointment
  clinicId: number
  phone: string
  onClose: () => void
  onDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await patientCancelAppointment(appt.id, clinicId, phone)
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not cancel this appointment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <h2 className="font-bold text-slate-900 mb-2">Cancel appointment?</h2>
        <p className="text-sm text-slate-500 mb-3">
          {appt.doctor_name} on {appt.appointment_date} at {appt.appointment_time.slice(0, 5)}
        </p>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-slate-500">Keep it</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg disabled:opacity-60">
            {submitting ? 'Cancelling…' : 'Cancel appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
