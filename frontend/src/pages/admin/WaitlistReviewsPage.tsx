import { useEffect, useState } from 'react'
import { Clock3, Star, EyeOff, Eye } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { getWaitlist, getAllReviews, setReviewVisibility, getReviewSummary, type WaitlistEntry, type Review } from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'

export default function WaitlistReviewsPage() {
  const { clinicId } = useClinic()
  const toast = useToast()
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<{ count: number; average: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    Promise.all([getWaitlist(clinicId), getAllReviews(clinicId), getReviewSummary(clinicId)])
      .then(([w, r, s]) => {
        setWaitlist(w.data)
        setReviews(r.data)
        setSummary(s.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [clinicId])

  const toggleVisibility = async (review: Review) => {
    try {
      await setReviewVisibility(review.id, !review.is_public)
      toast.show(review.is_public ? 'Review hidden from public page.' : 'Review made public.')
      load()
    } catch {
      toast.show('Could not update this review.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Waitlist & Reviews" subtitle="Patients waiting for a fully-booked slot, and feedback after visits." />

      <Card noPad>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm">Waitlist</h2>
          <p className="text-xs text-slate-400 mt-0.5">Notified automatically by email if the slot they want opens up (a cancellation).</p>
        </div>
        {waitlist.length === 0 ? (
          <EmptyState icon={<Clock3 size={28} />} title="No one waiting" />
        ) : (
          <div className="divide-y divide-slate-100">
            {waitlist.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{w.patient_name} — {w.doctor_name}</p>
                  <p className="text-xs text-slate-400">Wants {w.desired_date} · {w.patient_phone}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${w.status === 'waiting' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card noPad>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Reviews</h2>
            <p className="text-xs text-slate-400 mt-0.5">Toggle visibility to control what shows on the public review page.</p>
          </div>
          {summary && summary.count > 0 && (
            <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
              <Star size={14} className="text-amber-400 fill-amber-400" /> {summary.average} <span className="text-xs font-normal text-slate-400">({summary.count} public)</span>
            </div>
          )}
        </div>
        {reviews.length === 0 ? (
          <EmptyState icon={<Star size={28} />} title="No reviews yet" />
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r.id} className="flex items-start justify-between px-5 py-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className={i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                    ))}
                    <span className="text-xs font-semibold text-slate-700 ml-1">{r.patient_name}</span>
                    {r.doctor_name && <span className="text-xs text-slate-400">· {r.doctor_name}</span>}
                  </div>
                  {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
                </div>
                <button
                  onClick={() => toggleVisibility(r)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded flex-shrink-0 ${r.is_public ? 'text-slate-500 hover:bg-slate-100' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {r.is_public ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Show</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
