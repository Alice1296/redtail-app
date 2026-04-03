'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // 1. Registrazione su Supabase Auth
    // Il Trigger SQL che abbiamo creato su Supabase si attiverà DA SOLO
    // e creerà la riga nella tabella 'profiles'.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(`Errore: ${error.message}`)
    } else {
      setMessage("Registrazione completata! Verrai reindirizzato al login...")
      // Aspettiamo 2 secondi per far vedere il messaggio e poi torniamo in home
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="text-center">
           <Image src="/logo.png" alt="Logo" width={60} height={60} className="mx-auto mb-4" />
           <h2 className="text-2xl font-black uppercase italic text-red-500">Unisciti al Program</h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="La tua Email"
            className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 transition-all"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Scegli una Password"
            className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-white"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            disabled={loading}
            className="w-full bg-red-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creazione...' : 'Registrati'}
          </button>
        </form>
        {message && (
          <p className="text-center text-xs font-bold text-zinc-400 mt-4 animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}