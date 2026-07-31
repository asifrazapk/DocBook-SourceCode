import { useEffect, useState, Fragment } from 'react'
import { MessagesSquare, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { getConversationMessages, type ConversationMessage } from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
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
                  {['Patient message', 'Bot response', 'Feedback', 'Eval score', 'When', ''].map((h) => (
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
                          <td colSpan={6} className="px-5 py-4">
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
    </div>
  )
}
