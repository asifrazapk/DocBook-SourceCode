import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import AppointmentsPage from './pages/admin/AppointmentsPage'
import DoctorDayView from './pages/admin/DoctorDayView'
import DoctorsPage from './pages/admin/DoctorsPage'
import PatientsPage from './pages/admin/PatientsPage'
import PatientDetailPage from './pages/admin/PatientDetailPage'
import FaqsPage from './pages/admin/FaqsPage'
import ClinicsPage from './pages/admin/ClinicsPage'
import AnalyticsPage from './pages/admin/AnalyticsPage'
import ConversationsPage from './pages/admin/ConversationsPage'
import SettingsPage from './pages/admin/SettingsPage'
import BillingPage from './pages/admin/BillingPage'
import ReportsPage from './pages/admin/ReportsPage'
import { ClinicProvider } from './context/ClinicContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import { ToastProvider } from './components/ui/Toast'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NotificationProvider>
          <ClinicProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<ChatPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="appointments" element={<DoctorDayView />} />
                  <Route path="appointments/list" element={<AppointmentsPage />} />
                  <Route path="doctors" element={<DoctorsPage />} />
                  <Route path="patients" element={<PatientsPage />} />
                  <Route path="patients/:id" element={<PatientDetailPage />} />
                  <Route path="faqs" element={<FaqsPage />} />
                  <Route path="clinics" element={<ClinicsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="conversations" element={<ConversationsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ClinicProvider>
        </NotificationProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
