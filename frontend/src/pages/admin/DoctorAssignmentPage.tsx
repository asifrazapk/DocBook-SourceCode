import { useEffect, useState } from 'react'
import { Building2, ArrowRight } from 'lucide-react'
import { getAllDoctorsWithClinic, getClinics, updateDoctor, type DoctorWithClinic, type Clinic } from '../../services/api'
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Card'
import { Select } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'

export default function DoctorAssignmentPage() {
  const toast = useToast()
  const [doctors, setDoctors] = useState<DoctorWithClinic[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getAllDoctorsWithClinic(), getClinics()])
      .then(([d, c]) => {
        setDoctors(d.data)
        setClinics(c.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const reassign = async (doctor: DoctorWithClinic, newClinicId: number) => {
    if (newClinicId === doctor.clinic_id) return
    setSavingId(doctor.id)
    try {
      await updateDoctor(doctor.id, { clinic_id: newClinicId })
      toast.show(`${doctor.name} reassigned.`)
      load()
    } catch (err: any) {
      toast.show(err?.response?.data?.detail || 'Could not reassign this doctor.', 'error')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Doctor Assignment" subtitle="Move a doctor from one clinic to another." />

      <Card className="flex items-start gap-3 bg-slate-50 border-slate-200">
        <Building2 size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          A doctor with upcoming (not yet cancelled or completed) appointments at their current clinic can't be
          reassigned until those are rescheduled or cancelled first.
        </p>
      </Card>

      <Card noPad>
        {doctors.length === 0 ? (
          <EmptyState icon={<Building2 size={28} />} title="No doctors found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Doctor', 'Specialty', 'Current clinic', 'Reassign to', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((d) => (
                <DoctorRow key={d.id} doctor={d} clinics={clinics} saving={savingId === d.id} onReassign={(cid) => reassign(d, cid)} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

function DoctorRow({
  doctor,
  clinics,
  saving,
  onReassign,
}: {
  doctor: DoctorWithClinic
  clinics: Clinic[]
  saving: boolean
  onReassign: (clinicId: number) => void
}) {
  const [selected, setSelected] = useState(doctor.clinic_id)

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-5 py-3 font-semibold text-slate-800">{doctor.name}</td>
      <td className="px-5 py-3 text-slate-500">{doctor.specialty}</td>
      <td className="px-5 py-3 text-slate-600">{doctor.clinic_name}</td>
      <td className="px-5 py-3">
        <Select value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="!py-1.5 !text-xs w-48">
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => onReassign(selected)}
          disabled={selected === doctor.clinic_id || saving}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-teal-50 px-2.5 py-1.5 rounded-lg"
        >
          <ArrowRight size={13} /> {saving ? 'Moving…' : 'Move'}
        </button>
      </td>
    </tr>
  )
}
