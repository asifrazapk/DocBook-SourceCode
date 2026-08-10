import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('I-DocAssistance_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginAttempt = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('I-DocAssistance_token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api

// ---------------------------------------------------------------------------
// Shared pagination shape
// ---------------------------------------------------------------------------
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Clinic {
  id: number
  name: string
  slug: string
  address: string
  phone: string
  email: string
  opening_hours: Record<string, string> | null
  timezone: string
  logo_url: string | null
  is_active: boolean
}

export interface ChatResponse {
  reply: string
  session_id: string
  quick_replies: string[]
  message_id: string
  language: string
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Doctor {
  id: number
  clinic_id: number
  name: string
  specialty: string
  bio: string | null
  email: string | null
  phone: string | null
  years_of_experience: number | null
  graduation_year: number | null
  education: string | null
  default_slot_duration_minutes: number
  is_active: boolean
  appointments_today?: number
  local_created_at?: string
}

export interface Patient {
  id: number
  clinic_id: number
  name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  age: number | null
  gender: string | null
  city: string | null
  address: string | null
  notes: string | null
  source: 'chat' | 'manual'
  is_active: boolean
  created_at?: string
  local_created_at?: string
}

export interface Appointment {
  id: number
  clinic_id: number
  doctor_id: number | null
  patient_id: number
  slot_id: number | null
  appointment_date: string
  appointment_time: string
  reason: string | null
  status: string
  status_note?: string | null
  language: string
  is_telemedicine?: boolean
  video_room_key?: string | null
  reminder_sent_at?: string | null
  is_active: boolean
  // Enriched by the backend for display convenience:
  patient_name?: string | null
  patient_phone?: string | null
  patient_email?: string | null
  doctor_name?: string | null
}

export interface FAQ {
  id: number
  clinic_id: number
  question_en: string
  question_ur: string | null
  answer_en: string
  answer_ur: string | null
  category: string | null
}

export interface DoctorAvailability {
  id: number
  doctor_id: number
  day_of_week: number // 0=Sunday ... 6=Saturday
  start_time: string
  end_time: string
  break_start_time: string | null
  break_end_time: string | null
  slot_duration_minutes: number
  is_active: boolean
}

export interface DoctorLeave {
  id: number
  doctor_id: number
  leave_date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
  is_active: boolean
}

export interface OpenSlot {
  start_time: string
  end_time: string
}

export interface DoctorDaySchedule {
  doctor: Doctor
  date: string
  stats: {
    total_slots: number
    booked: number
    available: number
    rescheduled: number
  }
  available_slots: OpenSlot[]
  appointments: Appointment[]
}

export interface AnalyticsMetrics {
  conversations: number
  messages: number
  avg_daily_messages: number
  users: number
  avg_weekly_users: number
  feedback_positivity_pct: number | null
  feedback_completion_pct: number | null
  llm_eval_score: number | null
}

export interface AnalyticsOverview {
  range: { start_date: string; end_date: string }
  totals: { conversation_count: number; message_count: number }
  metrics: AnalyticsMetrics
  daily: { date: string; conversation_count: number; message_count: number }[]
  feedback: {
    breakdown: { feedback_type: number; feedback_value: string; count: number }[]
    total_with_feedback: number
  }
  llm_evaluation: {
    overall: {
      evaluation_count: number
      avg_relevance: number | null
      avg_correctness: number | null
      avg_faithfulness: number | null
      avg_completeness: number | null
      avg_overall_score: number | null
      hallucination_count: number
    }
    daily: {
      date: string
      evaluation_count: number
      avg_overall_score: number | null
      avg_relevance: number | null
      avg_correctness: number | null
      avg_faithfulness: number | null
      avg_completeness: number | null
      hallucination_count: number
    }[]
  }
  recent_messages: {
    message_id: string
    conversation_id: number
    message_text: string | null
    llm_response: string | null
    feedback_type: number | null
    feedback_value: string | null
    created_at: string | null
    overall_score: number | null
    is_hallucination: boolean | null
  }[]
}

export interface ConversationMessage {
  message_id: string
  conversation_id: number
  session_id: string
  message_text: string | null
  llm_response: string | null
  feedback_type: number | null
  feedback_value: string | null
  local_created_at: string
  server_created_at: string
  overall_score: number | null
  relevance: number | null
  correctness: number | null
  faithfulness: number | null
  completeness: number | null
  is_hallucination: boolean | null
}

// ---------------------------------------------------------------------------
// Clinics
// ---------------------------------------------------------------------------
export const getClinics = () => api.get<Clinic[]>('/clinics')
export const getClinicsPaginated = (page: number, pageSize: number, q?: string) =>
  api.get<Paginated<Clinic>>('/clinics/paginated', { params: { page, page_size: pageSize, q: q || undefined } })
export const getClinic = (slug: string) => api.get<Clinic>(`/clinics/${slug}`)
export const createClinic = (data: Omit<Clinic, 'id' | 'is_active'>) => api.post<Clinic>('/clinics', data)
export const updateClinic = (id: number, data: Partial<Omit<Clinic, 'id'>>) =>
  api.patch<Clinic>(`/clinics/${id}`, data)

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export const sendMessage = (
  clinicId: number,
  sessionId: string,
  message: string,
  patientPhone?: string,
  patientName?: string,
  language?: string
) =>
  api.post<ChatResponse>('/chat', {
    clinic_id: clinicId,
    session_id: sessionId,
    message,
    patient_phone: patientPhone,
    patient_name: patientName,
    language,
  })

export const getChatHistory = (clinicId: number, sessionId: string) =>
  api.get<ChatHistoryMessage[]>('/chat/history', { params: { clinic_id: clinicId, session_id: sessionId } })

export interface ChatConversationSummary {
  id: number
  session_id: string
  local_created_at: string
  language: string | null
  first_message: string | null
  last_activity: string | null
}

export const getChatConversations = (clinicId: number, phone: string, page = 1, pageSize = 20) =>
  api.get<Paginated<ChatConversationSummary>>('/chat/conversations', {
    params: { clinic_id: clinicId, phone, page, page_size: pageSize },
  })

export const submitChatFeedback = (messageId: string, feedbackType: 0 | 1, feedbackValue = '') =>
  api.post('/chat/feedback', { message_id: messageId, feedback_type: feedbackType, feedback_value: feedbackValue })

export interface AppNotification {
  id: number
  clinic_id: number
  message: string
  notification_type: string
  reference_id: number | null
  is_read: boolean
  server_created_at: string
}
export interface NotificationPage {
  items: AppNotification[]
  total: number
  unread_count: number
  page: number
  page_size: number
  has_more: boolean
}
export const getNotifications = (clinicId: number, page = 1, pageSize = 10) =>
  api.get<NotificationPage>('/notifications', { params: { clinic_id: clinicId, page, page_size: pageSize } })
export const markAllNotificationsRead = (clinicId: number) =>
  api.post<{ updated: number }>('/notifications/mark-all-read', null, { params: { clinic_id: clinicId } })

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------
export const getDoctors = (clinicId: number, page = 1, pageSize = 100, q?: string) =>
  api.get<Paginated<Doctor>>('/doctors', { params: { clinic_id: clinicId, page, page_size: pageSize, q: q || undefined } })

export const getDoctorsToday = (clinicId: number) =>
  api.get<Doctor[]>('/doctors/today', { params: { clinic_id: clinicId } })

export const getDoctor = (id: number) => api.get<Doctor>(`/doctors/${id}`)

export const createDoctor = (data: Omit<Doctor, 'id' | 'is_active'>) => api.post<Doctor>('/doctors', data)

export interface WeeklyAvailabilityEntry {
  day_of_week: number
  start_time: string
  end_time: string
  break_start_time?: string | null
  break_end_time?: string | null
  slot_duration_minutes?: number | null
}

export const createDoctorWithAvailability = (
  doctor: {
    clinic_id: number
    name: string
    specialty: string
    bio?: string | null
    email?: string | null
    phone?: string | null
    years_of_experience?: number | null
    graduation_year?: number | null
    education?: string | null
    default_slot_duration_minutes: number
  },
  weeklyAvailability: WeeklyAvailabilityEntry[]
) =>
  api.post<Doctor & { availability: DoctorAvailability[]; availability_warning: string | null }>('/doctors/with-availability', {
    doctor,
    weekly_availability: weeklyAvailability,
  })

export const updateDoctor = (id: number, data: Partial<Omit<Doctor, 'id'>>) =>
  api.patch<Doctor>(`/doctors/${id}`, data)
export const deleteDoctor = (id: number) => api.delete(`/doctors/${id}`)

export interface DoctorWithClinic extends Doctor {
  clinic_name: string
  clinic_slug: string
}
export const getAllDoctorsWithClinic = () => api.get<DoctorWithClinic[]>('/doctors/all-clinics')

// ---------------------------------------------------------------------------
// Doctor schedule: recurring availability, leaves, pre-generated slots
// ---------------------------------------------------------------------------
export const getDoctorAvailability = (doctorId: number) =>
  api.get<DoctorAvailability[]>(`/doctors/${doctorId}/availability`)

export const createDoctorAvailability = (
  doctorId: number,
  data: {
    days: number[]
    start_time: string
    end_time: string
    break_start_time?: string | null
    break_end_time?: string | null
    slot_duration_minutes?: number | null
  }
) => api.post<DoctorAvailability[]>(`/doctors/${doctorId}/availability`, data)

export const updateDoctorAvailability = (
  doctorId: number,
  availabilityId: number,
  data: Partial<Omit<DoctorAvailability, 'id' | 'doctor_id' | 'day_of_week'>>
) => api.patch<DoctorAvailability>(`/doctors/${doctorId}/availability/${availabilityId}`, data)

export const deleteDoctorAvailability = (doctorId: number, availabilityId: number) =>
  api.delete(`/doctors/${doctorId}/availability/${availabilityId}`)

export const getDoctorLeaves = (doctorId: number) => api.get<DoctorLeave[]>(`/doctors/${doctorId}/leaves`)

export const createDoctorLeave = (
  doctorId: number,
  data: { leave_date: string; start_time?: string | null; end_time?: string | null; reason?: string | null }
) => api.post<DoctorLeave>(`/doctors/${doctorId}/leaves`, data)

export const deleteDoctorLeave = (doctorId: number, leaveId: number) =>
  api.delete(`/doctors/${doctorId}/leaves/${leaveId}`)

export const getDoctorSlots = (doctorId: number, onDate: string) =>
  api.get<OpenSlot[]>(`/doctors/${doctorId}/slots`, { params: { on_date: onDate } })

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------
export const getPatients = (clinicId: number, page = 1, pageSize = 10, q?: string) =>
  api.get<Paginated<Patient>>('/patients', { params: { clinic_id: clinicId, page, page_size: pageSize, q: q || undefined } })

export const searchPatients = (clinicId: number, q: string) =>
  api.get<Patient[]>('/patients/search', { params: { clinic_id: clinicId, q, limit: 20 } })

export const getPatient = (id: number) => api.get<Patient>(`/patients/${id}`)
export const getPatientAppointments = (id: number) => api.get<Appointment[]>(`/patients/${id}/appointments`)

export interface PatientCreateInput {
  clinic_id: number
  name: string
  phone: string
  email?: string | null
  date_of_birth?: string | null
  age?: number | null
  gender?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
}

export const createPatient = (data: PatientCreateInput) => api.post<Patient>('/patients', data)
export const updatePatient = (id: number, data: Partial<Omit<Patient, 'id' | 'clinic_id'>>) =>
  api.patch<Patient>(`/patients/${id}`, data)
export const deletePatient = (id: number) => api.delete(`/patients/${id}`)

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
export interface AppointmentListParams {
  status?: string
  doctorId?: number
  startDate?: string
  endDate?: string
  q?: string
  page?: number
  pageSize?: number
}

export const getAppointments = (clinicId: number, params: AppointmentListParams = {}) =>
  api.get<Paginated<Appointment>>('/appointments', {
    params: {
      clinic_id: clinicId,
      status: params.status,
      doctor_id: params.doctorId,
      start_date: params.startDate,
      end_date: params.endDate,
      q: params.q || undefined,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    },
  })

export const getAppointment = (id: number) => api.get<Appointment>(`/appointments/${id}`)

export const getDoctorDaySchedule = (clinicId: number, doctorId: number, onDate: string) =>
  api.get<DoctorDaySchedule>('/appointments/doctor-day-schedule', {
    params: { clinic_id: clinicId, doctor_id: doctorId, on_date: onDate },
  })

export interface AppointmentCreateInput {
  clinic_id: number
  doctor_id: number | null
  patient_id?: number | null
  patient_name?: string | null
  patient_phone?: string | null
  patient_email?: string | null
  appointment_date: string
  appointment_times: string[] // one or more — books multiple slots in one call
  reason?: string | null
  language?: string
}

export interface AppointmentBookResult {
  booked: Appointment[]
  failed: { time: string; error: string }[]
}

export const createAppointment = (data: AppointmentCreateInput) =>
  api.post<AppointmentBookResult>('/appointments', data)

export const updateAppointment = (id: number, data: { status?: string; note?: string | null; is_telemedicine?: boolean }) =>
  api.patch<Appointment>(`/appointments/${id}`, data)

export const rescheduleAppointment = (
  id: number,
  data: { appointment_date?: string; appointment_time?: string; doctor_id?: number; note?: string | null }
) => api.post<Appointment>(`/appointments/${id}/reschedule`, data)

export const cancelAppointment = (id: number, note?: string | null) =>
  api.delete(`/appointments/${id}`, { data: note ? { note } : undefined })

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
export const getFAQs = (clinicId: number) => api.get<FAQ[]>('/faqs', { params: { clinic_id: clinicId } })
export const createFAQ = (data: Omit<FAQ, 'id'>) => api.post<FAQ>('/faqs', data)
export const updateFAQ = (id: number, data: Partial<FAQ>) => api.patch<FAQ>(`/faqs/${id}`, data)
export const deleteFAQ = (id: number) => api.delete(`/faqs/${id}`)

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------
export interface EmailSettings {
  mail_username: string
  mail_password: string // masked ("•••••••") when read back, blank if unset
  mail_from: string
  mail_port: number
  mail_server: string
}

export const getEmailSettings = (clinicId: number) =>
  api.get<EmailSettings>('/settings/email', { params: { clinic_id: clinicId } })

export const updateEmailSettings = (clinicId: number, data: Partial<EmailSettings>) =>
  api.put<EmailSettings>('/settings/email', data, { params: { clinic_id: clinicId } })

export interface GeneralSettings {
  default_language: 'en' | 'ur'
  notifications_enabled: boolean
}

export const getGeneralSettings = (clinicId: number) =>
  api.get<GeneralSettings>('/settings/general', { params: { clinic_id: clinicId } })

export const updateGeneralSettings = (clinicId: number, data: Partial<GeneralSettings>) =>
  api.put<GeneralSettings>('/settings/general', data, { params: { clinic_id: clinicId } })

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export const getAnalyticsOverview = (clinicId: number, startDate: string, endDate: string) =>
  api.get<AnalyticsOverview>('/analytics/overview', {
    params: { clinic_id: clinicId, start_date: startDate, end_date: endDate },
  })

// ---------------------------------------------------------------------------
// Conversations / messages (tabular view)
// ---------------------------------------------------------------------------
export const getConversationMessages = (
  clinicId: number,
  params: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
) =>
  api.get<Paginated<ConversationMessage>>('/conversations/messages', {
    params: {
      clinic_id: clinicId,
      start_date: params.startDate,
      end_date: params.endDate,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    },
  })

export interface ConversationThreadMessage {
  message_id: string
  conversation_id: number
  message_text: string | null
  llm_response: string | null
  feedback_type: number | null
  feedback_value: string | null
  local_created_at: string
  overall_score: number | null
}

export const getConversationThread = (clinicId: number, conversationId: number) =>
  api.get<ConversationThreadMessage[]>(`/conversations/${conversationId}/thread`, {
    params: { clinic_id: clinicId },
  })

// ---------------------------------------------------------------------------
// Medical records (prescription + report per appointment)
// ---------------------------------------------------------------------------
export interface MedicalRecord {
  id: number
  clinic_id: number
  appointment_id: number
  patient_id: number
  doctor_id: number | null
  diagnosis: string | null
  prescription: string | null
  notes: string | null
  local_created_at: string
  appointment_date?: string
  appointment_time?: string
  doctor_name?: string | null
}

export interface MedicalRecordUpsertInput {
  clinic_id: number
  appointment_id: number
  patient_id: number
  doctor_id?: number | null
  diagnosis?: string | null
  prescription?: string | null
  notes?: string | null
}

export const upsertMedicalRecord = (data: MedicalRecordUpsertInput) => api.post<MedicalRecord>('/medical-records', data)

export const getMedicalRecordForAppointment = (appointmentId: number) =>
  api.get<MedicalRecord>(`/medical-records/by-appointment/${appointmentId}`)

export const listMedicalRecordsForPatient = (patientId: number) =>
  api.get<MedicalRecord[]>(`/medical-records/by-patient/${patientId}`)

export interface ReportStats {
  total: number
  by_doctor: { doctor_name: string; count: number }[]
}

export const getReportStats = (clinicId: number, startDate?: string, endDate?: string) =>
  api.get<ReportStats>('/medical-records/stats', { params: { clinic_id: clinicId, start_date: startDate, end_date: endDate } })

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------
export interface Bill {
  id: number
  clinic_id: number
  appointment_id: number
  patient_id: number
  amount: number
  collected_by: string
  collected_at: string
  notes: string | null
  patient_name?: string
  appointment_date?: string
  doctor_name?: string | null
}

export interface BillCreateInput {
  clinic_id: number
  appointment_id: number
  amount: number
  collected_by: string
  collected_at?: string
  notes?: string | null
}

export const getBills = (clinicId: number, params: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}) =>
  api.get<Paginated<Bill>>('/bills', {
    params: {
      clinic_id: clinicId,
      start_date: params.startDate,
      end_date: params.endDate,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    },
  })

export const getBillsSummary = (clinicId: number, startDate?: string, endDate?: string) =>
  api.get<{ total_collected: number }>('/bills/summary', { params: { clinic_id: clinicId, start_date: startDate, end_date: endDate } })

export const createBill = (data: BillCreateInput) => api.post<Bill>('/bills', data)
export const deleteBill = (billId: number) => api.delete(`/bills/${billId}`)

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------
export interface MessageTemplates {
  patient_confirmation: string
  doctor_notification: string
}

export const getMessageTemplates = (clinicId: number) =>
  api.get<MessageTemplates>('/settings/message-templates', { params: { clinic_id: clinicId } })

export const updateMessageTemplates = (clinicId: number, data: Partial<MessageTemplates>) =>
  api.put<MessageTemplates>('/settings/message-templates', data, { params: { clinic_id: clinicId } })

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface AuthUser {
  sub?: string
  id?: number
  name: string
  email?: string
  role: 'admin' | 'doctor' | 'staff'
  clinic_id: number | null
  doctor_id: number | null
}

export const login = (email: string, password: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password })

