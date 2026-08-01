import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { COLORS } from '../theme'

export interface ChatIdentity {
  name: string
  phone: string
}

interface Props {
  clinicName?: string
  onLogin: (identity: ChatIdentity) => void
}

export default function ChatLogin({ clinicName, onLogin }: Props) {
  const { colors } = useTheme()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.')
      return
    }
    onLogin({ name: name.trim(), phone: phone.trim() })
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ backgroundColor: COLORS.surface }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4"
          style={{ backgroundColor: colors.primary }}
        >
          {clinicName?.[0] ?? 'I'}
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1">Welcome{clinicName ? ` to ${clinicName}` : ''}</h1>
        <p className="text-sm text-slate-500 mb-5">
          Enter your name and phone number so we can keep your conversation history for you.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jimmy Khan"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92-3xx-xxxxxxx"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <button
            type="submit"
            className="w-full text-white text-sm font-semibold py-2.5 rounded-lg mt-2"
            style={{ backgroundColor: colors.primary }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
