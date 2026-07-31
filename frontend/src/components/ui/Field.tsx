import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

const baseCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/40 focus:border-teal-600 transition-colors placeholder:text-slate-400'

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label?: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-semibold text-slate-600 mb-1.5">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`${baseCls} ${className}`} {...rest} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={`${baseCls} resize-none ${className}`} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select className={`${baseCls} ${className}`} {...rest}>
      {children}
    </select>
  )
}
