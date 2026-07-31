import type { ReactNode } from 'react'

export function Card({ children, className = '', noPad = false }: { children: ReactNode; className?: string; noPad?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${noPad ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-600 text-sm">{title}</p>
      {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin ${className}`} />
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
}
