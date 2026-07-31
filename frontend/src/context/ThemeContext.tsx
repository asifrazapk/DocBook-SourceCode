import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface ThemeColors {
  primary: string
  primaryDark: string
  primaryLight: string
}

export interface ThemePreset extends ThemeColors {
  id: string
  label: string
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'teal', label: 'Teal', primary: '#0F5B4E', primaryDark: '#0B4239', primaryLight: '#E6F3F0' },
  { id: 'blue', label: 'Blue', primary: '#1D4ED8', primaryDark: '#1E3A8A', primaryLight: '#EFF6FF' },
  { id: 'purple', label: 'Purple', primary: '#7C3AED', primaryDark: '#5B21B6', primaryLight: '#F5F3FF' },
  { id: 'maroon', label: 'Maroon', primary: '#9F1239', primaryDark: '#7A0E2C', primaryLight: '#FFF1F2' },
]

const STORAGE_KEY = 'idoc_theme_preset'

interface ThemeCtx {
  presetId: string
  colors: ThemeColors
  presets: ThemePreset[]
  setPreset: (id: string) => void
}

const Ctx = createContext<ThemeCtx>({
  presetId: THEME_PRESETS[0].id,
  colors: THEME_PRESETS[0],
  presets: THEME_PRESETS,
  setPreset: () => {},
})

export function useTheme() {
  return useContext(Ctx)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetId] = useState(() => localStorage.getItem(STORAGE_KEY) ?? THEME_PRESETS[0].id)

  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0]

  useEffect(() => {
    // Also expose as CSS variables in case any plain-CSS styling wants them.
    const root = document.documentElement
    root.style.setProperty('--color-primary', preset.primary)
    root.style.setProperty('--color-primary-dark', preset.primaryDark)
    root.style.setProperty('--color-primary-light', preset.primaryLight)
  }, [preset])

  const setPreset = (id: string) => {
    setPresetId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <Ctx.Provider value={{ presetId, colors: preset, presets: THEME_PRESETS, setPreset }}>
      {children}
    </Ctx.Provider>
  )
}
