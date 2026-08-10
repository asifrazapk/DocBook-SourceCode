import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, ThumbsUp, ThumbsDown, Check, Send, Volume2, VolumeX } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useToast } from './ui/Toast'
import { submitChatFeedback } from '../services/api'

interface Props {
  role: 'user' | 'assistant'
  content: string
  messageId?: string
  onBeforeSpeak?: () => void
  // Controlled mode: when provided, this message's Listen/Stop button
  // reflects and drives an external playback state (e.g. the voice chat's
  // auto-play) instead of managing its own browser-speechSynthesis-only
  // state. Used so the button doesn't say "Listen" while audio from a
  // different mechanism (like ElevenLabs) is already playing this message.
  forcedSpeaking?: boolean
  onToggleSpeak?: () => void
}

const speechSupported = typeof window !== 'undefined' && !!window.speechSynthesis

// Voices load asynchronously in most browsers (empty on the very first call),
// so cache them via the voiceschanged event rather than re-querying blind.
let cachedVoices: SpeechSynthesisVoice[] = []
if (speechSupported) {
  cachedVoices = window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices()
  }
}

function findVoice(langPrefix: string): SpeechSynthesisVoice | undefined {
  return cachedVoices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
}

export default function MessageBubble({ role, content, messageId, onBeforeSpeak, forcedSpeaking, onToggleSpeak }: Props) {
  const { colors } = useTheme()
  const toast = useToast()
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<0 | 1 | null>(null)
  const [askingComment, setAskingComment] = useState(false)
  const [comment, setComment] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const isControlled = onToggleSpeak !== undefined
  const displaySpeaking = isControlled ? !!forcedSpeaking : speaking

  useEffect(() => {
    return () => {
      if (speaking) window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }

  const toggleSpeak = () => {
    if (!speechSupported) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const isUrdu = /[\u0600-\u06FF]/.test(content)
    // Strip markdown bullets/asterisks so it doesn't read punctuation aloud.
    const plain = content.replace(/[*_#`]/g, '').replace(/^-\s+/gm, '')
    const utterance = new SpeechSynthesisUtterance(plain)
    onBeforeSpeak?.() // e.g. stop any other audio (like the voice chat's auto-play) before this starts

    if (isUrdu) {
      const urduVoice = findVoice('ur')
      if (urduVoice) {
        utterance.voice = urduVoice
        utterance.lang = urduVoice.lang
      } else {
        // Being honest here: most browsers/OSes simply don't ship an Urdu
        // voice, and setting .lang alone without a matching voice usually
        // produces silence rather than a real (if imperfect) readout.
        toast.show("This device doesn't have an Urdu voice installed — can't read this aloud.", 'info')
        return
      }
    } else {
      utterance.lang = 'en-US'
      const enVoice = findVoice('en')
      if (enVoice) utterance.voice = enVoice
    }

    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel() // don't stack multiple readouts
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  const sendFeedback = async (type: 0 | 1, value = '') => {
    if (!messageId) return
    setFeedback(type)
    try {
      await submitChatFeedback(messageId, type, value)
    } catch {
      /* best-effort — feedback is a nice-to-have, not critical path */
    }
  }

  const clickThumbUp = () => {
    setAskingComment(false)
    sendFeedback(1)
  }

  const clickThumbDown = () => {
    // Ask for a quick comment on what went wrong before submitting.
    setAskingComment(true)
  }

  const submitComment = () => {
    sendFeedback(0, comment.trim())
    setAskingComment(false)
  }

  const skipComment = () => {
    sendFeedback(0)
    setAskingComment(false)
  }

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-2 mb-4">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm bg-slate-100 text-slate-800">
          {content}
        </div>
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: colors.primary }}>
          U
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 max-w-[85%]">
      <div className="text-sm leading-relaxed text-slate-700">
        <ReactMarkdown
          components={{
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mt-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mt-1">{children}</ol>,
            li: ({ children }) => <li className="ml-1">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="flex items-center gap-3 mt-2 text-slate-400">
        <button onClick={copy} className="flex items-center gap-1 text-xs hover:text-slate-600 transition-colors" title="Copy">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {speechSupported && (
          <button
            onClick={isControlled ? onToggleSpeak : toggleSpeak}
            className="flex items-center gap-1 text-xs hover:text-slate-600 transition-colors"
            title={displaySpeaking ? 'Stop reading' : 'Read aloud'}
            style={displaySpeaking ? { color: colors.primary } : undefined}
          >
            {displaySpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {displaySpeaking ? 'Stop' : 'Listen'}
          </button>
        )}
        <span className="flex-1" />
        <button
          onClick={clickThumbUp}
          className="hover:text-emerald-600 transition-colors"
          title="Helpful"
          style={feedback === 1 ? { color: '#059669' } : undefined}
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={clickThumbDown}
          className="hover:text-rose-500 transition-colors"
          title="Not helpful"
          style={feedback === 0 ? { color: '#E11D48' } : undefined}
        >
          <ThumbsDown size={14} />
        </button>
      </div>

      {askingComment && (
        <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
          <input
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            placeholder="What went wrong? (optional)"
            className="flex-1 bg-transparent text-xs focus:outline-none"
          />
          <button onClick={submitComment} className="text-xs font-semibold" style={{ color: colors.primary }} title="Send">
            <Send size={13} />
          </button>
          <button onClick={skipComment} className="text-xs text-slate-400 hover:text-slate-600">
            Skip
          </button>
        </div>
      )}
    </div>
  )
}
