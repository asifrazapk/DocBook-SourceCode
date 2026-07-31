import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import {
  getDoctorAvailability,
  createDoctorAvailability,
  deleteDoctorAvailability,
  getDoctorLeaves,
  createDoctorLeave,
  deleteDoctorLeave,
  type Doctor,
  type DoctorAvailability,
  type DoctorLeave,
} from '../../services/api'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useTheme } from '../../context/ThemeContext'
import { Spinner } from '../../components/ui/Card'
import WeeklyAvailabilityEditor, { emptyWeek, type WeekState, type DayRange } from '../../components/WeeklyAvailabilityEditor'

type Tab = 'availability' | 'leaves'

export default function DoctorScheduleModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const { colors } = useTheme()
  const [tab, setTab] = useState<Tab>('availability')
  const [availability, setAvailability] = useState<DoctorAvailability[]>([])
  const [leaves, setLeaves] = useState<DoctorLeave[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([getDoctorAvailability(doctor.id), getDoctorLeaves(doctor.id)])
      .then(([a, l]) => {
        setAvailability(a.data)
        setLeaves(l.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [doctor.id])

  return (
    <Modal
      open
      title={`Schedule — ${doctor.name}`}
      onClose={onClose}
      width="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
      }
    >
      <div className="flex gap-1.5 mb-4 border-b border-slate-100 -mt-1">
        {(['availability', 'leaves'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-current' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            style={tab === t ? { color: colors.primary } : {}}
          >
            {t === 'availability' ? 'Weekly availability' : 'Leaves & exceptions'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : tab === 'availability' ? (
        <AvailabilityTab doctorId={doctor.id} rows={availability} onReload={load} />
      ) : (
        <LeavesTab doctorId={doctor.id} rows={leaves} onChange={setLeaves} />
      )}
    </Modal>
  )
}

/** Builds a WeekState from persisted rows -- each active row becomes one
 * range carrying its real id, so the diff-on-save logic knows what's
 * already on the server vs. newly added in this editing session. */
function weekFromRows(rows: DoctorAvailability[]): WeekState {
  const week = emptyWeek()
  for (const r of rows) {
    if (!r.is_active) continue
    week[r.day_of_week] = {
      enabled: true,
      ranges: [
        ...week[r.day_of_week].ranges,
        { id: `existing-${r.id}`, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5), existingId: r.id },
      ],
    }
  }
  return week
}

function AvailabilityTab({
  doctorId,
  rows,
  onReload,
}: {
  doctorId: number
  rows: DoctorAvailability[]
  onReload: () => void
}) {
  const toast = useToast()
  const [week, setWeek] = useState<WeekState>(() => weekFromRows(rows))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Re-sync local editing state whenever the persisted rows change (e.g.
  // after a save reloads them with fresh ids).
  useEffect(() => setWeek(weekFromRows(rows)), [rows])

  const originalRanges = useMemo(() => {
    const map = new Map<number, DayRange>()
    for (const day of weekFromRows(rows)) {
      for (const r of day.ranges) if (r.existingId) map.set(r.existingId, r)
    }
    return map
  }, [rows])

  const isDirty = useMemo(() => {
    const currentIds = new Set<number>()
    let hasNew = false
    for (const day of week) {
      for (const r of day.ranges) {
        if (r.existingId) currentIds.add(r.existingId)
        else hasNew = true
      }
    }
    if (hasNew) return true
    for (const id of originalRanges.keys()) {
      if (!currentIds.has(id)) return true
    }
    // Check for edited times on existing ranges
    for (const day of week) {
      for (const r of day.ranges) {
        if (r.existingId) {
          const orig = originalRanges.get(r.existingId)
          if (orig && (orig.start_time !== r.start_time || orig.end_time !== r.end_time)) return true
        }
      }
    }
    return false
  }, [week, originalRanges])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const keptOrNewIds = new Set<number>()
      const toCreate: { day: number; start_time: string; end_time: string }[] = []

      week.forEach((day, i) => {
        for (const r of day.ranges) {
          if (r.existingId) {
            const orig = originalRanges.get(r.existingId)
            const unchanged = orig && orig.start_time === r.start_time && orig.end_time === r.end_time
            if (unchanged) {
              keptOrNewIds.add(r.existingId)
              continue
            }
            // Time was edited -- delete the old row and recreate with the new times.
          }
          if (r.end_time > r.start_time) {
            toCreate.push({ day: i, start_time: r.start_time, end_time: r.end_time })
          }
        }
      })

      const toDelete = [...originalRanges.entries()]
        .filter(([id]) => !keptOrNewIds.has(id))
        .map(([id]) => id)

      await Promise.all(toDelete.map((id) => deleteDoctorAvailability(doctorId, id)))
      for (const entry of toCreate) {
        await createDoctorAvailability(doctorId, {
          days: [entry.day],
          start_time: entry.start_time,
          end_time: entry.end_time,
        })
      }

      onReload()
      toast.show('Weekly availability saved.')
    } catch {
      setError('Could not save your changes. Please try again.')
      toast.show('Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      <WeeklyAvailabilityEditor week={week} onChange={setWeek} />
      <div className="flex justify-end pt-2">
        <Button size="sm" icon={<Save size={14} />} onClick={save} loading={saving} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

function LeavesTab({
  doctorId,
  rows,
  onChange,
}: {
  doctorId: number
  rows: DoctorLeave[]
  onChange: (rows: DoctorLeave[]) => void
}) {
  const toast = useToast()
  const { colors } = useTheme()
  const [leaveDate, setLeaveDate] = useState('')
  const [fullDay, setFullDay] = useState(true)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('12:00')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!leaveDate) {
      setError('Pick a date.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await createDoctorLeave(doctorId, {
        leave_date: leaveDate,
        start_time: fullDay ? null : startTime,
        end_time: fullDay ? null : endTime,
        reason: reason || null,
      })
      onChange([...rows, res.data])
      setLeaveDate('')
      setReason('')
      toast.show('Leave added.')
    } catch {
      setError('Could not save this leave.')
    } finally {
      setSubmitting(false)
    }
  }

  const removeRow = async (row: DoctorLeave) => {
    try {
      await deleteDoctorLeave(doctorId, row.id)
      onChange(rows.filter((r) => r.id !== row.id))
      toast.show('Leave removed.')
    } catch {
      toast.show('Could not remove this leave.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-3">No leaves scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-semibold text-slate-700">{r.leave_date}</span>{' '}
                  <span className="text-slate-500">
                    {r.start_time ? `${r.start_time.slice(0, 5)}–${r.end_time?.slice(0, 5)}` : 'Full day off'}
                    {r.reason && ` · ${r.reason}`}
                  </span>
                </div>
                <button onClick={() => removeRow(r)} className="text-rose-400 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add a leave</p>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <Field label="Date">
          <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 my-3 cursor-pointer">
          <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} className="rounded" style={{ accentColor: colors.primary }} />
          Full day off
        </label>
        {!fullDay && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="From">
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conference, sick leave, etc." />
        </Field>
        <Button className="mt-3" size="sm" icon={<Plus size={14} />} onClick={submit} loading={submitting}>
          Add leave
        </Button>
      </div>
    </div>
  )
}
