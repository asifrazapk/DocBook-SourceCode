import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAdminAuth } from '../../context/AdminAuthContext'

export default function AdminLoginPage() {
  const { login, error } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await login(email, password)
    setSubmitting(false)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
        <div className="w-11 h-11 rounded-xl bg-teal-700 flex items-center justify-center text-white mb-4">
          <ShieldCheck size={20} />
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1">Admin Panel</h1>
        <p className="text-sm text-slate-500 mb-5">Sign in to manage this clinic.</p>

        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white text-sm font-semibold py-2.5 rounded-lg mt-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-5">Demo credentials: admin@alshifa.pk / admin123</p>
      </div>
    </div>
  )
}
