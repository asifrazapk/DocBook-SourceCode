import { useMemo, useState } from 'react'
import { Search, MessageSquarePlus, MoreHorizontal, Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export interface RecentChat {
  sessionId: string
  title: string
  timestamp: number
}

interface Props {
  chats: RecentChat[]
  activeSessionId: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}

const DAY_MS = 24 * 60 * 60 * 1000

function groupChats(chats: RecentChat[]) {
  const now = Date.now()
  const recent: RecentChat[] = []
  const lastWeek: RecentChat[] = []
  const older: RecentChat[] = []
  for (const c of chats) {
    const age = now - c.timestamp
    if (age <= 7 * DAY_MS) recent.push(c)
    else if (age <= 30 * DAY_MS) lastWeek.push(c)
    else older.push(c)
  }
  return { recent, lastWeek, older }
}

export default function ChatSidebar({ chats, activeSessionId, onSelect, onNewChat }: Props) {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  const [dark, setDark] = useState(false)

  const filtered = useMemo(() => {
    const sorted = [...chats].sort((a, b) => b.timestamp - a.timestamp)
    if (!query.trim()) return sorted
    return sorted.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
  }, [chats, query])

  const { recent, lastWeek, older } = groupChats(filtered)

  const renderGroup = (label: string, items: RecentChat[]) =>
    items.length > 0 && (
      <div className="mb-4">
        <div className="flex items-center justify-between px-3 mb-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
          <MoreHorizontal size={13} className="text-slate-300" />
        </div>
        <div className="space-y-0.5">
          {items.map((c) => (
            <button
              key={c.sessionId}
              onClick={() => onSelect(c.sessionId)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                c.sessionId === activeSessionId ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              style={c.sessionId === activeSessionId ? { backgroundColor: colors.primary } : undefined}
              title={c.title}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>
    )

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
      <div className="p-4 flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: colors.primary }}>
          I
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-slate-800 transition-colors"
        >
          <MessageSquarePlus size={13} /> New Chat
        </button>
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

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 px-3">No conversations yet. Start chatting below.</p>
        ) : (
          <>
            {renderGroup('Recent', recent)}
            {renderGroup('Last week', lastWeek)}
            {renderGroup('Older', older)}
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center bg-slate-100 rounded-full p-0.5 mb-3">
          <button
            onClick={() => setDark(false)}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-full transition-colors ${!dark ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}
          >
            <Sun size={11} /> Light
          </button>
          <button
            onClick={() => setDark(true)}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-full transition-colors ${dark ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}
          >
            <Moon size={11} /> Dark
          </button>
        </div>
      </div>
    </aside>
  )
}
