import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export interface SearchableOption {
  value: string | number
  label: string
  sublabel?: string
}

interface Props {
  options: SearchableOption[]
  value: string | number | ''
  onChange: (value: string | number) => void
  placeholder?: string
  allowEmpty?: string // label for a "none" option, e.g. "Unassigned"
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search…', allowEmpty }: Props) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const selected = options.find((o) => String(o.value) === String(value))
  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : allowEmpty ?? placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-slate-100">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-8 pr-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {allowEmpty && (
              <button
                onClick={() => {
                  onChange('')
                  setOpen(false)
                  setQuery('')
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-500"
              >
                {allowEmpty}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 text-left"
                >
                  <span>
                    <span className="text-slate-800 font-medium">{o.label}</span>
                    {o.sublabel && <span className="text-slate-400 ml-1.5 text-xs">{o.sublabel}</span>}
                  </span>
                  {String(value) === String(o.value) && <Check size={13} style={{ color: colors.primary }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
