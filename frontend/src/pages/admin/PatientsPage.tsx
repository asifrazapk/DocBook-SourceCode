import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, History, Plus, Pencil, Trash2, MessageSquare, UserPlus } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  type Patient,
} from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Pagination from '../../components/ui/Pagination'
import { Field, Input, Textarea, Select } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { avatarColor, initials } from '../../theme'
import { usePagination } from '../../hooks/usePagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export default function PatientsPage() {
  const { clinicId } = useClinic()
  const toast = useToast()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Patient | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Patient | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    getPatients(clinicId, page, pageSize, search || undefined)
      .then((r) => {
        setPatients(r.data.items)
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
      await deletePatient(deleting.id)
      toast.show(`${deleting.name} removed.`)
      load()
    } catch {
      toast.show('Could not remove this patient.', 'error')
    } finally {
      setDeleteLoading(false)
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patients"
        subtitle="Everyone who has booked with this clinic. Repeat visitors share one record."
        action={
          <Button icon={<Plus size={15} />} onClick={() => setEditing('new')}>
            Add patient
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
              placeholder="Search all patients by name, phone or email…"
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState icon={<Users size={36} />} title="No patients found" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Patient', 'Phone', 'Email', 'Age', 'City', 'Source', 'Added', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: avatarColor(i) }}
                        >
                          {initials(p.name)}
                        </div>
                        <span className="font-semibold text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{p.phone}</td>
                    <td className="px-5 py-3 text-slate-500">{p.email ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{p.age ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{p.city ?? '—'}</td>
                    <td className="px-5 py-3">
                      {p.source === 'chat' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                          <MessageSquare size={11} /> Chat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          <UserPlus size={11} /> Manual
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{p.local_created_at?.slice(0, 10) ?? p.created_at?.slice(0, 10) ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={`/admin/patients/${p.id}`}>
                          <Button variant="ghost" size="sm" icon={<History size={13} />}>
                            History
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(p)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={() => setDeleting(p)} />
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

      {editing && clinicId && (
        <PatientFormModal
          clinicId={clinicId}
          patient={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load()
            setEditing(null)
            toast.show(editing === 'new' ? 'Patient added.' : 'Patient updated.')
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Remove patient"
        message={`Remove ${deleting?.name}? Their appointment history is kept, but they won't show up in searches anymore.`}
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </div>
  )
}

function PatientFormModal({
  clinicId,
  patient,
  onClose,
  onSaved,
}: {
  clinicId: number
  patient: Patient | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { colors } = useTheme()
  const [name, setName] = useState(patient?.name ?? '')
  const [phone, setPhone] = useState(patient?.phone ?? '')
  const [email, setEmail] = useState(patient?.email ?? '')
  const [dob, setDob] = useState(patient?.date_of_birth ?? '')
  const [age, setAge] = useState(patient?.age?.toString() ?? '')
  const [gender, setGender] = useState(patient?.gender ?? '')
  const [city, setCity] = useState(patient?.city ?? '')
  const [address, setAddress] = useState(patient?.address ?? '')
  const [notes, setNotes] = useState(patient?.notes ?? '')
  const [isActive, setIsActive] = useState(patient?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (patient) {
        await updatePatient(patient.id, {
          name,
          phone,
          email: email || null,
          date_of_birth: dob || null,
          age: age ? Number(age) : null,
          gender: gender || null,
          city: city || null,
          address: address || null,
          notes: notes || null,
          is_active: isActive,
        })
      } else {
        await createPatient({
          clinic_id: clinicId,
          name,
          phone,
          email: email || null,
          date_of_birth: dob || null,
          age: age ? Number(age) : null,
          gender: gender || null,
          city: city || null,
          address: address || null,
          notes: notes || null,
        })
      }
      onSaved()
    } catch {
      setError('Could not save this patient. If the phone number already exists for another patient, that record will be reused instead.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={patient ? `Edit ${patient.name}` : 'Add patient'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>{patient ? 'Save changes' : 'Add patient'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92-3xx-xxxxxxx" />
          </Field>
        </div>
        <Field label="Email (optional)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of birth">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Age" hint="Approximate, if date of birth isn't known">
            <Input type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="City / living area">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
          </Field>
        </div>
        <Field label="Address (optional)">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, ongoing conditions, etc." />
        </Field>
        {patient && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" style={{ accentColor: colors.primary }} />
            Active
          </label>
        )}
      </div>
    </Modal>
  )
}
