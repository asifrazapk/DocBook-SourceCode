import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, ShieldAlert, RefreshCw, Mic, MicOff, HelpCircle } from 'lucide-react'
import ChatWindow, { type ChatMessage } from '../components/ChatWindow'
import QuickReplies from '../components/QuickReplies'
import ClinicSelector from '../components/ClinicSelector'
import ThemeColorPicker from '../components/ThemeColorPicker'
import ChatSidebar from '../components/ChatSidebar'
import ChatLogin, { type ChatIdentity } from '../components/ChatLogin'
import { sendMessage, getChatHistory } from '../services/api'
import { useClinic } from '../context/ClinicContext'
import { useTheme } from '../context/ThemeContext'
import { COLORS } from '../theme'
import { v4 as uuidv4 } from 'uuid'

const APP_NAME = 'I-DocAssistance'
const MAX_CHARS = 3000
const IDENTITY_KEY = 'idoc_patient_identity'

function loadIdentity(): ChatIdentity | null {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null')
  } catch {
    return null
  }
}

export default function ChatPage() {
  const { t, i18n } = useTranslation()
  const { clinic, clinicId, loading: clinicLoading } = useClinic()
  const { colors } = useTheme()

  const [identity, setIdentity] = useState<ChatIdentity | null>(loadIdentity)
  const [sessionId, setSessionId] = useState(() => uuidv4())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported] = useState(
    () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  )
  const recognitionRef = useRef<any>(null)

  const handleLogin = (id: ChatIdentity) => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  const handleLogout = () => {
    localStorage.removeItem(IDENTITY_KEY)
    setIdentity(null)
    setMessages([])
    setSessionId(uuidv4())
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

  const setLang = (next: 'en' | 'ur') => {
    i18n.changeLanguage(next)
    localStorage.setItem('medibot_lang', next)
  }

  const toggleVoiceInput = () => {
    if (!voiceSupported) return

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = i18n.language === 'ur' ? 'ur-PK' : 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, MAX_CHARS))
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  useEffect(() => {
    // Stop listening if the component unmounts mid-recording.
    return () => recognitionRef.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !clinicId || !identity) return
    setInput('')
    setQuickReplies([])
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLastUserMessage(msg)
    setIsTyping(true)
    const isFirstMessage = messages.length === 0
    try {
      const res = await sendMessage(clinicId, sessionId, msg, identity.phone, identity.name, i18n.language)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply, messageId: res.data.message_id }])
      setQuickReplies(res.data.quick_replies)
      if (isFirstMessage) setSidebarRefreshKey((k) => k + 1) // new conversation just appeared server-side
      if (res.data.language && res.data.language !== i18n.language) {
        // The backend detected a different language from the message's own
        // script (e.g. typed Urdu before ever touching the toggle) -- sync
        // so the *next* message (including a Latin-script quick-reply tap)
        // stays sticky to it instead of reverting.
        i18n.changeLanguage(res.data.language)
        localStorage.setItem('medibot_lang', res.data.language)
      }
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

  if (!identity) {
    return <ChatLogin clinicName={clinic?.name} onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: COLORS.surface }}>
      {clinicId && (
        <ChatSidebar
          clinicId={clinicId}
          identity={identity}
          activeSessionId={sessionId}
          onSelect={loadSession}
          onNewChat={startNewChat}
          onLogout={handleLogout}
          refreshKey={sidebarRefreshKey}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: colors.primary }}>
              {clinic?.name?.[0] ?? 'I'}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-slate-900 truncate">{clinic?.name ?? APP_NAME} Chat</h1>
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
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Chat language">
              <button
                onClick={() => setLang('en')}
                title="English"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  i18n.language !== 'ur' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ur')}
                title="اردو"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  i18n.language === 'ur' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                اردو
              </button>
            </div>
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
              placeholder={isListening ? 'Listening…' : `Ask ${clinic?.name ?? APP_NAME}…`}
              disabled={isTyping || clinicLoading}
              dir={i18n.language === 'ur' ? 'rtl' : 'ltr'}
              className="flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-60"
            />
            {voiceSupported && (
              <button
                onClick={toggleVoiceInput}
                disabled={isTyping || clinicLoading}
                title={isListening ? 'Stop listening' : 'Voice input'}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-200'
                }`}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            )}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping || clinicLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity disabled:opacity-30"
              style={{ backgroundColor: colors.primary }}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="flex items-center justify-end mt-2 px-1">
            <span className="text-xs text-slate-300">{input.length}/{MAX_CHARS}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
