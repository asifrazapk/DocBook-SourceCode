import { useEffect, useState } from 'react'
import { Mail, Save, Globe, Bell, MessageSquareText } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useNotifications } from '../../context/NotificationContext'
import {
  getEmailSettings,
  updateEmailSettings,
  getGeneralSettings,
  updateGeneralSettings,
  getMessageTemplates,
  updateMessageTemplates,
} from '../../services/api'
import { Card, PageHeader, Spinner, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useTheme } from '../../context/ThemeContext'

export default function SettingsPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const { setEnabled: setNotificationsEnabledGlobally } = useNotifications()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'general' | 'templates' | 'email'>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    mail_username: '',
    mail_password: '',
    mail_from: '',
    mail_port: 587,
    mail_server: '',
  })
  const [passwordTouched, setPasswordTouched] = useState(false)

  const [generalLoading, setGeneralLoading] = useState(true)
  const [generalSaving, setGeneralSaving] = useState(false)
  const [defaultLanguage, setDefaultLanguage] = useState<'en' | 'ur'>('en')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesSaving, setTemplatesSaving] = useState(false)
  const [patientTemplate, setPatientTemplate] = useState('')
  const [doctorTemplate, setDoctorTemplate] = useState('')

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    getEmailSettings(clinicId)
      .then((r) => {
        setForm({ ...r.data, mail_password: '' })
        setPasswordTouched(false)
      })
      .finally(() => setLoading(false))

    setGeneralLoading(true)
    getGeneralSettings(clinicId)
      .then((r) => {
        setDefaultLanguage(r.data.default_language)
        setNotificationsEnabled(r.data.notifications_enabled)
      })
      .finally(() => setGeneralLoading(false))

    setTemplatesLoading(true)
    getMessageTemplates(clinicId)
      .then((r) => {
        setPatientTemplate(r.data.patient_confirmation)
        setDoctorTemplate(r.data.doctor_notification)
      })
      .finally(() => setTemplatesLoading(false))
  }, [clinicId])

  const save = async () => {
    if (!clinicId) return
    setSaving(true)
    try {
      const payload = { ...form }
      if (!passwordTouched) delete (payload as any).mail_password // keep existing password
      const res = await updateEmailSettings(clinicId, payload)
      setForm({ ...res.data, mail_password: '' })
      setPasswordTouched(false)
      toast.show('Email settings saved.')
    } catch {
      toast.show('Could not save settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveGeneral = async () => {
    if (!clinicId) return
    setGeneralSaving(true)
    try {
      const res = await updateGeneralSettings(clinicId, {
        default_language: defaultLanguage,
        notifications_enabled: notificationsEnabled,
      })
      setNotificationsEnabledGlobally(res.data.notifications_enabled)
      toast.show('General settings saved.')
    } catch {
      toast.show('Could not save settings.', 'error')
    } finally {
      setGeneralSaving(false)
    }
  }

  const saveTemplates = async () => {
    if (!clinicId) return
    setTemplatesSaving(true)
    try {
      await updateMessageTemplates(clinicId, {
        patient_confirmation: patientTemplate,
        doctor_notification: doctorTemplate,
      })
      toast.show('Message templates saved.')
    } catch {
      toast.show('Could not save templates.', 'error')
    } finally {
      setTemplatesSaving(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="App settings" subtitle="Configure how I-DocAssistance behaves for this clinic." />

      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { key: 'general', label: 'General', icon: Globe },
          { key: 'templates', label: 'Message templates', icon: MessageSquareText },
          { key: 'email', label: 'Email / SMTP', icon: Mail },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px"
              style={{
                borderColor: active ? colors.primary : 'transparent',
                color: active ? colors.primary : '#94A3B8',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'general' && (
        <Card>
          {generalLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Default chat language" hint="Used when a patient's first message doesn't clearly indicate English or Urdu.">
                <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as 'en' | 'ur')}>
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                </Select>
              </Field>

              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <Bell size={15} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">In-app notifications</p>
                    <p className="text-xs text-slate-400">Show a notification when a new appointment is booked.</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotificationsEnabled((v) => !v)}
                  className="w-10 h-5.5 rounded-full relative transition-colors flex-shrink-0"
                  style={{ backgroundColor: notificationsEnabled ? colors.primary : '#CBD5E1', height: 22, width: 40 }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                    style={{ transform: notificationsEnabled ? 'translateX(20px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              <div className="pt-1 flex justify-end">
                <Button icon={<Save size={14} />} onClick={saveGeneral} loading={generalSaving}>
                  Save general settings
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'templates' && (
        <Card>
          <p className="text-xs text-slate-400 mb-4">
            Sent automatically when an appointment is confirmed. Available placeholders: {'{patient_name}'}, {'{doctor_name}'},{' '}
            {'{clinic_name}'}, {'{appointment_date}'}, {'{appointment_time}'}, {'{reason}'}.
          </p>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Sent to the patient">
                <Textarea rows={5} value={patientTemplate} onChange={(e) => setPatientTemplate(e.target.value)} />
              </Field>
              <Field label="Sent to the doctor">
                <Textarea rows={5} value={doctorTemplate} onChange={(e) => setDoctorTemplate(e.target.value)} />
              </Field>
              <div className="pt-1 flex justify-end">
                <Button icon={<Save size={14} />} onClick={saveTemplates} loading={templatesSaving}>
                  Save templates
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'email' && (
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <SectionLabel>Sender</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From address" hint="Shown as the sender, e.g. I-DocAssistance <noreply@clinic.pk>">
                  <Input value={form.mail_from} onChange={(e) => setForm({ ...form, mail_from: e.target.value })} />
                </Field>
                <Field label="SMTP username">
                  <Input value={form.mail_username} onChange={(e) => setForm({ ...form, mail_username: e.target.value })} />
                </Field>
              </div>

              <SectionLabel>Server</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP server">
                  <Input value={form.mail_server} onChange={(e) => setForm({ ...form, mail_server: e.target.value })} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="SMTP port">
                  <Input type="number" value={form.mail_port} onChange={(e) => setForm({ ...form, mail_port: Number(e.target.value) })} />
                </Field>
              </div>

              <SectionLabel>Credentials</SectionLabel>
              <Field label="SMTP password" hint="Leave blank to keep the currently saved password.">
                <Input
                  type="password"
                  value={form.mail_password}
                  onChange={(e) => {
                    setForm({ ...form, mail_password: e.target.value })
                    setPasswordTouched(true)
                  }}
                  placeholder="••••••••"
                />
              </Field>

              <div className="pt-2 flex justify-end">
                <Button icon={<Save size={14} />} onClick={save} loading={saving}>
                  Save settings
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
