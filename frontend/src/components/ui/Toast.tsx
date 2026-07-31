import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastCtx>({ show: () => {} })

export function useToast() {
  return useContext(Ctx)
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-emerald-500" />,
  error: <XCircle size={16} className="text-rose-500" />,
  info: <Info size={16} className="text-sky-500" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-full max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 bg-white border border-slate-200 shadow-lg rounded-lg px-3.5 py-3 text-sm text-slate-700 animate-[fadeIn_0.15s_ease-out]"
          >
            {ICONS[t.kind]}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
