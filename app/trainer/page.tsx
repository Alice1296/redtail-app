'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkUserAndLoad()
  }, [])

  async function checkUserAndLoad() {
    try {
      setLoading(true)
      
      // 1. Verifica se l'utente è loggato
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // 2. Carica i profili senza filtri stringenti (evita l'Error 400)
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .order('email', { ascending: true })

      if (dbError) throw dbError

      setClients(data || [])
    } catch (err: any) {
      console.error("Errore Redtail:", err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-500 font-black uppercase italic animate-pulse">Caricamento Atleti...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-black text-red-600 mb-8 uppercase italic tracking-tighter border-b-2 border-red-600 pb-2">
          Atleti Redtail
        </h1>

        {error && (
          <div className="bg-red-900/20 border border-red-600 p-4 rounded-xl mb-6 text-red-500 text-xs">
            Errore: {error}
          </div>
        )}

        <div className="space-y-4">
          {clients.length > 0 ? (
            clients.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/trainer/${c.id}`)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-red-600 hover:bg-zinc-800/50 transition-all flex justify-between items-center group shadow-xl"
              >
                <div>
                  <p className="font-black text-lg uppercase italic group-hover:text-red-500 transition-colors">
                    {/* Se il nome è null, mostra la parte prima della @ dell'email */}
                    {c.name || c.email?.split('@')[0] || 'Atleta Anonimo'}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">{c.email}</p>
                </div>
                <div className="bg-zinc-800 group-hover:bg-red-600 p-2 rounded-full transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-600 font-black uppercase italic">Nessun atleta registrato</p>
              <p className="text-[10px] text-zinc-700 mt-2">Verifica la tabella 'profiles' su Supabase</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}