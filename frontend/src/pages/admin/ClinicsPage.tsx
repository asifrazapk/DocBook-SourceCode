import { useEffect, useState } from 'react'
import { Plus, Pencil, Building2, Search } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { getClinicsPaginated, createClinic, updateClinic, type Clinic } from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { Field, Input } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { usePagination } from '../../hooks/usePagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export default function ClinicsPage() {
  const { reload: reloadSwitcher } = useClinic()
  const toast = useToast()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Clinic | 'new' | null>(null)

  const load = () => {
    setLoading(true)
    getClinicsPaginated(page, pageSize, search || undefined)
      .then((r) => {
        setClinics(r.data.items)
        setTotal(r.data.total)
        setTotalPages(r.data.total_pages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => setPage(1), [search]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [page, pageSize, search])

  const onSaved = () => {
    load()
    reloadSwitcher() // keep the header clinic switcher in sync too
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clinics"
        subtitle="Manage the clinics your I-DocAssistance instance serves."
        action={
          <Button icon={<Plus size={15} />} onClick={() => setEditing('new')}>
            Add clinic
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
              placeholder="Search all clinics by name or address…"
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : clinics.length === 0 ? (
          <EmptyState icon={<Building2 size={36} />} title="No clinics yet" subtitle="Add your first clinic to get started." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Clinic', 'Address', 'Contact', 'Timezone', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clinics.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">/{c.slug}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[220px] truncate">{c.address}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <p>{c.phone}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{c.timezone}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      {editing && <ClinicFormModal clinic={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </div>
  )
}

function ClinicFormModal({
  clinic,
  onClose,
  onSaved,
}: {
  clinic: Clinic | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { colors } = useTheme()
  const [name, setName] = useState(clinic?.name ?? '')
  const [slug, setSlug] = useState(clinic?.slug ?? '')
  const [address, setAddress] = useState(clinic?.address ?? '')
  const [phone, setPhone] = useState(clinic?.phone ?? '')
  const [email, setEmail] = useState(clinic?.email ?? '')
  const [timezone, setTimezone] = useState(clinic?.timezone ?? 'Asia/Karachi')
  const [isActive, setIsActive] = useState(clinic?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || !address.trim() || !phone.trim() || !email.trim() || (!clinic && !slug.trim())) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (clinic) {
        await updateClinic(clinic.id, { name, address, phone, email, is_active: isActive })
      } else {
        await createClinic({ name, slug, address, phone, email, opening_hours: null, timezone, logo_url: null })
      }
      onSaved()
      toast.show(clinic ? 'Clinic updated.' : 'Clinic added.')
    } catch {
      setError('Could not save this clinic. If adding a new one, make sure the slug is unique.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={clinic ? `Edit ${clinic.name}` : 'Add clinic'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>{clinic ? 'Save changes' : 'Add clinic'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <Field label="Clinic name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!clinic && (
          <Field label="URL slug" required hint="Unique, lowercase, hyphenated (e.g. al-shifa-general)">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
        )}
        <Field label="Address" required>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        {!clinic && (
          <Field label="Timezone">
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </Field>
        )}
        {clinic && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" style={{ accentColor: colors.primary }} />
            Active
          </label>
        )}
      </div>
    </Modal>
  )
}
