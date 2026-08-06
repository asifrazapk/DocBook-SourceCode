import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { getClinic, getPublicReviews, getReviewSummary, type Clinic, type Review } from '../services/api'

export default function PublicReviewsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<{ count: number; average: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    getClinic(slug).then((c) => {
      setClinic(c.data)
      Promise.all([getPublicReviews(c.data.id), getReviewSummary(c.data.id)]).then(([r, s]) => {
        setReviews(r.data)
        setSummary(s.data)
        setLoading(false)
      })
    })
  }, [slug])

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Loading…</div>
  }

  if (!clinic) {
    return <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Clinic not found.</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-slate-900">{clinic.name}</h1>
          {summary && summary.count > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={18} className={i < Math.round(summary.average) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
              ))}
              <span className="text-sm font-semibold text-slate-700 ml-1">{summary.average} ({summary.count} reviews)</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="text-center text-sm text-slate-400">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-1 mb-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className={i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                  ))}
                  <span className="text-xs font-semibold text-slate-600 ml-1">{r.patient_name}</span>
                  {r.doctor_name && <span className="text-xs text-slate-400">· {r.doctor_name}</span>}
                </div>
                {r.comment && <p className="text-sm text-slate-700">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
