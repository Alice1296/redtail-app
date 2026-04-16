'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    // Estrai il token dal fragment (#access_token=...)
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      setTokenValid(true)
    } else {
      setMessage('Link scaduto o non valido. Richiedi un nuovo reset password.')
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Errore: ' + error.message)
    } else {
      setMessage('Password aggiornata! Ora fai login.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <form onSubmit={handleReset} className="bg-zinc-900 p-8 rounded-xl space-y-4 w-full max-w-sm border border-zinc-800">
        <h1 className="text-2xl font-black text-red-600 italic uppercase tracking-wider">Reset Password</h1>

        {!tokenValid && (
          <div className="bg-red-950/30 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm">
            {message || 'Caricamento...'}
          </div>
        )}

        {tokenValid && (
          <>
            <input
              type="password"
              placeholder="Nuova password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-white focus:border-red-600 outline-none"
              required
              minLength={6}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 p-3 rounded-lg font-bold uppercase hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Aggiornando...' : 'Aggiorna Password'}
            </button>

            {message && <p className="text-sm text-center text-zinc-400">{message}</p>}
          </>
        )}
      </form>
    </div>
  )
}