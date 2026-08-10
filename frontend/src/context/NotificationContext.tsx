import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { getNotifications, markAllNotificationsRead, type AppNotification } from '../services/api'

interface NotificationCtx {
  notifications: AppNotification[]
  unreadCount: number
  hasMore: boolean
  loading: boolean
  loadMore: () => void
  markAllRead: () => void
  refresh: () => void
  setClinicId: (id: number | null) => void
  setEnabled: (enabled: boolean) => void
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unreadCount: 0,
  hasMore: false,
  loading: false,
  loadMore: () => {},
  markAllRead: () => {},
  refresh: () => {},
  setClinicId: () => {},
  setEnabled: () => {},
})

export function useNotifications() {
  return useContext(Ctx)
}

const PAGE_SIZE = 10

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const clinicIdRef = useRef<number | null>(null)
  const pageRef = useRef(1)
  const enabledRef = useRef(true)

  const fetchPage = async (clinicId: number, page: number, append: boolean) => {
    setLoading(true)
    try {
      const res = await getNotifications(clinicId, page, PAGE_SIZE)
      setNotifications((prev) => (append ? [...prev, ...res.data.items] : res.data.items))
      setUnreadCount(res.data.unread_count)
      setHasMore(res.data.has_more)
      pageRef.current = page
    } catch {
      /* transient network hiccup -- the bell just shows what it already has */
    } finally {
      setLoading(false)
    }
  }

  const setClinicId = (id: number | null) => {
    if (clinicIdRef.current === id) return
    clinicIdRef.current = id
    pageRef.current = 1
    setNotifications([])
    setUnreadCount(0)
    setHasMore(false)
    if (id && enabledRef.current) void fetchPage(id, 1, false)
  }

  const loadMore = () => {
    const clinicId = clinicIdRef.current
    if (!clinicId || loading || !hasMore) return
    void fetchPage(clinicId, pageRef.current + 1, true)
  }

  const refresh = () => {
    const clinicId = clinicIdRef.current
    if (!clinicId || !enabledRef.current) return
    void fetchPage(clinicId, 1, false)
  }

  const markAllRead = async () => {
    const clinicId = clinicIdRef.current
    if (!clinicId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead(clinicId)
    } catch {
      /* best-effort -- the unread count will just re-sync on next refresh */
    }
  }

  const setEnabled = (enabled: boolean) => {
    enabledRef.current = enabled
  }

  return (
    <Ctx.Provider value={{ notifications, unreadCount, hasMore, loading, loadMore, markAllRead, refresh, setClinicId, setEnabled }}>
      {children}
    </Ctx.Provider>
  )
}
