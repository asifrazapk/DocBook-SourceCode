import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarCheck, Check } from 'lucide-react'
import { getClinic, getDoctors, getDoctorDaySchedule, createAppointment, type Clinic, type Doctor, type DoctorDaySchedule } from '../services/api'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [schedule, setSchedule] = useState<DoctorDaySchedule | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    getClinic(slug).then((c) => {
      setClinic(c.data)
      getDoctors(c.data.id, 1, 100).then((d) => {
        setDoctors(d.data.items)
        if (d.data.items.length > 0) setDoctorId(d.data.items[0].id)
      })
    })
  }, [slug])

  useEffect(() => {
    if (!clinic || !doctorId) return
    setSelectedTime(null)
    getDoctorDaySchedule(clinic.id, doctorId, date).then((r) => setSchedule(r.data))
  }, [clinic, doctorId, date])

  const submit = async () => {
    if (!clinic || !doctorId || !selectedTime || !name.trim() || !phone.trim()) {
      setError('Please pick a time and fill in your name and phone number.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createAppointment({
        clinic_id: clinic.id,
        doctor_id: doctorId,
        patient_name: name,
        patient_phone: phone,
        appointment_date: date,
        appointment_times: [selectedTime],
        reason: reason || null,
      })
      setDone(true)
    } catch {
      setError('That time may have just been taken — please pick another.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!clinic) {
    return <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Loading…</div>
  }

  if (done) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Check size={22} />
          </div>
          <h1 className="font-bold text-slate-900 mb-1">Request sent!</h1>
          <p className="text-sm text-slate-500">{clinic.name} will confirm your appointment shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center mx-auto mb-2">
            <CalendarCheck size={20} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Book with {clinic.name}</h1>
          <p className="text-xs text-slate-400">{clinic.address}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor</label>
            <select value={doctorId ?? ''} onChange={(e) => setDoctorId(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50">
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Available times</label>
            {!schedule || schedule.available_slots.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No open slots this day — try another date.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {schedule.available_slots.map((s) => (
                  <button
                    key={s.start_time}
                    onClick={() => setSelectedTime(s.start_time)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold border ${
                      selectedTime === s.start_time ? 'bg-teal-700 text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {s.start_time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phone number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for visit (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60"
          >
            {submitting ? 'Booking…' : 'Book appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
