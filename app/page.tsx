'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Credenziali non valide. Riprova.')
      setLoading(false)
      return
    }

    // Controllo Ruolo e Reindirizzamento
    const user = data.user
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single()

    if (profile?.role === 'trainer') {
      window.location.href = '/trainer'
    } else {
      window.location.href = '/client'
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* AREA LOGO E TITOLO */}
      <div className="flex flex-col items-center mb-12 text-center">
        {/* Assicurati di aver messo logo.png in /public */}
        <Image 
          src="/logo.png" 
          alt="Redtail Logo" 
          width={120} 
          height={120} 
          className="mb-4"
        />
        <h1 className="text-4xl font-black italic text-red-500 uppercase tracking-tighter">
          Redtail Program
        </h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">
          Il tuo allenamento, evoluto.
        </p>
      </div>

      {/* FORM DI LOGIN */}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg text-sm text-center font-bold">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-500 transition-all"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-500 transition-all"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 p-4 rounded-xl font-black uppercase italic tracking-widest text-lg hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entra'}
        </button>
      </form>

      <p className="text-xs text-zinc-700 mt-16 font-mono">
        Redtail v1.0 | © 2024
      </p>
    </div>
  )
}