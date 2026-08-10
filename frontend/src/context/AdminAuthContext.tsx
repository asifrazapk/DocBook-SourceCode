import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { login as apiLogin, type AuthUser } from '../services/api'

interface AdminAuthCtx {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string
}

const Ctx = createContext<AdminAuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  error: '',
})

export function useAdminAuth() {
  return useContext(Ctx)
}

const TOKEN_KEY = 'I-DocAssistance_token'
const USER_KEY = 'I-DocAssistance_admin_user'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY)
    const token = localStorage.getItem(TOKEN_KEY)
    if (stored && token) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        /* corrupted storage -- treat as logged out */
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setError('')
    try {
      const res = await apiLogin(email, password)
      if (res.data.user.role !== 'admin') {
        setError('This login is for clinic admins. Use the doctor portal instead.')
        return
      }
      localStorage.setItem(TOKEN_KEY, res.data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user))
      setUser(res.data.user)
    } catch {
      setError('Incorrect email or password.')
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout, error }}>{children}</Ctx.Provider>
}
