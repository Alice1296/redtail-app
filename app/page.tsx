'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 1. Eseguiamo il login
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Credenziali non valide. Riprova.')
      setLoading(false)
      return
    }

    /**
     * 2. LA SVOLTA:
     * Invece di fare mille controlli qui, ricarichiamo la radice ('/').
     * Il tuo file 'proxy.ts' intercetterà la richiesta, leggerà il ruolo dal DB
     * e spedirà l'utente su /client o /trainer in un millisecondo.
     */
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* AREA LOGO E TITOLO */}
      <div className="flex flex-col items-center mb-12 text-center">
        <Image 
          src="/logo.png" 
          alt="Redtail Logo" 
          width={120} 
          height={120} 
          className="mb-4"
          priority // Aggiunto per caricare il logo subito
        />
        <h1 className="text-4xl font-black italic text-red-500 uppercase tracking-tighter">
          Redtail Program
        </h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">
          Il tuo allenamento, evoluto.
        </p>
      </div>

      {/* FORM DI LOGIN */}
      <div className="w-full max-w-sm space-y-6">
        <form onSubmit={handleLogin} className="space-y-4">
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
            className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-500 transition-all placeholder:text-zinc-600"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-red-500 transition-all placeholder:text-zinc-600"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 p-4 rounded-xl font-black uppercase italic tracking-widest text-lg hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entra'}
          </button>
        </form>

        {/* --- TASTO REGISTRAZIONE --- */}
        <div className="text-center pt-4 border-t border-zinc-900">
          <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mb-4">
            Nuovo atleta?
          </p>
          <Link 
            href="/register" 
            className="inline-block w-full bg-transparent border border-zinc-800 p-4 rounded-xl font-black uppercase italic tracking-widest text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all active:scale-95"
          >
            Crea il tuo Account
          </Link>
        </div>
      </div>

      <p className="text-zinc-800 mt-16 font-mono text-[10px] uppercase tracking-widest">
        Redtail v1.0 | © 2026
      </p>
    </div>
  )
}