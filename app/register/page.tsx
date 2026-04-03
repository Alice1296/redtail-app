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
    
    // 1. Registrazione su Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(`Errore: ${error.message}`)
    } else if (data.user) {
      // 2. Inserimento nel database come CLIENT
      const { error: dbError } = await supabase
        .from('profiles')
        .insert([{ 
          id: data.user.id, 
          email: email, 
          role: 'client' // Fondamentale per distinguerli dal trainer
        }])

      if (dbError) {
        setMessage("Errore nella creazione del profilo.")
      } else {
        setMessage("Registrazione completata! Controlla la mail per confermare (se attivo) o prova a fare il login.")
        setTimeout(() => window.location.href = '/', 2000)
      }
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
            className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-red-600 transition-all"
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
        {message && <p className="text-center text-xs text-zinc-500 mt-4">{message}</p>}
      </div>
    </div>
  )
}