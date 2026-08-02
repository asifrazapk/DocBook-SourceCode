import { useState } from 'react'
import { CalendarCheck, Users, Wallet, Stethoscope, Download } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import {
  getAppointments,
  getPatients,
  getBills,
  getDoctors,
  type Appointment,
  type Patient,
  type Bill,
  type Doctor,
} from '../../services/api'
import { Card, PageHeader, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { downloadCsv } from '../../utils/csv'

/** Loops through every page of a paginated endpoint (100 rows at a time) so
 * the exported report is complete, not just the first page. */
async function fetchAllPages<T>(fetchPage: (page: number) => Promise<{ items: T[]; total_pages: number }>): Promise<T[]> {
  const first = await fetchPage(1)
  let items = [...first.items]
  for (let p = 2; p <= first.total_pages; p++) {
    const next = await fetchPage(p)
    items = items.concat(next.items)
  }
  return items
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

interface ReportCardProps {
  icon: React.ReactNode
  title: string
  description: string
  hasDateRange?: boolean
  onDownload: (startDate?: string, endDate?: string) => Promise<void>
}

function ReportCard({ icon, title, description, hasDateRange, onDownload }: ReportCardProps) {
  const [startDate, setStartDate] = useState(daysAgoISO(29))
  const [endDate, setEndDate] = useState(todayISO())
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await onDownload(hasDateRange ? startDate : undefined, hasDateRange ? endDate : undefined)
    } catch {
      toast.show('Could not generate this report.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>

      {hasDateRange && (
        <div className="flex items-center gap-2 mb-3">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="!py-1.5 !text-xs" />
          <span className="text-slate-400 text-xs">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="!py-1.5 !text-xs" />
        </div>
      )}

      <Button size="sm" icon={downloading ? undefined : <Download size={14} />} onClick={handleDownload} loading={downloading} className="w-full">
        {downloading ? 'Preparing…' : 'Download CSV'}
      </Button>
    </Card>
  )
}

export default function ReportsPage() {
  const { clinicId } = useClinic()

  if (!clinicId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  const downloadAppointments = async (startDate?: string, endDate?: string) => {
    const items = await fetchAllPages<Appointment>((page) =>
      getAppointments(clinicId, { startDate, endDate, page, pageSize: 100 }).then((r) => r.data)
    )
    downloadCsv(
      `appointments_${startDate ?? 'all'}_${endDate ?? 'all'}`,
      items.map((a) => ({
        id: a.id,
        date: a.appointment_date,
        time: a.appointment_time,
        patient: a.patient_name ?? '',
        phone: a.patient_phone ?? '',
        doctor: a.doctor_name ?? '',
        status: a.status,
        reason: a.reason ?? '',
      }))
    )
  }

  const downloadPatients = async () => {
    const items = await fetchAllPages<Patient>((page) => getPatients(clinicId, page, 100).then((r) => r.data))
    downloadCsv(
      'patients',
      items.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email ?? '',
        age: p.age ?? '',
        gender: p.gender ?? '',
        city: p.city ?? '',
        source: p.source,
        added: p.local_created_at?.slice(0, 10) ?? '',
      }))
    )
  }

  const downloadBills = async (startDate?: string, endDate?: string) => {
    const items = await fetchAllPages<Bill>((page) =>
      getBills(clinicId, { startDate, endDate, page, pageSize: 100 }).then((r) => r.data)
    )
    downloadCsv(
      `bills_${startDate ?? 'all'}_${endDate ?? 'all'}`,
      items.map((b) => ({
        id: b.id,
        collected_at: b.collected_at?.slice(0, 16).replace('T', ' '),
        patient: b.patient_name ?? '',
        doctor: b.doctor_name ?? '',
        amount: b.amount,
        collected_by: b.collected_by,
        notes: b.notes ?? '',
      }))
    )
  }

  const downloadDoctors = async () => {
    const items = await fetchAllPages<Doctor>((page) => getDoctors(clinicId, page, 100).then((r) => r.data))
    downloadCsv(
      'doctors',
      items.map((d) => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        years_of_experience: d.years_of_experience ?? '',
        education: d.education ?? '',
        email: d.email ?? '',
        phone: d.phone ?? '',
        status: d.is_active ? 'Active' : 'Inactive',
        added: d.local_created_at?.slice(0, 10) ?? '',
      }))
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Download clinic data as CSV — opens directly in Excel or Google Sheets." />

      <div className="grid grid-cols-2 gap-4">
        <ReportCard
          icon={<CalendarCheck size={18} />}
          title="Appointments"
          description="Every appointment in a date range, with patient, doctor, and status."
          hasDateRange
          onDownload={downloadAppointments}
        />
        <ReportCard
          icon={<Wallet size={18} />}
          title="Bills / Payments"
          description="Every recorded payment in a date range, with amount and collected-by."
          hasDateRange
          onDownload={downloadBills}
        />
        <ReportCard
          icon={<Users size={18} />}
          title="Patients"
          description="The full patient list — contact info, demographics, and source."
          onDownload={downloadPatients}
        />
        <ReportCard
          icon={<Stethoscope size={18} />}
          title="Doctors"
          description="The full doctor roster — specialty, experience, and contact info."
          onDownload={downloadDoctors}
        />
      </div>
    </div>
  )
}
