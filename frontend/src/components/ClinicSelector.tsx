import { Building2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'

/** Compact clinic switcher used in both the chat header and admin header. */
export default function ClinicSelector({ className = '' }: { className?: string }) {
  const { clinics, clinicId, loading, setClinicId } = useClinic()

  if (loading) {
    return <div className={`text-xs text-slate-400 ${className}`}>Loading clinics…</div>
  }

  if (clinics.length <= 1) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <select
        value={clinicId ?? ''}
        onChange={(e) => setClinicId(Number(e.target.value))}
        className="appearance-none bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/40 cursor-pointer"
      >
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
