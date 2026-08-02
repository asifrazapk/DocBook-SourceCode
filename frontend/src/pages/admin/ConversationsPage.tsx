import { useEffect, useState, Fragment } from 'react'
import { MessagesSquare, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, MessageSquareText } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { getConversationMessages, getConversationThread, type ConversationMessage, type ConversationThreadMessage } from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { Input } from '../../components/ui/Field'
import { usePagination } from '../../hooks/usePagination'

export default function ConversationsPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const { page, pageSize, setPage, setPageSize } = usePagination(10)

  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [threadConversationId, setThreadConversationId] = useState<number | null>(null)

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    getConversationMessages(clinicId, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      pageSize,
    })
      .then((r) => {
        setMessages(r.data.items)
        setTotal(r.data.total)
        setTotalPages(r.data.total_pages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [clinicId, startDate, endDate, page, pageSize])

  return (
    <div className="space-y-5">
      <PageHeader title="Conversations" subtitle="Every chat turn between patients and the assistant, with feedback and quality scores. Click a row to expand." />

      <Card noPad>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 text-xs">
          <span className="text-slate-500 font-semibold">Date range</span>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[140px]" />
          <span className="text-slate-400">to</span>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className="!py-1.5 !text-xs w-[140px]" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessagesSquare size={36} />} title="No conversations found" subtitle="Try widening the date range." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Conversation ID', 'Patient message', 'Bot response', 'Feedback', 'Eval score', 'When', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((m) => {
                  const isOpen = expanded === m.message_id
                  return (
                    <Fragment key={m.message_id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : m.message_id)}
                        className="hover:bg-slate-50/70 cursor-pointer"
                      >
                        <td className="px-5 py-3 text-slate-400 text-xs font-mono">#{m.conversation_id}</td>
                        <td className="px-5 py-3 max-w-[240px] truncate text-slate-700">{m.message_text ?? '—'}</td>
                        <td className="px-5 py-3 max-w-[280px] truncate text-slate-500">{m.llm_response ?? '—'}</td>
                        <td className="px-5 py-3">
                          {m.feedback_type === 1 && <ThumbsUp size={14} className="text-emerald-600" />}
                          {m.feedback_type === 0 && <ThumbsDown size={14} className="text-rose-500" />}
                          {m.feedback_type === null && <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {m.overall_score !== null ? (
                            <span
                              className={`font-semibold ${
                                m.overall_score >= 0.8 ? 'text-emerald-600' : m.overall_score >= 0.6 ? 'text-amber-600' : 'text-rose-500'
                              }`}
                            >
                              {m.overall_score.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">{m.local_created_at?.slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Patient message</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.message_text ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Bot response</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.llm_response ?? '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setThreadConversationId(m.conversation_id)
                                }}
                                className="flex items-center gap-1 font-semibold"
                                style={{ color: colors.primary }}
                              >
                                <MessageSquareText size={13} /> View full conversation
                              </button>
                              <span>Conversation #{m.conversation_id}</span>
                              {m.feedback_value && <span>Feedback: {m.feedback_value}</span>}
                              {m.relevance !== null && <span>Relevance: {m.relevance?.toFixed(2)}</span>}
                              {m.correctness !== null && <span>Correctness: {m.correctness?.toFixed(2)}</span>}
                              {m.faithfulness !== null && <span>Faithfulness: {m.faithfulness?.toFixed(2)}</span>}
                              {m.completeness !== null && <span>Completeness: {m.completeness?.toFixed(2)}</span>}
                              {m.is_hallucination && <span className="font-semibold" style={{ color: colors.primary }}>Flagged: possible hallucination</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} totalPages={totalPages} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </Card>

      {threadConversationId && clinicId && (
        <ConversationThreadModal
          clinicId={clinicId}
          conversationId={threadConversationId}
          onClose={() => setThreadConversationId(null)}
        />
      )}
    </div>
  )
}

function ConversationThreadModal({
  clinicId,
  conversationId,
  onClose,
}: {
  clinicId: number
  conversationId: number
  onClose: () => void
}) {
  const { colors } = useTheme()
  const [thread, setThread] = useState<ConversationThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getConversationThread(clinicId, conversationId)
      .then((r) => setThread(r.data))
      .finally(() => setLoading(false))
  }, [clinicId, conversationId])

  return (
    <Modal open title={`Conversation #${conversationId}`} onClose={onClose} width="lg">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : thread.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No messages found.</p>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {thread.map((m) => (
            <div key={m.message_id} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-slate-100 rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm text-slate-800">
                  {m.message_text ?? '—'}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm" style={{ backgroundColor: `${colors.primary}0F` }}>
                  <p className="text-slate-800 whitespace-pre-wrap">{m.llm_response ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                    <span>{m.local_created_at?.slice(0, 16).replace('T', ' ')}</span>
                    {m.feedback_type === 1 && <ThumbsUp size={11} className="text-emerald-600" />}
                    {m.feedback_type === 0 && <ThumbsDown size={11} className="text-rose-500" />}
                    {m.overall_score !== null && <span>Score: {m.overall_score.toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