export const registerUser = (data: { name: string; email: string; password: string; role?: string; clinic_id?: number; doctor_id?: number }) =>
  api.post<AuthUser>('/auth/register', data)

export const getMe = () => api.get<AuthUser>('/auth/me')

// ---------------------------------------------------------------------------
// Doctor portal (scoped to the logged-in doctor's JWT)
// ---------------------------------------------------------------------------
export const getMySchedule = (onDate: string) =>
  api.get<DoctorDaySchedule>('/doctor-portal/schedule', { params: { on_date: onDate } })

export const getMyAppointments = (status?: string, startDate?: string, endDate?: string) =>
  api.get<Appointment[]>('/doctor-portal/appointments', { params: { status, start_date: startDate, end_date: endDate } })

export const addMyPrescription = (data: { appointment_id: number; patient_id: number; diagnosis?: string | null; prescription?: string | null; notes?: string | null }) =>
  api.post('/doctor-portal/prescriptions', data)

export const rescheduleMyAppointment = (appointmentId: number, data: { new_date?: string; new_time?: string; note?: string | null }) =>
  api.post<Appointment>(`/doctor-portal/appointments/${appointmentId}/reschedule`, data)

export const cancelMyAppointment = (appointmentId: number, note?: string | null) =>
  api.post<Appointment>(`/doctor-portal/appointments/${appointmentId}/cancel`, { note })

