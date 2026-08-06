import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Search, CalendarClock, LayoutGrid, CalendarX2, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClinic } from '../../context/ClinicContext'
import {
  getAppointments,
  updateAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getDoctorDaySchedule,
  getDoctors,
  updatePatient,
  type Appointment,
  type Doctor,
} from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { Field, Input, Textarea, Select } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { statusStyle } from '../../theme'
import { useTheme } from '../../context/ThemeContext'
import { usePagination } from '../../hooks/usePagination'
import BookingModal from './BookingModal'

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'cancelled', 'rescheduled', 'completed']

export default function AppointmentsPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const toast = useToast()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('') // debounced value actually sent to the server
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [statusChange, setStatusChange] = useState<{ appt: Appointment; status: string } | null>(null)

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    getAppointments(clinicId, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      q: search || undefined,
      page,
      pageSize,
    })
      .then((r) => {
        setAppointments(r.data.items)
        setTotal(r.data.total)
        setTotalPages(r.data.total_pages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [clinicId, statusFilter, startDate, endDate, search, page, pageSize])

  const startVideoCall = async (appt: Appointment) => {
    if (appt.video_room_key) {
      window.open(`https://meet.jit.si/${appt.video_room_key}`, '_blank')
      return
    }
    try {
      const res = await updateAppointment(appt.id, { is_telemedicine: true })
      toast.show('Video room created.')
      if (res.data.video_room_key) window.open(`https://meet.jit.si/${res.data.video_room_key}`, '_blank')
      load()
    } catch {
      toast.show('Could not create the video room.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointments (list view)"
        subtitle="Book, confirm, reschedule or cancel patient appointments."
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin/appointments">
              <Button variant="secondary" icon={<LayoutGrid size={15} />}>
                Doctor view
              </Button>
            </Link>
            <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
              New appointment
            </Button>
          </div>
        }
      />

      <Card noPad>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search all appointments by patient, phone or doctor…"
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[130px]" />
            <span className="text-slate-400">to</span>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[130px]" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${
                  statusFilter === s ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
                style={statusFilter === s ? { backgroundColor: colors.primary } : {}}
              >
                {s}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={load}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState icon={<CalendarClock size={36} />} title="No appointments found" subtitle="Try a different filter or create a new one." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Patient', 'Doctor', 'Date & time', 'Status', 'Reason', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => {
                  const s = statusStyle(a.status)
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{a.patient_name ?? `Patient #${a.patient_id}`}</p>
                        <p className="text-xs text-slate-400">{a.patient_phone}</p>
                      </td>
                      <td className="px-5 py-3 font-medium" style={{ color: colors.primary }}>
                        {a.doctor_name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {a.appointment_date} · {a.appointment_time.slice(0, 5)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{a.status}</span>
                        {a.status_note && <p className="text-[11px] text-slate-400 mt-0.5 max-w-[140px] truncate" title={a.status_note}>"{a.status_note}"</p>}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs max-w-[180px] truncate">{a.reason ?? '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {a.status === 'pending' && (
                            <button
                              onClick={() => setStatusChange({ appt: a, status: 'confirmed' })}
                              className="text-xs font-semibold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded"
                            >
                              Confirm
                            </button>
                          )}
                          {a.status !== 'cancelled' && a.status !== 'completed' && (
                            <>
                              <button
                                onClick={() => startVideoCall(a)}
                                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 px-2 py-1 rounded"
                              >
                                <Video size={12} /> Video
                              </button>
                              <button
                                onClick={() => setRescheduling(a)}
                                className="text-xs font-semibold text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setCancelling(a)}
                                className="text-xs font-semibold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {a.status === 'confirmed' && (
                            <button
                              onClick={() => setStatusChange({ appt: a, status: 'completed' })}
                              className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2 py-1 rounded"
                            >
                              Mark done
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      {showCreate && clinicId && (
        <BookingModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onBooked={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {rescheduling && (
        <RescheduleModal
          appt={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            load()
            toast.show('Appointment rescheduled.')
          }}
        />
      )}

      {cancelling && (
        <CancelModal
          appt={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            load()
            toast.show(`Appointment #${cancelling.id} cancelled.`)
          }}
        />
      )}

      {statusChange && (
        <StatusNoteModal
          appt={statusChange.appt}
          status={statusChange.status}
          onClose={() => setStatusChange(null)}
          onDone={() => {
            setStatusChange(null)
            load()
            toast.show(`Appointment #${statusChange.appt.id} marked ${statusChange.status}.`)
          }}
        />
      )}
    </div>
  )
}

function StatusNoteModal({
  appt,
  status,
  onClose,
  onDone,
}: {
  appt: Appointment
  status: string
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await updateAppointment(appt.id, { status, note: note || undefined })
      onDone()
    } catch {
      toast.show('Could not update the appointment.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={status === 'confirmed' ? 'Confirm appointment' : 'Mark appointment done'}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>
            {status === 'confirmed' ? 'Confirm' : 'Mark done'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {status === 'confirmed' ? 'Confirm' : 'Mark as completed:'} appointment for <span className="font-semibold">{appt.patient_name}</span> on {appt.appointment_date} at {appt.appointment_time.slice(0, 5)}.
        </p>
        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any comments about this update…" />
        </Field>
      </div>
    </Modal>
  )
}

function CancelModal({ appt, onClose, onDone }: { appt: Appointment; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await cancelAppointment(appt.id, note || undefined)
      onDone()
    } catch {
      toast.show('Could not cancel the appointment.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Cancel appointment"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Back</Button>
          <Button variant="danger" size="sm" onClick={submit} loading={submitting}>Cancel appointment</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Cancel appointment for <span className="font-semibold">{appt.patient_name}</span> on {appt.appointment_date}? The patient will need to be notified separately.
        </p>
        <Field label="Reason for cancellation (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Patient requested reschedule…" />
        </Field>
      </div>
    </Modal>
  )
}

function RescheduleModal({
  appt,
  onClose,
  onDone,
}: {
  appt: Appointment
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const { colors } = useTheme()
  const [date, setDate] = useState(appt.appointment_date)
  const [doctorId, setDoctorId] = useState(appt.doctor_id)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patientName, setPatientName] = useState(appt.patient_name ?? '')
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean; label?: string }[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDoctors(appt.clinic_id).then((r) => setDoctors(r.data.items))
  }, [appt.clinic_id])

  useEffect(() => {
    if (!doctorId || !appt.clinic_id) {
      setSlots(null)
      return
    }
    setSlotsLoading(true)
    setSelectedTime(null)
    getDoctorDaySchedule(appt.clinic_id, doctorId, date)
      .then((r) => {
        const available = r.data.available_slots.map((s) => ({ time: s.start_time, available: true }))
        // The appointment's own current slot won't show as "available" (it's
        // occupied by itself) -- add it back in as selectable so rescheduling
        // to the same date/time is still possible.
        const ownTime = appt.appointment_time.slice(0, 5)
        if (date === appt.appointment_date && doctorId === appt.doctor_id && !available.some((s) => s.time === ownTime)) {
          available.push({ time: ownTime, available: true })
        }
        const occupied = r.data.appointments
          .filter((a) => a.status !== 'cancelled' && a.id !== appt.id)
          .map((a) => ({ time: a.appointment_time.slice(0, 5), available: false, label: a.patient_name ?? 'Booked' }))
        setSlots([...available, ...occupied].sort((a, b) => a.time.localeCompare(b.time)))
      })
      .finally(() => setSlotsLoading(false))
  }, [appt, date, doctorId])

  const submit = async () => {
    if (!selectedTime) {
      setError('Select a new time slot.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await rescheduleAppointment(appt.id, {
        appointment_date: date,
        appointment_time: selectedTime,
        doctor_id: doctorId !== appt.doctor_id ? doctorId ?? undefined : undefined,
        note: note || undefined,
      })
      if (patientName.trim() && patientName !== appt.patient_name) {
        await updatePatient(appt.patient_id, { name: patientName.trim() })
      }
      onDone()
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError('That new time is already booked. Please choose another.')
      } else {
        setError('Could not save these changes.')
      }
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={`Edit appointment #${appt.id}`}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<CalendarX2 size={14} />} onClick={submit} loading={submitting}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Patient name">
          <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        </Field>
        <Field label="Doctor">
          <Select value={doctorId ?? ''} onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Unassigned</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <Field label="New date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Time slot</span>
          </div>
          {!doctorId ? (
            <p className="text-xs text-slate-400 py-3">No doctor assigned — enter a time manually below.</p>
          ) : slotsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          ) : !slots || slots.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No slots configured for this doctor on this date.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {slots.map((s) => {
                  const isSelected = selectedTime === s.time
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setSelectedTime(s.time)}
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
          {!doctorId && (
            <Input type="time" value={selectedTime ?? ''} onChange={(e) => setSelectedTime(e.target.value)} className="mt-2" />
          )}
        </div>

        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change…" />
        </Field>
      </div>
    </Modal>
  )
}
