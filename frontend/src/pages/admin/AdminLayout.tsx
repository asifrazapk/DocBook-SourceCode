import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  Stethoscope,
  Users,
  HelpCircle,
  Building2,
  BarChart3,
  MessagesSquare,
  CreditCard,
  FileSpreadsheet,
  Settings as SettingsIcon,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { COLORS, initials } from '../../theme'
import { useTheme } from '../../context/ThemeContext'
import ClinicSelector from '../../components/ClinicSelector'
import ThemeColorPicker from '../../components/ThemeColorPicker'
import NotificationBell from '../../components/NotificationBell'
import { useNotifications } from '../../context/NotificationContext'
import { useClinic } from '../../context/ClinicContext'
import { getGeneralSettings, getRecentAppointments } from '../../services/api'

const APP_NAME = 'I-DocAssistance'
const SIDEBAR_STORAGE_KEY = 'idoc_sidebar_collapsed'

const NAV_ITEMS = [
  { to: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: 'appointments', icon: CalendarCheck, label: 'Appointments' },
  { to: 'doctors', icon: Stethoscope, label: 'Doctors' },
  { to: 'patients', icon: Users, label: 'Patients' },
  { to: 'conversations', icon: MessagesSquare, label: 'Conversations' },
  { to: 'faqs', icon: HelpCircle, label: 'FAQs' },
  { to: 'clinics', icon: Building2, label: 'Clinics' },
  { to: 'analytics', icon: BarChart3, label: 'Analytics' },
  { to: 'reports', icon: FileSpreadsheet, label: 'Reports' },
  { to: 'billing', icon: CreditCard, label: 'Billing' },
  { to: 'settings', icon: SettingsIcon, label: 'App settings' },
]

export default function AdminLayout() {
  const { clinic, clinicId, error } = useClinic()
  const { colors } = useTheme()
  const { setEnabled, add: notify } = useNotifications()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1')

  // Sync the notification-enabled setting whenever the clinic changes (or a
  // save on the Settings page updates it -- AdminLayout re-fetches on every
  // clinic switch, which is good enough since it's a low-frequency setting).
  useEffect(() => {
    if (!clinicId) return
    getGeneralSettings(clinicId)
      .then((r) => setEnabled(r.data.notifications_enabled))
      .catch(() => setEnabled(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Poll for newly created appointments -- this is what makes a booking made
  // via the patient chat (a different browser/session entirely) show up as a
  // notification here just as reliably as one made in the admin panel.
  useEffect(() => {
    if (!clinicId) return
    let since = new Date().toISOString()
    let cancelled = false

    const poll = async () => {
      try {
        const res = await getRecentAppointments(clinicId, since)
        if (cancelled) return
        for (const appt of res.data) {
          const who = `${appt.patient_name ?? 'a patient'}${appt.doctor_name ? ` with ${appt.doctor_name}` : ''}`
          notify(
            appt.status === 'pending'
              ? `New appointment request from ${who} on ${appt.appointment_date} — needs confirmation.`
              : `New appointment booked for ${who} on ${appt.appointment_date}.`
          )
        }
        if (res.data.length > 0) since = new Date().toISOString()
      } catch {
        /* transient network hiccup — try again next tick */
      }
    }

    const interval = setInterval(poll, 20000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const currentNav = NAV_ITEMS.find((n) => location.pathname.includes(`/admin/${n.to}`))

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
      {/* Sidebar */}
      <aside
        className={`flex flex-col flex-shrink-0 transition-all duration-200 relative bg-white border-r border-slate-200 ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <div className={`px-5 py-5 flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : ''}`}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` }}
          >
            I
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-slate-900 font-bold text-sm leading-tight truncate">{APP_NAME}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : ''
                } ${isActive ? '' : 'text-slate-500 hover:bg-slate-50'}`
              }
              style={({ isActive }) => (isActive ? { backgroundColor: `${colors.primary}14`, color: colors.primary } : {})}
            >
              <Icon size={16} strokeWidth={2} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              localStorage.removeItem('medibot_token')
              window.location.href = '/'
            }}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={16} />
            {!collapsed && 'Logout'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 gap-4">
          <div className="flex items-center gap-1.5 text-sm flex-shrink-0">
            <span className="font-semibold text-slate-800">{currentNav?.label ?? 'Dashboard'}</span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            <ClinicSelector />
            <ThemeColorPicker />
            <NotificationBell />
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold relative flex-shrink-0"
                style={{ backgroundColor: colors.primary }}
              >
                {clinic ? initials(clinic.name) : 'A'}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
              </div>
              <div className="hidden lg:block min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{clinic?.name ?? 'Admin'}</p>
                <p className="text-[11px] text-slate-400">Admin</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">{error}</div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
