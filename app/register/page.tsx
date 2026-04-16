'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [lastAttempt, setLastAttempt] = useState(0)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // Rudimentary rate limiting al client: minimo 3 secondi tra i tentativi
    const now = Date.now()
    if (now - lastAttempt < 3000) {
      setMessage('Attendi qualche secondo prima di riprovare')
      setLoading(false)
      return
    }
    setLastAttempt(now)
    
    // 1. Eseguiamo SOLO il signUp. 
    // Il Trigger SQL su Supabase creerà automaticamente la riga in 'profiles'.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      if (error.message.includes('rate limit')) {
        setMessage('Troppi tentativi. Attendi 15-30 minuti e riprova.')
      } else if (error.message.includes('already registered')) {
        setMessage('Questa email è già registrata!')
      } else {
        setMessage(`Errore: ${error.message}`)
      }
    } else {
      setMessage("Registrazione completata! Reindirizzamento...")
      // Piccola attesa e poi torniamo alla home per il login
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-8 bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="text-center">
           <Image src="/logo.png" alt="Logo" width={80} height={80} className="mx-auto mb-4" />
           <h2 className="text-2xl font-black uppercase italic text-red-500 tracking-tighter">
             Unisciti al Program
           </h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="La tua Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-white"
            required
          />
          <input
            type="password"
            placeholder="Password (min. 6 caratteri)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 transition-all text-white"
            required
          />
          <button
            disabled={loading}
            className="w-full bg-red-600 py-4 rounded-xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-600/20"
          >
            {loading ? 'Creazione...' : 'Registrati'}
          </button>
        </form>
        
        {message && (
          <p className={`text-center text-xs font-bold mt-4 p-3 rounded-lg ${
            message.includes('completata') 
              ? 'bg-green-600/20 text-green-400 border border-green-600' 
              : 'bg-red-600/20 text-red-400 border border-red-600'
          }`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}