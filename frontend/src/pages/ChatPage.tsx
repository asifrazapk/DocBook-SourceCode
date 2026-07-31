import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Languages, ShieldAlert, RefreshCw, Paperclip, Mic, HelpCircle } from 'lucide-react'
import ChatWindow, { type ChatMessage } from '../components/ChatWindow'
import QuickReplies from '../components/QuickReplies'
import ClinicSelector from '../components/ClinicSelector'
import ThemeColorPicker from '../components/ThemeColorPicker'
import ChatSidebar, { type RecentChat } from '../components/ChatSidebar'
import { sendMessage, getChatHistory } from '../services/api'
import { useClinic } from '../context/ClinicContext'
import { useTheme } from '../context/ThemeContext'
import { COLORS } from '../theme'
import { v4 as uuidv4 } from 'uuid'

const APP_NAME = 'I-DocAssistance'
const MAX_CHARS = 3000
const RECENTS_KEY = 'idoc_recent_chats'

function loadRecents(): RecentChat[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecents(chats: RecentChat[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(chats.slice(0, 50)))
}

export default function ChatPage() {
  const { t, i18n } = useTranslation()
  const { clinic, clinicId, loading: clinicLoading } = useClinic()
  const { colors } = useTheme()

  const [sessionId, setSessionId] = useState(() => uuidv4())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [recents, setRecents] = useState<RecentChat[]>(loadRecents)
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)

  const upsertRecent = (title: string) => {
    setRecents((prev) => {
      const withoutCurrent = prev.filter((c) => c.sessionId !== sessionId)
      const next = [{ sessionId, title: title.slice(0, 60), timestamp: Date.now() }, ...withoutCurrent]
      saveRecents(next)
      return next
    })
  }

  const startNewChat = () => {
    setSessionId(uuidv4())
    setMessages([])
    setQuickReplies([])
    setLastUserMessage(null)
  }

  const loadSession = async (id: string) => {
    if (!clinicId) return
    setSessionId(id)
    setQuickReplies([])
    try {
      const res = await getChatHistory(clinicId, id)
      setMessages(res.data.map((m) => ({ role: m.role, content: m.content })))
      const lastUser = [...res.data].reverse().find((m) => m.role === 'user')
      setLastUserMessage(lastUser?.content ?? null)
    } catch {
      setMessages([])
    }
  }

  const toggleLang = () => {
    const next = i18n.language === 'ur' ? 'en' : 'ur'
    i18n.changeLanguage(next)
    localStorage.setItem('medibot_lang', next)
  }

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !clinicId) return
    setInput('')
    setQuickReplies([])
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLastUserMessage(msg)
    setIsTyping(true)
    const isFirstMessage = messages.length === 0
    try {
      const res = await sendMessage(clinicId, sessionId, msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply, messageId: res.data.message_id }])
      setQuickReplies(res.data.quick_replies)
      if (isFirstMessage) upsertRecent(msg)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const regenerate = () => {
    if (!lastUserMessage || isTyping) return
    // Remove the last assistant reply before asking again, so the transcript
    // doesn't show the same question answered twice in a row.
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === 'assistant')
      if (idx === -1) return prev
      const realIdx = prev.length - 1 - idx
      return prev.slice(0, realIdx)
    })
    handleSend(lastUserMessage)
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: COLORS.surface }}>
      <ChatSidebar chats={recents} activeSessionId={sessionId} onSelect={loadSession} onNewChat={startNewChat} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: colors.primary }}>
              {clinic?.name?.[0] ?? 'I'}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-slate-900 truncate">{clinic?.name ?? t('appName')} Chat</h1>
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {t('tagline')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` }}>
              <ShieldAlert size={12} /> Emergency: 1122
            </span>
            <ThemeColorPicker />
            <button
              onClick={toggleLang}
              className="bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              title="Switch language"
            >
              <Languages size={13} />
              {i18n.language === 'ur' ? 'EN' : 'اردو'}
            </button>
            <button className="text-slate-400 hover:text-slate-600 p-1.5" title="Help">
              <HelpCircle size={16} />
            </button>
          </div>
        </header>

        <ClinicSelector className="mx-5 mt-3" />

        <ChatWindow messages={messages} isTyping={isTyping} botInitial={clinic?.name?.[0] ?? 'I'} />

        {quickReplies.length > 0 && <QuickReplies replies={quickReplies} onSelect={handleSend} />}

        {lastUserMessage && !isTyping && messages.length > 0 && (
          <div className="flex justify-center bg-white pt-2">
            <button
              onClick={regenerate}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="bg-white border-t border-slate-200 px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-teal-600/30">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ask ${clinic?.name ?? APP_NAME}…`}
              disabled={isTyping || clinicLoading}
              dir={i18n.language === 'ur' ? 'rtl' : 'ltr'}
              className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping || clinicLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity disabled:opacity-30"
              style={{ backgroundColor: colors.primary }}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-not-allowed" title="Attachments coming soon" disabled>
                <Paperclip size={13} /> Attachment
              </button>
              <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-not-allowed" title="Voice messages coming soon" disabled>
                <Mic size={13} /> Voice Message
              </button>
            </div>
            <span className="text-xs text-slate-300">{input.length}/{MAX_CHARS}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