export const enableMyTelemedicine = (appointmentId: number) =>
  api.post<Appointment>(`/doctor-portal/appointments/${appointmentId}/telemedicine`)

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------
export interface WaitlistEntry {
  id: number
  clinic_id: number
  doctor_id: number
  patient_id: number
  desired_date: string
  status: string
  patient_name?: string
  patient_phone?: string
  doctor_name?: string
}

export const getWaitlist = (clinicId: number) => api.get<WaitlistEntry[]>('/waitlist', { params: { clinic_id: clinicId } })

export const addToWaitlist = (data: { clinic_id: number; doctor_id: number; patient_id: number; desired_date: string }) =>
  api.post<WaitlistEntry>('/waitlist', data)

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export interface Review {
  id: number
  clinic_id: number
  appointment_id: number
  patient_id: number
  doctor_id: number | null
  rating: number
  comment: string | null
  is_public: boolean
  local_created_at: string
  patient_name?: string
  doctor_name?: string
}

export const getPublicReviews = (clinicId: number) => api.get<Review[]>('/reviews/public', { params: { clinic_id: clinicId } })
export const getAllReviews = (clinicId: number) => api.get<Review[]>('/reviews', { params: { clinic_id: clinicId } })
export const getReviewSummary = (clinicId: number) =>
  api.get<{ count: number; average: number }>('/reviews/summary', { params: { clinic_id: clinicId } })
