'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Controllo preventivo: se l'utente è già loggato, mandalo via dalla login
  useEffect(() => {
    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Se c'è già una sessione, recuperiamo il ruolo e reindirizziamo
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        router.replace(profile?.role === 'trainer' ? '/trainer' : '/client')
      }
    }
    checkActiveSession()
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. AUTENTICAZIONE
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw new Error('Email o password non corrette.')

      if (!authData.user) throw new Error('Impossibile recuperare i dati utente.')

      // 2. RECUPERO PROFILO (Ruolo)
      // Usiamo un timeout logico o un fallback per evitare blocchi infiniti
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle() // maybeSingle non lancia errore se non trova nulla

      if (profileError) {
        console.error("Errore recupero profilo:", profileError)
        // Se c'è un errore di database (es. RLS), facciamo il login come client per default
      }

      // 3. REDIRECT
      // Usiamo router.push o window.location per assicurarci che il middleware legga i nuovi cookie
      const targetPath = profile?.role === 'trainer' ? '/trainer' : '/client'
      
      // window.location.href è più drastico e pulisce lo stato, spesso meglio per il login
      window.location.href = targetPath

    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore imprevisto.')
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setEmail('')
    setPassword('')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* SEZIONE LOGO */}
      <div className="flex flex-col items-center mb-12 text-center animate-in fade-in duration-700">
        <Image 
          src="/logo.png" 
          alt="Redtail Logo" 
          width={120} 
          height={120} 
          className="mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          priority
        />
        <h1 className="text-4xl font-black italic text-red-600 uppercase tracking-tighter">
          Redtail Program
        </h1>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-2 opacity-80">
          The Training Evolution
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-end">
          <button
            onClick={handleLogout}
            className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* MESSAGGIO ERRORE */}
          {error && (
            <div className="bg-red-950/30 border border-red-500/50 text-red-400 p-4 rounded-2xl text-sm text-center font-semibold animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all placeholder:text-zinc-600 shadow-inner"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-red-600 transition-all placeholder:text-zinc-600 shadow-inner"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest text-lg hover:bg-red-700 active:scale-[0.98] transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </span>
            ) : 'Entra'}
          </button>
        </form>

        {/* REGISTRAZIONE */}
        <div className="text-center pt-6 border-t border-zinc-900/50">
          <p className="text-zinc-500 text-xs uppercase font-black tracking-widest mb-4 opacity-50">
            Nuovo atleta?
          </p>
          <Link 
            href="/register" 
            className="inline-block w-full bg-transparent border border-zinc-800 p-4 rounded-2xl font-black uppercase italic tracking-widest text-sm text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-900/30 transition-all active:scale-95"
          >
            Crea il tuo Account
          </Link>
          
          <button 
            onClick={() => {/* funzione reset password */}}
            className="mt-6 text-zinc-600 text-[10px] uppercase font-bold tracking-tighter hover:text-red-500 transition-colors"
          >
            Hai dimenticato la password?
          </button>
        </div>
      </div>

      <p className="text-zinc-900 mt-12 font-mono text-[9px] uppercase tracking-[0.3em]">
        Redtail System v1.1 | Secure Authentication
      </p>
    </div>
  )
}