import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getClinic } from '../services/api'
import { useClinic } from '../context/ClinicContext'

/** /book/:slug used to be a standalone booking form. Booking now happens
 * entirely through the chat, so this route just resolves the clinic by its
 * public slug, selects it, and sends the visitor straight into the chat
 * app ready to book -- one less UI to maintain, and it matches how booking
 * actually works everywhere else in the product. */
export default function PublicBookingRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { setClinicId } = useClinic()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    getClinic(slug)
      .then((res) => {
        setClinicId(res.data.id)
        navigate('/', { replace: true })
      })
      .catch(() => setError("We couldn't find that clinic. Please check the link and try again."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-4">
        <p className="text-sm text-slate-500 text-center max-w-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <p className="text-sm text-slate-400">Taking you to the chat…</p>
    </div>
  )
}