export const submitReview = (data: { clinic_id: number; appointment_id: number; patient_id: number; doctor_id?: number | null; rating: number; comment?: string | null }) =>
  api.post<Review>('/reviews', data)
export const setReviewVisibility = (reviewId: number, isPublic: boolean) =>
  api.patch(`/reviews/${reviewId}/visibility`, { is_public: isPublic })

// ---------------------------------------------------------------------------
// Reminders (needs a real scheduler to call this automatically — see
// app/services/appointment_service.py's send_due_reminders docstring)
// ---------------------------------------------------------------------------
export const getMyAppointmentsByPhone = (clinicId: number, phone: string) =>
  api.get<Appointment[]>('/appointments/mine', { params: { clinic_id: clinicId, phone } })

export const patientRescheduleAppointment = (
  appointmentId: number,
  data: { clinic_id: number; phone: string; appointment_date?: string; appointment_time?: string }
) => api.post<Appointment>(`/appointments/mine/${appointmentId}/reschedule`, data)

export const patientCancelAppointment = (appointmentId: number, clinicId: number, phone: string) =>
  api.post<Appointment>(`/appointments/mine/${appointmentId}/cancel`, { clinic_id: clinicId, phone })

export const patientEnableTelemedicine = (appointmentId: number, clinicId: number, phone: string) =>
  api.post<Appointment>(`/appointments/mine/${appointmentId}/telemedicine`, { clinic_id: clinicId, phone })

export const getMyMedicalRecordsByPhone = (clinicId: number, phone: string) =>
  api.get<MedicalRecord[]>('/medical-records/mine', { params: { clinic_id: clinicId, phone } })

export const sendDueReminders = (clinicId: number) => api.post<{ checked: number; sent: number }>('/appointments/send-reminders', null, { params: { clinic_id: clinicId } })

// ---------------------------------------------------------------------------
// Voice chat (speech-to-text via Whisper, text-to-speech via ElevenLabs —
// both configured server-side; if either is unset the backend returns a
// clean 503 rather than failing silently)
// ---------------------------------------------------------------------------
export interface VoiceMessageResult {
  patient_text: string
  reply: string
  quick_replies: string[]
  message_id: string
  language: string
  reply_audio_base64: string | null
}

export const sendVoiceMessage = (
  clinicId: number,
  sessionId: string,
  message: string,
  patientPhone?: string,
  patientName?: string,
  language?: string
) =>
  api.post<VoiceMessageResult>('/voice/message', {
    clinic_id: clinicId,
    session_id: sessionId,
    message,
    patient_phone: patientPhone,
    patient_name: patientName,
    language,
  })
