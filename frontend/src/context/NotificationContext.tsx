import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface AppNotification {
  id: string
  message: string
  timestamp: number
  read: boolean
}

const STORAGE_KEY = 'medibot_notifications'

function loadStored(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

interface NotificationCtx {
  notifications: AppNotification[]
  unreadCount: number
  add: (message: string) => void
  markAllRead: () => void
  clear: () => void
  setEnabled: (enabled: boolean) => void
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unreadCount: 0,
  add: () => {},
  markAllRead: () => {},
  clear: () => {},
  setEnabled: () => {},
})

export function useNotifications() {
  return useContext(Ctx)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored)
  // Ref (not state) so add() always reads the latest value without needing
  // to be re-created every time the setting changes.
  const enabledRef = useRef(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications])

  const add = (message: string) => {
    if (!enabledRef.current) return
    setNotifications((prev) => [{ id: crypto.randomUUID(), message, timestamp: Date.now(), read: false }, ...prev].slice(0, 30))
  }

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const clear = () => setNotifications([])
  const setEnabled = (enabled: boolean) => {
    enabledRef.current = enabled
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Ctx.Provider value={{ notifications, unreadCount, add, markAllRead, clear, setEnabled }}>
      {children}
    </Ctx.Provider>
  )
}
