import { useEffect, useMemo, useState } from 'react'
import { Info, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { useTheme } from '../../context/ThemeContext'
import { getAnalyticsOverview, getReportStats, type AnalyticsOverview, type ReportStats } from '../../services/api'
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Card'
import { BarChart, Sparkline } from '../../components/ui/Charts'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
]

interface MetricDef {
  key: keyof AnalyticsOverview['metrics']
  label: string
  definition: string
  format: (v: number | null) => string
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'conversations',
    label: 'Conversations',
    definition: 'Total number of conversations during the selected time period.',
    format: (v) => String(v ?? 0),
  },
  {
    key: 'messages',
    label: 'Messages',
    definition: 'Total number of messages exchanged during the selected time period.',
    format: (v) => String(v ?? 0),
  },
  {
    key: 'avg_daily_messages',
    label: 'Avg Daily Messages',
    definition: 'Total messages divided by the number of days in the selected time period.',
    format: (v) => (v ?? 0).toFixed(1),
  },
  {
    key: 'users',
    label: 'Users',
    definition: 'Total number of unique users active during the selected time period.',
    format: (v) => String(v ?? 0),
  },
  {
    key: 'avg_weekly_users',
    label: 'Avg Weekly Users',
    definition: 'Total unique users divided by the number of weeks in the selected time period.',
    format: (v) => (v ?? 0).toFixed(1),
  },
  {
    key: 'feedback_positivity_pct',
    label: 'Feedback Positivity (%)',
    definition: 'Percentage of positive feedback received. Formula: (Thumbs Up / Total Feedback Count) × 100',
    format: (v) => (v === null ? '—' : `${v.toFixed(1)}%`),
  },
  {
    key: 'feedback_completion_pct',
    label: 'Feedback Completion (%)',
    definition: 'Percentage of messages that received feedback. Formula: (Total Feedback Count / Total Message Count) × 100',
    format: (v) => (v === null ? '—' : `${v.toFixed(1)}%`),
  },
  {
    key: 'llm_eval_score',
    label: 'LLM Eval Score',
    definition: 'Average of all LLM evaluation scores recorded during the selected time period.',
    format: (v) => (v === null ? '—' : v.toFixed(2)),
  },
]

