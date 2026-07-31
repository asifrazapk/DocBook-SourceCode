import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getClinics, type Clinic } from '../services/api'

const STORAGE_KEY = 'medibot_clinic_id'

interface ClinicCtx {
  clinics: Clinic[]
  clinic: Clinic | null
  clinicId: number | null
  loading: boolean
  error: string | null
  setClinicId: (id: number) => void
  reload: () => void
}

const Ctx = createContext<ClinicCtx>({
  clinics: [],
  clinic: null,
  clinicId: null,
  loading: true,
  error: null,
  setClinicId: () => {},
  reload: () => {},
})

export function useClinic() {
  return useContext(Ctx)
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicId, setClinicIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    getClinics()
      .then((res) => {
        setClinics(res.data)
        setError(null)
        // If nothing selected yet (or the stored id no longer exists), default to the first clinic.
        setClinicIdState((prev) => {
          if (prev && res.data.some((c) => c.id === prev)) return prev
          return res.data[0]?.id ?? null
        })
      })
      .catch(() => setError('Could not load clinics. Is the API reachable?'))
      .finally(() => setLoading(false))
  }, [reloadTick])

  const setClinicId = (id: number) => {
    setClinicIdState(id)
    localStorage.setItem(STORAGE_KEY, String(id))
  }

  const clinic = clinics.find((c) => c.id === clinicId) ?? null

  return (
    <Ctx.Provider
      value={{ clinics, clinic, clinicId, loading, error, setClinicId, reload: () => setReloadTick((t) => t + 1) }}
    >
      {children}
    </Ctx.Provider>
  )
}
