import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, UserPlus } from 'lucide-react'
import {
  getDoctors,
  getDoctorDaySchedule,
  searchPatients,
  createAppointment,
  type Doctor,
  type Patient,
} from '../../services/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import SearchableSelect, { type SearchableOption } from '../../components/ui/SearchableSelect'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { useTheme } from '../../context/ThemeContext'

interface Props {
  clinicId: number
  doctorId?: number
  date?: string
  initialTime?: string
  onClose: () => void
  onBooked: () => void
}

interface SlotEntry {
  time: string
  available: boolean
  label?: string
}

export default function BookingModal({ clinicId, doctorId, date, initialTime, onClose, onBooked }: Props) {
  const toast = useToast()
  const { colors } = useTheme()

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>(doctorId ?? '')
  const [appointmentDate, setAppointmentDate] = useState(date ?? new Date().toISOString().slice(0, 10))
  const [selectedTimes, setSelectedTimes] = useState<string[]>(initialTime ? [initialTime] : [])
  const [reason, setReason] = useState('')

  const [slots, setSlots] = useState<SlotEntry[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Patient: existing (searchable) or new
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [failedTimes, setFailedTimes] = useState<{ time: string; error: string }[]>([])

  useEffect(() => {
    getDoctors(clinicId, 1, 100).then((r) => setDoctors(r.data.items))
  }, [clinicId])

  // Load the doctor's day schedule (available + occupied) whenever doctor/date changes.
  useEffect(() => {
    if (!selectedDoctorId || !appointmentDate) {
      setSlots(null)
      return
    }
    setSlotsLoading(true)
    setSelectedTimes([])
    getDoctorDaySchedule(clinicId, Number(selectedDoctorId), appointmentDate)
      .then((r) => {
        const available: SlotEntry[] = r.data.available_slots.map((s) => ({ time: s.start_time, available: true }))
        const occupied: SlotEntry[] = r.data.appointments
          .filter((a) => a.status !== 'cancelled')
          .map((a) => ({ time: a.appointment_time.slice(0, 5), available: false, label: a.patient_name ?? 'Booked' }))
        const merged = [...available, ...occupied].sort((a, b) => a.time.localeCompare(b.time))
        setSlots(merged)
        if (initialTime && available.some((s) => s.time === initialTime)) {
          setSelectedTimes([initialTime])
        }
      })
      .finally(() => setSlotsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorId, appointmentDate, clinicId])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    searchTimeout.current = setTimeout(() => {
      searchPatients(clinicId, query).then((r) => setResults(r.data))
    }, 250)
  }, [query, clinicId])

  const doctorOptions: SearchableOption[] = useMemo(
    () => doctors.map((d) => ({ value: d.id, label: d.name, sublabel: d.specialty })),
    [doctors]
  )

  const toggleTime = (time: string) => {
    setSelectedTimes((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time].sort()))
  }

  const submit = async () => {
    setError('')
    setFailedTimes([])

    if (selectedTimes.length === 0) {
      setError('Select at least one available time slot.')
      return
    }
    if (patientMode === 'existing' && !selectedPatient) {
      setError('Search for and select a patient, or switch to "New patient".')
      return
    }
    if (patientMode === 'new' && (!newName.trim() || !newPhone.trim())) {
      setError('New patient name and phone are required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await createAppointment({
        clinic_id: clinicId,
        doctor_id: selectedDoctorId ? Number(selectedDoctorId) : null,
        patient_id: patientMode === 'existing' ? selectedPatient!.id : undefined,
        patient_name: patientMode === 'new' ? newName : undefined,
        patient_phone: patientMode === 'new' ? newPhone : undefined,
        patient_email: patientMode === 'new' ? newEmail || null : undefined,
        appointment_date: appointmentDate,
        appointment_times: selectedTimes,
        reason: reason || null,
      })

      if (res.data.failed.length > 0) setFailedTimes(res.data.failed)
      if (res.data.booked.length > 0) {
        toast.show(res.data.booked.length === 1 ? 'Appointment booked.' : `${res.data.booked.length} appointments booked.`)
        onBooked()
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not book this appointment. Please check the details.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="New appointment"
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>Book appointment</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {failedTimes.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Already taken, not booked: {failedTimes.map((f) => f.time).join(', ')}
          </p>
        )}

        {/* Patient */}
        <div>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs font-semibold text-slate-600">Patient</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPatientMode('existing')}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                style={patientMode === 'existing' ? { backgroundColor: colors.primary, color: 'white', borderColor: colors.primary } : { borderColor: '#E2E8F0', color: '#64748B' }}
              >
                Existing patient
              </button>
              <button
                onClick={() => setPatientMode('new')}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1"
                style={patientMode === 'new' ? { backgroundColor: colors.primary, color: 'white', borderColor: colors.primary } : { borderColor: '#E2E8F0', color: '#64748B' }}
              >
                <UserPlus size={11} /> New patient
              </button>
            </div>
          </div>

          {patientMode === 'existing' ? (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={selectedPatient ? selectedPatient.name : query}
                onChange={(e) => {
                  setSelectedPatient(null)
                  setQuery(e.target.value)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Search by name or phone…"
                className="w-full border border-slate-200 rounded-lg pl-8 pr-8 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
              />
              {selectedPatient && (
                <button
                  onClick={() => {
                    setSelectedPatient(null)
                    setQuery('')
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
              {showResults && !selectedPatient && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p)
                        setShowResults(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                    >
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Patient name" required>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </Field>
              <Field label="Phone" required>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+92-3xx-xxxxxxx" />
              </Field>
              <Field label="Email (optional)">
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {/* Doctor (searchable) + date */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Doctor">
            <SearchableSelect
              options={doctorOptions}
              value={selectedDoctorId}
              onChange={(v) => setSelectedDoctorId(v as number)}
              placeholder="Search doctor…"
              allowEmpty="Unassigned"
            />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
          </Field>
        </div>

        {/* Slot picker: available (selectable) + occupied (disabled) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Time slot(s)</span>
            {selectedTimes.length > 0 && (
              <span className="text-xs" style={{ color: colors.primary }}>{selectedTimes.length} selected</span>
            )}
          </div>
          {!selectedDoctorId ? (
            <p className="text-xs text-slate-400 py-3">Select a doctor to see their available times.</p>
          ) : slotsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          ) : !slots || slots.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No slots configured for this doctor on this date.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {slots.map((s) => {
                  const isSelected = selectedTimes.includes(s.time)
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => toggleTime(s.time)}
                      title={!s.available ? `Booked — ${s.label}` : undefined}
                      className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        !s.available
                          ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through'
                          : isSelected
                          ? 'text-white border-transparent'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                      style={isSelected && s.available ? { backgroundColor: colors.primary } : undefined}
                    >
                      {s.time}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300 inline-block" /> Available</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: colors.primary }} /> Selected</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" /> Booked</span>
              </div>
            </>
          )}
        </div>

        <Field label="Reason for visit">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
