'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password errati')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'trainer') {
      window.location.href = '/trainer'
    } else {
      window.location.href = '/client'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black text-white text-center mb-2 uppercase italic">FitApp</h1>
        <p className="text-zinc-500 text-center mb-8 text-sm uppercase tracking-widest">Il tuo allenamento</p>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-900 text-white border-2 border-zinc-700 rounded-lg p-4 focus:border-blue-500 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-zinc-900 text-white border-2 border-zinc-700 rounded-lg p-4 focus:border-blue-500 outline-none"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-lg text-lg uppercase tracking-wider hover:bg-blue-500 transition-all"
          >
            {loading ? 'Caricamento...' : 'Entra'}
          </button>
        </div>
      </div>
    </div>
  )
}