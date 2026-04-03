'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage(`Errore: ${error.message}`)
    } else {
      setMessage("Account creato! Ora puoi accedere dalla homepage.")
      setTimeout(() => window.location.href = '/', 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-3xl border border-zinc-800">
        <h2 className="text-2xl font-black uppercase italic text-red-500 mb-6 text-center">Registrati</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none" onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none" onChange={(e) => setPassword(e.target.value)} required />
          <button disabled={loading} className="w-full bg-red-600 py-4 rounded-xl font-black uppercase tracking-widest">{loading ? '...' : 'Crea Account'}</button>
        </form>
        {message && <p className="text-center text-xs mt-4 text-zinc-400">{message}</p>}
      </div>
    </div>
  )
}