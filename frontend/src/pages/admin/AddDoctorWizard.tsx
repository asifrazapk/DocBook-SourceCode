import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { createDoctorWithAvailability, type Doctor, type WeeklyAvailabilityEntry } from '../../services/api'
import Button from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useTheme } from '../../context/ThemeContext'
import WeeklyAvailabilityEditor, { emptyWeek, flattenWeek, type WeekState } from '../../components/WeeklyAvailabilityEditor'

interface Props {
  clinicId: number
  onClose: () => void
  onCreated: (doctor: Doctor) => void
}

export default function AddDoctorWizard({ clinicId, onClose, onCreated }: Props) {
  const toast = useToast()
  const { colors } = useTheme()
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — doctor info
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [durationMode, setDurationMode] = useState<'options' | 'custom'>('options')
  const [durationOption, setDurationOption] = useState(30)
  const [customDuration, setCustomDuration] = useState(30)
  const [step1Error, setStep1Error] = useState('')

  // Step 2 — weekly availability (shared vertical editor, same component the
  // standalone Schedule modal uses, so the two never drift apart visually).
  const [week, setWeek] = useState<WeekState>(emptyWeek)
  const [submitting, setSubmitting] = useState(false)
  const [step2Error, setStep2Error] = useState('')

  const duration = durationMode === 'options' ? durationOption : customDuration

  const goToStep2 = () => {
    if (!name.trim() || !specialty.trim()) {
      setStep1Error('Full name and specialty are required.')
      return
    }
    if (durationMode === 'custom' && (customDuration < 5 || customDuration > 480)) {
      setStep1Error('Enter duration between 5-480 minutes (5 minutes to 8 hours).')
      return
    }
    setStep1Error('')
    setStep(2)
  }

  const submit = async () => {
    setSubmitting(true)
    setStep2Error('')
    try {
      const entries: WeeklyAvailabilityEntry[] = flattenWeek(week).map((e) => ({
        ...e,
        slot_duration_minutes: duration,
      }))
      const res = await createDoctorWithAvailability(
        {
          clinic_id: clinicId,
          name,
          specialty,
          bio: bio || null,
          email: email || null,
          phone: phone || null,
          default_slot_duration_minutes: duration,
        },
        entries
      )
      onCreated(res.data)
      toast.show(`Dr. ${name} added.`)
      if (res.data.availability_warning) {
        toast.show(res.data.availability_warning, 'info')
      }
    } catch {
      setStep2Error('Could not save this doctor. Please check the details and try again.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add New Doctor</h2>
              <p className="text-xs text-slate-500 mt-0.5">Complete the doctor profile and set availability</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4 justify-center">
            <StepDot active={step >= 1} label={1} color={colors.primary} />
            <div className="w-16 h-0.5" style={{ backgroundColor: step >= 2 ? colors.primary : '#E2E8F0' }} />
            <StepDot active={step >= 2} label={2} color={colors.primary} />
          </div>
          <p className="text-center text-xs font-semibold text-slate-500 mt-2">
            {step === 1 ? 'Doctor Information — Step 1 of 2' : 'Availability Schedule — Step 2 of 2'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 bg-slate-50/60">
          {step === 1 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              {step1Error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{step1Error}</p>}
              <Field label="Full Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Siddharth" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email Address" required>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@clinic.com" />
                </Field>
                <Field label="Phone Number" required>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+918839464025" />
                </Field>
              </div>
              <Field label="Specialty" required>
                <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="General Physician" />
              </Field>
              <Field label="Bio">
                <Textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short professional bio…" />
              </Field>

              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-2">Appointment Duration (minutes) *</span>
                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={durationMode === 'options'}
                      onChange={() => setDurationMode('options')}
                      style={{ accentColor: colors.primary }}
                    />
                    Select from options
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={durationMode === 'custom'}
                      onChange={() => setDurationMode('custom')}
                      style={{ accentColor: colors.primary }}
                    />
                    Custom minutes
                  </label>
                </div>
                {durationMode === 'options' ? (
                  <div className="flex gap-2">
                    {[15, 20, 30, 45, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => setDurationOption(m)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                        style={
                          durationOption === m
                            ? { backgroundColor: colors.primary, borderColor: colors.primary, color: 'white' }
                            : { borderColor: '#E2E8F0', color: '#475569' }
                        }
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(Number(e.target.value))}
                      className="w-32"
                    />
                    <span className="text-sm text-slate-500">minutes</span>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Enter duration between 5-480 minutes (5 minutes to 8 hours).</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="font-semibold text-slate-900 text-sm">Weekly Availability</p>
              <p className="text-xs text-slate-500 mb-4">Set when {name || 'the doctor'} is typically available for appointments</p>
              {step2Error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{step2Error}</p>}
              <WeeklyAvailabilityEditor week={week} onChange={setWeek} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={() => (step === 1 ? onClose() : setStep(1))}>
            Previous
          </Button>
          {step === 1 ? (
            <Button size="sm" onClick={goToStep2}>Next</Button>
          ) : (
            <Button size="sm" icon={<Plus size={14} />} onClick={submit} loading={submitting}>
              Add doctor
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepDot({ active, label, color }: { active: boolean; label: number; color: string }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'text-white' : 'text-slate-400'}`}
      style={{ backgroundColor: active ? color : '#E2E8F0' }}
    >
      {label}
    </div>
  )
}
