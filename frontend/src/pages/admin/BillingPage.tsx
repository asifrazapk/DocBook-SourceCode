import { useEffect, useState } from 'react'
import { Info, Plus, Trash2, Wallet } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../components/ui/Toast'
import {
  getAppointments,
  getBills,
  getBillsSummary,
  createBill,
  deleteBill,
  type Appointment,
  type Bill,
} from '../../services/api'
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { usePagination } from '../../hooks/usePagination'

export default function BillingPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const toast = useToast()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)

  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCollected, setTotalCollected] = useState(0)
  const [loadingBills, setLoadingBills] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showAddBill, setShowAddBill] = useState(false)
  const [deleting, setDeleting] = useState<Bill | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadBills = () => {
    if (!clinicId) return
    setLoadingBills(true)
    Promise.all([
      getBills(clinicId, { startDate: startDate || undefined, endDate: endDate || undefined, page, pageSize }),
      getBillsSummary(clinicId, startDate || undefined, endDate || undefined),
    ])
      .then(([b, s]) => {
        setBills(b.data.items)
        setTotal(b.data.total)
        setTotalPages(b.data.total_pages)
        setTotalCollected(s.data.total_collected)
      })
      .finally(() => setLoadingBills(false))
  }

  useEffect(loadBills, [clinicId, startDate, endDate, page, pageSize])

  const doDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteBill(deleting.id)
      toast.show('Bill removed.')
      loadBills()
    } catch {
      toast.show('Could not remove this bill.', 'error')
    } finally {
      setDeleteLoading(false)
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" subtitle="Record payments against confirmed appointments and track monthly usage." />

      <Card className="flex items-start gap-3 bg-slate-50 border-slate-200">
        <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          There's no payment provider connected — bills here are manually recorded by staff against a confirmed appointment.
        </p>
      </Card>

      {/* Real bill records */}
      <Card noPad>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Payments collected</h2>
            <p className="text-xs text-slate-400 mt-0.5">Total in range: <span className="font-semibold text-slate-600">Rs {totalCollected.toLocaleString()}</span></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[135px]" />
            <span className="text-slate-400 text-xs">to</span>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[135px]" />
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddBill(true)}>
              Add bill
            </Button>
          </div>
        </div>

        {loadingBills ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : bills.length === 0 ? (
          <EmptyState icon={<Wallet size={32} />} title="No payments recorded" subtitle="Add a bill against a confirmed appointment to get started." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Date & time', 'Patient', 'Doctor', 'Amount', 'Collected by', 'Notes', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-xs text-slate-500">{b.collected_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{b.patient_name}</td>
                    <td className="px-5 py-3 text-slate-500">{b.doctor_name ?? '—'}</td>
                    <td className="px-5 py-3 font-medium" style={{ color: colors.primary }}>Rs {Number(b.amount).toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{b.collected_by}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs max-w-[160px] truncate">{b.notes ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDeleting(b)} className="text-rose-400 hover:text-rose-600">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      {showAddBill && clinicId && (
        <AddBillModal clinicId={clinicId} onClose={() => setShowAddBill(false)} onSaved={() => { setShowAddBill(false); loadBills() }} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Remove bill"
        message={`Remove this Rs ${deleting ? Number(deleting.amount).toLocaleString() : ''} record?`}
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </div>
  )
}

function AddBillModal({ clinicId, onClose, onSaved }: { clinicId: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [appointmentId, setAppointmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [collectedBy, setCollectedBy] = useState('')
  const [collectedAt, setCollectedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAppointments(clinicId, { status: 'confirmed', pageSize: 100 }).then((r) => setAppointments(r.data.items))
  }, [clinicId])

  const submit = async () => {
    if (!appointmentId || !amount || !collectedBy.trim()) {
      setError('Select an appointment, amount, and who collected it.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createBill({
        clinic_id: clinicId,
        appointment_id: Number(appointmentId),
        amount: Number(amount),
        collected_by: collectedBy,
        collected_at: new Date(collectedAt).toISOString(),
        notes: notes || null,
      })
      toast.show('Bill added.')
      onSaved()
    } catch {
      setError('Could not save this bill.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Add bill"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>Add bill</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <Field label="Confirmed appointment" required hint="Only confirmed appointments can be billed">
          <Select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="">Select an appointment…</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} — {a.patient_name} with {a.doctor_name ?? 'Unassigned'} on {a.appointment_date}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (Rs)" required>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Collected by" required hint="Staff member's name">
            <Input value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)} placeholder="Front Desk - Ayesha" />
          </Field>
        </div>
        <Field label="Date & time collected">
          <Input type="datetime-local" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cash / card, receipt number, etc." />
        </Field>
      </div>
    </Modal>
  )
}
