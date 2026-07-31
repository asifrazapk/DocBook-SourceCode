/**
 * Shared design tokens for the I-DocAssistance admin + patient chat UI.
 * Centralised here so the "professional clinic" palette stays consistent
 * across pages instead of hard-coded hex values scattered through JSX.
 */

export const COLORS = {
  ink: '#0F172A', // near-black slate for sidebars/headers
  inkSoft: '#1E293B',
  surface: '#F7F9F9', // app background
  border: '#E2E8F0',
  accent: '#2563EB', // blue accent for secondary actions/links
} as const

export const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  rescheduled: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  completed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
}

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending
}

export const AVATAR_COLORS = ['#0F5B4E', '#1D4ED8', '#7C3AED', '#B45309', '#BE185D', '#0891B2']

export function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
