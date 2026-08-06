import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Stethoscope, UserPlus, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { createClinic, createDoctorWithAvailability, registerUser } from '../services/api'
import WeeklyAvailabilityEditor, { emptyWeek, flattenWeek, type WeekState } from '../components/WeeklyAvailabilityEditor'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const STEPS = ['Clinic', 'First doctor', 'Your account', 'Done']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [clinicName, setClinicName] = useState('')
  const [slug, setSlug] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [doctorName, setDoctorName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [week, setWeek] = useState<WeekState>(emptyWeek())

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const [createdClinicId, setCreatedClinicId] = useState<number | null>(null)
  const [createdSlug, setCreatedSlug] = useState('')

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const finishStep1 = () => {
    if (!clinicName.trim() || !slug.trim()) {
      setError('Clinic name and a URL slug are required.')
      return
    }
    setError('')
    next()
  }

  const finishStep2 = async () => {
    setSubmitting(true)
    setError('')
    try {
      const clinic = await createClinic({
        name: clinicName,
        slug,
        address,
        phone,
        email,
        opening_hours: null,
        timezone: 'Asia/Karachi',
        logo_url: null,
      })
      setCreatedClinicId(clinic.data.id)
      setCreatedSlug(clinic.data.slug)

      if (doctorName.trim() && specialty.trim()) {
        const entries = flattenWeek(week)
        await createDoctorWithAvailability(
          { clinic_id: clinic.data.id, name: doctorName, specialty, default_slot_duration_minutes: 30 },
          entries
        )
      }
      next()
    } catch {
      setError('Could not create the clinic — the URL slug may already be taken.')
    } finally {
      setSubmitting(false)
    }
  }

  const finishStep3 = async () => {
    if (!adminName.trim() || !adminEmail.trim() || adminPassword.length < 6) {
      setError('Please fill in your name, email, and a password of at least 6 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await registerUser({ name: adminName, email: adminEmail, password: adminPassword, role: 'admin', clinic_id: createdClinicId ?? undefined })
      next()
    } catch {
      setError('Could not create that account — the email may already be registered.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= step ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-400'
                }`}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-teal-700' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

          {step === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} className="text-teal-700" />
                <h1 className="font-bold text-slate-900">Your clinic</h1>
              </div>
              <div className="space-y-3">
                <Field label="Clinic name" required>
                  <input
                    value={clinicName}
                    onChange={(e) => {
                      setClinicName(e.target.value)
                      setSlug(slugify(e.target.value))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50"
                  />
                </Field>
                <Field label="URL slug" required hint="Used in your public booking link">
                  <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                </Field>
                <Field label="Address">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                  </Field>
                  <Field label="Email">
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                  </Field>
                </div>
              </div>
              <button onClick={finishStep1} className="w-full mt-5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope size={18} className="text-teal-700" />
                <h1 className="font-bold text-slate-900">Your first doctor</h1>
              </div>
              <p className="text-xs text-slate-400 mb-4">Optional — you can skip this and add doctors later from the admin panel.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Doctor name">
                    <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Ayesha Khan" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                  </Field>
                  <Field label="Specialty">
                    <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="General Physician" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                  </Field>
                </div>
                {doctorName && specialty && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Weekly availability</p>
                    <WeeklyAvailabilityEditor week={week} onChange={setWeek} />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={back} className="px-4 py-2.5 text-sm font-semibold text-slate-500 flex items-center gap-1">
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={finishStep2}
                  disabled={submitting}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {submitting ? 'Creating clinic…' : 'Continue'} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={18} className="text-teal-700" />
                <h1 className="font-bold text-slate-900">Your admin account</h1>
              </div>
              <div className="space-y-3">
                <Field label="Your name" required>
                  <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                </Field>
                <Field label="Email" required>
                  <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                </Field>
                <Field label="Password" required hint="At least 6 characters">
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50" />
                </Field>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={back} className="px-4 py-2.5 text-sm font-semibold text-slate-500 flex items-center gap-1">
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={finishStep3}
                  disabled={submitting}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {submitting ? 'Creating account…' : 'Finish'} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Check size={22} />
              </div>
              <h1 className="font-bold text-slate-900 mb-1">{clinicName} is ready!</h1>
              <p className="text-sm text-slate-500 mb-5">Here's what to do next.</p>
              <div className="space-y-2 text-left">
                <button onClick={() => navigate('/admin/dashboard')} className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-700">Go to admin panel</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
                <button onClick={() => navigate(`/book/${createdSlug}`)} className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-700">View your public booking page</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
                <button onClick={() => navigate('/')} className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-700">Try the patient chat</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}
