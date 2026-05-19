'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ResetMode = 'request' | 'update'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [mode, setMode] = useState<ResetMode>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function prepareRecoverySession() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const queryAccessToken = url.searchParams.get('access_token')
      const queryRefreshToken = url.searchParams.get('refresh_token')
      const queryType = url.searchParams.get('type')
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const hashAccessToken = hash.get('access_token')
      const hashRefreshToken = hash.get('refresh_token')
      const hashType = hash.get('type')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setMessage('Link scaduto o non valido. Richiedi un nuovo reset password.')
          setMode('request')
          return
        }

        window.history.replaceState({}, document.title, '/reset-password')
        setMode('update')
        return
      }

      const accessToken = queryAccessToken || hashAccessToken
      const refreshToken = queryRefreshToken || hashRefreshToken
      const type = queryType || hashType

      if (accessToken && refreshToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          setMessage('Link scaduto o non valido. Richiedi un nuovo reset password.')
          setMode('request')
          return
        }

        window.history.replaceState({}, document.title, '/reset-password')
        setMode('update')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      setMode(session ? 'update' : 'request')
    }

    prepareRecoverySession()
  }, [])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || fallbackOrigin
    const resetRedirect = `${redirectTo}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirect,
    })

    setMessage(
      error
        ? `Errore: ${error.message}`
        : 'Ti ho inviato il link per recuperare la password. Controlla anche spam/promozioni.'
    )
    setLoading(false)
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Errore: ' + error.message)
      setLoading(false)
      return
    }

    setMessage('Password aggiornata. Ora puoi entrare.')
    setPassword('')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-red-600 italic uppercase tracking-wider">
            Recupera Password
          </h1>
          <p className="text-xs text-zinc-500">
            {mode === 'request'
              ? 'Inserisci la tua email e riceverai il link di reset.'
              : 'Scegli una nuova password per il tuo account.'}
          </p>
        </div>

        {mode === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full p-3 bg-black border border-zinc-800 rounded-lg text-white focus:border-red-600 outline-none"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 p-3 rounded-lg font-bold uppercase hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Invio...' : 'Invia link reset'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nuova password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full p-3 pr-20 bg-black border border-zinc-800 rounded-lg text-white focus:border-red-600 outline-none"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-400 transition-colors hover:text-red-400"
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showPassword ? 'Nascondi' : 'Mostra'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 p-3 rounded-lg font-bold uppercase hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Aggiornando...' : 'Aggiorna password'}
            </button>
          </form>
        )}

        {message && (
          <div className="rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-300">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full text-zinc-500 text-[10px] uppercase font-black tracking-widest hover:text-red-500 transition-colors"
        >
          Torna al login
        </button>
      </div>
    </div>
  )
}