export default function AnalyticsPage() {
  const { clinicId } = useClinic()
  const { colors } = useTheme()
  const [startDate, setStartDate] = useState(daysAgoISO(29))
  const [endDate, setEndDate] = useState(todayISO())
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [reportStats, setReportStats] = useState<ReportStats | null>(null)

  useEffect(() => {
    if (!clinicId) return
    setLoading(true)
    getAnalyticsOverview(clinicId, startDate, endDate)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
    getReportStats(clinicId, startDate, endDate).then((r) => setReportStats(r.data))
  }, [clinicId, startDate, endDate])

  const messageChart = useMemo(
    () => (data ? data.daily.map((d) => ({ label: d.date.slice(5), value: d.message_count })) : []),
    [data]
  )
  const conversationChart = useMemo(
    () => (data ? data.daily.map((d) => ({ label: d.date.slice(5), value: d.conversation_count })) : []),
    [data]
  )
  const scoreTrend = useMemo(
    () => (data ? data.llm_evaluation.daily.map((d) => d.avg_overall_score ?? 0) : []),
    [data]
  )

  const feedbackPositive = data?.feedback.breakdown.filter((f) => f.feedback_type === 1).reduce((s, f) => s + f.count, 0) ?? 0
  const feedbackNegative = data?.feedback.breakdown.filter((f) => f.feedback_type === 0).reduce((s, f) => s + f.count, 0) ?? 0

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle="Conversation volume, patient feedback, and response quality over time." />

      {/* Date filter */}
      <Card noPad className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setStartDate(daysAgoISO(p.days))
                  setEndDate(todayISO())
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm ml-auto">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayISO()}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50"
            />
          </div>
        </div>
      </Card>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Metrics table */}
          <Card noPad>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-sm">Key metrics</h2>
            </div>
            <div className="grid grid-cols-4 divide-x divide-slate-100">
              {METRIC_DEFS.map((m) => (
                <div key={m.key} className="p-4 relative border-b border-slate-100 [&:nth-last-child(-n+4)]:border-b-0">
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-xs font-semibold text-slate-500">{m.label}</p>
                    <button
                      onMouseEnter={() => setTooltip(m.key)}
                      onMouseLeave={() => setTooltip(null)}
                      className="text-slate-300 hover:text-slate-500"
                    >
                      <Info size={12} />
                    </button>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: colors.primary }}>
                    {m.format(data.metrics[m.key] as number | null)}
                  </p>
                  {tooltip === m.key && (
                    <div className="absolute z-10 left-4 top-full mt-1 w-56 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                      {m.definition}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Feedback quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <ThumbsUp size={17} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none">{feedbackPositive}</p>
                  <p className="text-xs text-slate-500 mt-1">Positive feedback</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <ThumbsDown size={17} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none">{feedbackNegative}</p>
                  <p className="text-xs text-slate-500 mt-1">Negative feedback</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <h2 className="font-bold text-slate-900 text-sm mb-4">Messages per day</h2>
              {messageChart.length > 0 ? (
                <BarChart data={messageChart} color={colors.primary} />
              ) : (
                <EmptyState title="No conversations in this range" />
              )}
            </Card>
            <Card>
              <h2 className="font-bold text-slate-900 text-sm mb-4">Conversations per day</h2>
              {conversationChart.length > 0 ? (
                <BarChart data={conversationChart} color="#2563EB" />
              ) : (
                <EmptyState title="No conversations in this range" />
              )}
            </Card>
          </div>

          {/* LLM evaluation detail */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-sm">LLM response quality breakdown</h2>
              <span className="text-xs text-slate-400">{data.llm_evaluation.overall.evaluation_count} evaluated turns</span>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <ScoreStat label="Relevance" value={data.llm_evaluation.overall.avg_relevance} />
              <ScoreStat label="Correctness" value={data.llm_evaluation.overall.avg_correctness} />
              <ScoreStat label="Faithfulness" value={data.llm_evaluation.overall.avg_faithfulness} />
              <ScoreStat label="Completeness" value={data.llm_evaluation.overall.avg_completeness} />
            </div>
            {data.llm_evaluation.overall.hallucination_count > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                <AlertTriangle size={14} />
                {data.llm_evaluation.overall.hallucination_count} response(s) flagged as possible hallucinations in this range.
              </div>
            )}
            {scoreTrend.length > 1 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Overall score trend</p>
                <Sparkline values={scoreTrend} color={colors.primary} />
              </div>
            )}
          </Card>

          {/* Recent messages table */}
          <Card noPad>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-sm">Recent conversations</h2>
            </div>
            {data.recent_messages.length === 0 ? (
              <EmptyState title="No messages in this range" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Patient message', 'Bot response', 'Feedback', 'Score', 'When'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_messages.map((m) => (
                    <tr key={m.message_id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 max-w-[220px] truncate text-slate-700">{m.message_text}</td>
                      <td className="px-5 py-3 max-w-[260px] truncate text-slate-500">{m.llm_response}</td>
                      <td className="px-5 py-3">
                        {m.feedback_type === 1 && <ThumbsUp size={14} className="text-emerald-600" />}
                        {m.feedback_type === 0 && <ThumbsDown size={14} className="text-rose-500" />}
                        {m.feedback_type === null && <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {m.overall_score !== null ? (
                          <span className={`font-semibold ${m.overall_score >= 0.8 ? 'text-emerald-600' : m.overall_score >= 0.6 ? 'text-amber-600' : 'text-rose-500'}`}>
                            {m.overall_score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">{m.created_at?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Reports (prescriptions/medical records issued) */}
          <Card noPad>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-sm">Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">Prescriptions & reports issued in the selected range.</p>
            </div>
            <div className="p-5">
              <p className="text-2xl font-bold mb-3" style={{ color: colors.primary }}>{reportStats?.total ?? 0}</p>
              {!reportStats || reportStats.by_doctor.length === 0 ? (
                <p className="text-xs text-slate-400">No reports issued in this range.</p>
              ) : (
                <div className="space-y-2">
                  {reportStats.by_doctor.map((row) => (
                    <div key={row.doctor_name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{row.doctor_name}</span>
                      <span className="font-semibold text-slate-800">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ScoreStat({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? Math.round(value * 100) : null
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-slate-900">{pct !== null ? `${pct}%` : '—'}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
