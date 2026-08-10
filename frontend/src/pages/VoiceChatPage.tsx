import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Mic,
  MicOff,
  MessageSquare,
  Loader2,
  ShieldAlert,
  CalendarCheck,
  HelpCircle,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import ChatLogin, { type ChatIdentity } from '../components/ChatLogin'
import ChatSidebar from '../components/ChatSidebar'
import MessageBubble from '../components/MessageBubble'
import ThemeColorPicker from '../components/ThemeColorPicker'
import { sendVoiceMessage, getChatHistory } from '../services/api'
import { useClinic } from '../context/ClinicContext'
import { useTheme } from '../context/ThemeContext'
import { COLORS } from '../theme'

const IDENTITY_KEY = 'idoc_patient_identity'

function loadIdentity(): ChatIdentity | null {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null')
  } catch {
    return null
  }
}

interface Turn {
  role: 'patient' | 'assistant'
  text: string
  messageId?: string
}

type MicState = 'idle' | 'listening' | 'reviewing' | 'sending'

export default function VoiceChatPage() {
  const { clinic, clinicId } = useClinic()
  const { colors } = useTheme()
  const { i18n } = useTranslation()
  const [identity, setIdentity] = useState<ChatIdentity | null>(loadIdentity)
  const [sessionId, setSessionId] = useState(() => uuidv4())
  const [turns, setTurns] = useState<Turn[]>([])
  const [micState, setMicState] = useState<MicState>('idle')
  const [draftText, setDraftText] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [lastReply, setLastReply] = useState<{ text: string; language: string } | null>(null)
  const [audioUnavailable, setAudioUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  const [voiceSupported] = useState(
    () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  )
  const recognitionRef = useRef<any>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isFirstMessageRef = useRef(true)

  const handleLogin = (id: ChatIdentity) => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  const handleLogout = () => {
    localStorage.removeItem(IDENTITY_KEY)
    setIdentity(null)
    setTurns([])
    setSessionId(uuidv4())
  }

  const stopSpeaking = () => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.currentTime = 0
    }
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }

  const startNewChat = () => {
    recognitionRef.current?.stop()
    stopSpeaking()
    setSessionId(uuidv4())
    setTurns([])
    setError('')
    setDraftText('')
    setMicState('idle')
    setLastReply(null)
    isFirstMessageRef.current = true
  }

  const loadSession = async (id: string) => {
    if (!clinicId) return
    recognitionRef.current?.stop()
    stopSpeaking()
    setSessionId(id)
    setError('')
    setMicState('idle')
    try {
      const res = await getChatHistory(clinicId, id)
      setTurns(res.data.map((m) => ({ role: m.role === 'user' ? 'patient' : 'assistant', text: m.content })))
      isFirstMessageRef.current = false
    } catch {
      setTurns([])
    }
  }

  const startListening = () => {
    if (!voiceSupported) return
    stopSpeaking()
    setError('')
    setDraftText('')
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = i18n.language === 'ur' ? 'ur-PK' : 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript
      setDraftText(transcript || '')
      setMicState('reviewing')
    }
    recognition.onerror = () => setMicState('idle')
    recognition.onend = () => {
      setMicState((s) => (s === 'listening' ? 'idle' : s))
    }

    recognitionRef.current = recognition
    setMicState('listening')
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
  }

  const discardDraft = () => {
    setDraftText('')
    setMicState('idle')
  }

  const sendDraft = async () => {
    const text = draftText.trim()
    if (!text || !clinicId || !identity) return
    const isFirstMessage = isFirstMessageRef.current
    isFirstMessageRef.current = false
    setMicState('sending')
    setTurns((prev) => [...prev, { role: 'patient', text }])
    setDraftText('')
    setLastReply(null)
    try {
      const res = await sendVoiceMessage(clinicId, sessionId, text, identity.phone, identity.name, i18n.language)
      setTurns((prev) => [...prev, { role: 'assistant', text: res.data.reply, messageId: res.data.message_id }])
      setLastReply({ text: res.data.reply, language: res.data.language })
      if (isFirstMessage) setSidebarRefreshKey((k) => k + 1)

      if (res.data.reply_audio_base64) {
        setAudioUnavailable(false)
        const audioSrc = `data:audio/mpeg;base64,${res.data.reply_audio_base64}`
        if (audioElRef.current) {
          audioElRef.current.src = audioSrc
          void audioElRef.current.play()
        }
      } else if (window.speechSynthesis) {
        setAudioUnavailable(true)
        const utterance = new SpeechSynthesisUtterance(res.data.reply)
        utterance.lang = res.data.language === 'ur' ? 'ur-PK' : 'en-US'
        utterance.onstart = () => setSpeaking(true)
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)
        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Sorry, that didn't come through. Please try again.")
    } finally {
      setMicState('idle')
    }
  }

  // Drives the Listen/Stop button on the latest assistant message: stop the
  // currently-playing reply, or (if playback already ended) play it again
  // -- reusing the ElevenLabs audio if it's still loaded, else falling back
  // to browser speech synthesis.
  const toggleLastMessagePlayback = () => {
    if (speaking) {
      stopSpeaking()
      return
    }
    if (audioElRef.current?.src) {
      void audioElRef.current.play()
      return
    }
    if (lastReply && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(lastReply.text)
      utterance.lang = lastReply.language === 'ur' ? 'ur-PK' : 'en-US'
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      <div className="flex flex-col flex-1 min-w-0 bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div>
            <h1 className="font-bold text-sm text-slate-900">{clinic?.name ?? 'I-DocAssistance'} — Voice Chat</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Speak instead of typing
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="hidden sm:flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` }}
            >
              <ShieldAlert size={12} /> Emergency: 1122
            </span>
            <ThemeColorPicker />
            <Link
              to="/my-appointments"
              className="hidden sm:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              title="Check your appointment status"
            >
              <CalendarCheck size={13} /> My Appointments
            </Link>
            <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5" style={{ color: colors.primary }} title="Switch to typing">
              <MessageSquare size={13} /> Text chat
            </Link>
            <button className="text-slate-400 hover:text-slate-600 p-1.5" title="Help">
              <HelpCircle size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!voiceSupported && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
              Your browser doesn't support voice input — try Chrome or Edge, or use the text chat instead.
            </p>
          )}
          {turns.length === 0 && micState === 'idle' && voiceSupported && (
            <p className="text-sm text-slate-400 text-center mt-10">Tap the microphone below and say something, like "I'd like to book an appointment."</p>
          )}
          {turns.map((t, i) => {
            const isLastAssistant = t.role === 'assistant' && i === turns.length - 1 && lastReply !== null
            return (
              <MessageBubble
                key={i}
                role={t.role === 'patient' ? 'user' : 'assistant'}
                content={t.text}
                messageId={t.messageId}
                onBeforeSpeak={stopSpeaking}
                forcedSpeaking={isLastAssistant ? speaking : undefined}
                onToggleSpeak={isLastAssistant ? toggleLastMessagePlayback : undefined}
              />
            )
          })}
          {audioUnavailable && speaking && (
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <Volume2 size={11} /> Using your browser's built-in voice (server voice isn't configured)
            </p>
          )}
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center">{error}</p>}
        </div>

        <audio ref={audioElRef} className="hidden" onPlay={() => setSpeaking(true)} onEnded={() => setSpeaking(false)} onPause={() => setSpeaking(false)} />

        <div className="bg-white border-t border-slate-200 py-5 flex flex-col items-center gap-3 flex-shrink-0 px-5">
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ backgroundColor: colors.primary }}
            >
              <VolumeX size={13} /> Stop speaking
            </button>
          )}

          {micState === 'reviewing' ? (
            <div className="w-full max-w-md space-y-2">
              <p className="text-[11px] font-semibold text-slate-500">Here's what we heard — edit if needed, then send:</p>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={2}
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={discardDraft} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg">
                  <RotateCcw size={13} /> Re-record
                </button>
                <button
                  onClick={sendDraft}
                  disabled={!draftText.trim()}
                  className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Send size={13} /> Send
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={micState === 'listening' ? stopListening : startListening}
                disabled={micState === 'sending' || !voiceSupported}
                className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: micState === 'listening' ? '#DC2626' : colors.primary }}
              >
                {micState === 'sending' ? <Loader2 size={26} className="animate-spin" /> : micState === 'listening' ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              <p className="text-xs text-slate-400">
                {micState === 'sending' ? 'Sending…' : micState === 'listening' ? 'Listening — tap to stop' : 'Tap to speak'}
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  )
}

