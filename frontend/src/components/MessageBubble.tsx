import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Share2, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { submitChatFeedback } from '../services/api'

interface Props {
  role: 'user' | 'assistant'
  content: string
  messageId?: string
}

export default function MessageBubble({ role, content, messageId }: Props) {
  const { colors } = useTheme()
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<0 | 1 | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: content })
      } catch {
        /* user cancelled the share sheet */
      }
    } else {
      copy()
    }
  }

  const react = async (type: 0 | 1) => {
    if (!messageId) return
    setFeedback(type)
    try {
      await submitChatFeedback(messageId, type)
    } catch {
      /* best-effort — feedback is a nice-to-have, not critical path */
    }
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
        <button onClick={share} className="flex items-center gap-1 text-xs hover:text-slate-600 transition-colors" title="Share">
          <Share2 size={13} /> Share
        </button>
        <span className="flex-1" />
        <button
          onClick={() => react(1)}
          className="hover:text-emerald-600 transition-colors"
          title="Helpful"
          style={feedback === 1 ? { color: '#059669' } : undefined}
        >
          <ThumbsUp size={14} />
        </button>
        <button
          onClick={() => react(0)}
          className="hover:text-rose-500 transition-colors"
          title="Not helpful"
          style={feedback === 0 ? { color: '#E11D48' } : undefined}
        >
          <ThumbsDown size={14} />
        </button>
      </div>
    </div>
  )
}
