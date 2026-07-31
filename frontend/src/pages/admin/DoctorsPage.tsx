import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, Stethoscope, CalendarCheck, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getDoctors,
  updateDoctor,
  deleteDoctor,
  type Doctor,
} from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { avatarColor, initials } from '../../theme'
import DoctorScheduleModal from './DoctorScheduleModal'
import AddDoctorWizard from './AddDoctorWizard'
import { usePagination } from '../../hooks/usePagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export default function DoctorsPage() {
  const { clinicId } = useClinic()
  const toast = useToast()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [scheduleFor, setScheduleFor] = useState<Doctor | null>(null)
  const [deleting, setDeleting] = useState<Doctor | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    getDoctors(clinicId, page, pageSize, search || undefined)
      .then((r) => {
        setDoctors(r.data.items)
        setTotal(r.data.total)
        setTotalPages(r.data.total_pages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => setPage(1), [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [clinicId, page, pageSize, search])

  const doDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteDoctor(deleting.id)
      toast.show(`Dr. ${deleting.name} removed.`)
      load()
    } catch {
      toast.show('Could not remove this doctor.', 'error')
    } finally {
      setDeleteLoading(false)
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Doctors"
        subtitle="Manage your clinic's doctors and their weekly schedules."
        action={
          <Button icon={<Plus size={15} />} onClick={() => setShowWizard(true)}>
            Add doctor
          </Button>
        }
      />

      <Card noPad>
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search all doctors by name or specialty…"
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : doctors.length === 0 ? (
          <EmptyState icon={<Stethoscope size={36} />} title="No doctors yet" subtitle="Add your first doctor to get started." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Doctor', 'Specialty', 'Contact', 'Today', 'Status', 'Added', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.map((d, i) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: avatarColor(i) }}
                        >
                          {initials(d.name)}
                        </div>
                        <span className="font-semibold text-slate-800">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{d.specialty}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      <p>{d.phone ?? '—'}</p>
                      <p className="text-slate-400">{d.email ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        to={`/admin/appointments?doctor_id=${d.id}`}
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                          (d.appointments_today ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title="View today's schedule"
                      >
                        <CalendarCheck size={11} />
                        {d.appointments_today ?? 0}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{d.local_created_at?.slice(0, 10) ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" icon={<CalendarClock size={13} />} onClick={() => setScheduleFor(d)}>
                          Schedule
                        </Button>
                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(d)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={() => setDeleting(d)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      {showWizard && clinicId && (
        <AddDoctorWizard
          clinicId={clinicId}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false)
            load()
          }}
        />
      )}

      {editing && (
        <DoctorEditModal
          doctor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            toast.show('Doctor updated.')
          }}
        />
      )}

      {scheduleFor && <DoctorScheduleModal doctor={scheduleFor} onClose={() => setScheduleFor(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title="Remove doctor"
        message={`Remove Dr. ${deleting?.name}? Existing appointments will keep this doctor's history, but they'll no longer be bookable.`}
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </div>
  )
}

function DoctorEditModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: Doctor
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { colors } = useTheme()
  const [name, setName] = useState(doctor.name)
  const [specialty, setSpecialty] = useState(doctor.specialty)
  const [bio, setBio] = useState(doctor.bio ?? '')
  const [email, setEmail] = useState(doctor.email ?? '')
  const [phone, setPhone] = useState(doctor.phone ?? '')
  const [duration, setDuration] = useState(doctor.default_slot_duration_minutes)
  const [isActive, setIsActive] = useState(doctor.is_active)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || !specialty.trim()) {
      setError('Name and specialty are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateDoctor(doctor.id, {
        name,
        specialty,
        bio: bio || null,
        email: email || null,
        phone: phone || null,
        default_slot_duration_minutes: duration,
        is_active: isActive,
      })
      onSaved()
    } catch {
      setError('Could not save this doctor.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={`Edit ${doctor.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <Field label="Full name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Specialty" required>
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        </Field>
        <Field label="Bio">
          <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <Field label="Default appointment duration (minutes)">
          <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" style={{ accentColor: colors.primary }} />
          Active (bookable by patients)
        </label>
      </div>
    </Modal>
  )
}
