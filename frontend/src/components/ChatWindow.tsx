import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import { COLORS } from '../theme'
import { useTheme } from '../context/ThemeContext'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  messageId?: string
}

interface Props {
  messages: ChatMessage[]
  isTyping: boolean
  botInitial?: string
}

export default function ChatWindow({ messages, isTyping, botInitial = 'I' }: Props) {
  const { colors } = useTheme()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6" style={{ backgroundColor: COLORS.surface }}>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg mb-3" style={{ backgroundColor: colors.primary }}>
            {botInitial}
          </div>
          <p className="text-slate-500 text-sm">Hello! How can I help you today?</p>
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        {messages.map((msg, i) =>
          msg.role === 'assistant' ? (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5"
                style={{ backgroundColor: colors.primary }}
              >
                {botInitial}
              </div>
              <div className="flex-1 min-w-0">
                <MessageBubble role={msg.role} content={msg.content} messageId={msg.messageId} />
              </div>
            </div>
          ) : (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          )
        )}
        {isTyping && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ backgroundColor: colors.primary }}>
              {botInitial}
            </div>
            <TypingIndicator />
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
