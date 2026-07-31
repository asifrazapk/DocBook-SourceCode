import { useState, useRef, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeColorPicker({ light = false }: { light?: boolean }) {
  const { presetId, presets, setPreset, colors } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme color"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          light ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <Palette size={13} />
        <span className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: colors.primary }} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl border border-slate-200 shadow-lg z-50 p-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 py-1">Theme color</p>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPreset(p.id)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.primary }} />
              <span className="flex-1 text-left">{p.label}</span>
              {presetId === p.id && <Check size={13} className="text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
