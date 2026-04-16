'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <form onSubmit={handleReset} className="bg-zinc-900 p-8 rounded-xl space-y-4 w-full max-w-sm">
        <h1 className="text-xl font-bold text-red-500">Nuova Password</h1>

        <input
          type="password"
          placeholder="Nuova password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-black border border-zinc-700 rounded"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 p-3 rounded font-bold"
        >
          {loading ? 'Aggiornando...' : 'Reset Password'}
        </button>

        {message && <p className="text-sm text-zinc-400">{message}</p>}
      </form>
    </div>
  )
}