import { useEffect, useRef, useState } from 'react'
import { Search, MessageSquarePlus, ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { getChatConversations, type ChatConversationSummary } from '../services/api'
import type { ChatIdentity } from './ChatLogin'

interface Props {
  clinicId: number
  identity: ChatIdentity
  activeSessionId: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  onLogout: () => void
  refreshKey: number // bump this after sending the first message of a new chat, to refetch page 1
}

const SIDEBAR_COLLAPSED_KEY = 'idoc_chat_sidebar_collapsed'

export default function ChatSidebar({ clinicId, identity, activeSessionId, onSelect, onNewChat, onLogout, refreshKey }: Props) {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  // Reset and load page 1 whenever the identity changes or a new chat starts.
  useEffect(() => {
    setConversations([])
    setPage(1)
    setTotalPages(1)
    loadPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, identity.phone, refreshKey])

  const loadPage = (pageToLoad: number, replace: boolean) => {
    setLoading(true)
    getChatConversations(clinicId, identity.phone, pageToLoad, 20)
      .then((r) => {
        setConversations((prev) => (replace ? r.data.items : [...prev, ...r.data.items]))
        setTotalPages(r.data.total_pages)
        setPage(pageToLoad)
      })
      .finally(() => setLoading(false))
  }

  // Infinite scroll: load the next page once the user nears the bottom.
  const onScroll = () => {
    const el = listRef.current
    if (!el || loading || page >= totalPages) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      loadPage(page + 1, false)
    }
  }

  const filtered = query.trim()
    ? conversations.filter((c) => (c.first_message ?? '').toLowerCase().includes(query.toLowerCase()))
    : conversations

  if (collapsed) {
    return (
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3 flex-shrink-0">
        <button onClick={toggleCollapsed} className="text-slate-400 hover:text-slate-700" title="Expand">
          <ChevronsRight size={16} />
        </button>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: colors.primary }}>
          {identity.name[0]?.toUpperCase() ?? 'I'}
        </div>
        <button onClick={onNewChat} className="text-slate-400 hover:text-slate-700 mt-2" title="New chat">
          <MessageSquarePlus size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
      <div className="p-4 flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: colors.primary }}>
          {identity.name[0]?.toUpperCase() ?? 'I'}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-slate-800 transition-colors"
          >
            <MessageSquarePlus size={13} /> New Chat
          </button>
          <button onClick={toggleCollapsed} className="text-slate-400 hover:text-slate-700 p-1.5" title="Collapse sidebar">
            <ChevronsLeft size={15} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-8 px-3">No conversations yet. Start chatting below.</p>
        ) : (
          <div className="space-y-0.5 pb-2">
            {filtered.map((c) => (
              <button
                key={c.session_id}
                onClick={() => onSelect(c.session_id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                  c.session_id === activeSessionId ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                style={c.session_id === activeSessionId ? { backgroundColor: colors.primary } : undefined}
                title={c.first_message ?? undefined}
              >
                {c.first_message?.slice(0, 60) || 'New conversation'}
              </button>
            ))}
          </div>
        )}
        {loading && <p className="text-[11px] text-slate-300 text-center py-2">Loading…</p>}
      </div>

      <div className="p-3 border-t border-slate-100 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700 truncate">{identity.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{identity.phone}</p>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 flex-shrink-0" title="Switch account">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}
