'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkUserAndLoadClients()
  }, [])

  async function checkUserAndLoadClients() {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Se non sei loggato, torna alla home
    if (!user) {
      router.push('/')
      return
    }

    // Carichiamo i profili (quelli creati dal trigger SQL)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setClients(data || [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-black text-red-500 flex items-center justify-center font-black uppercase italic">Loading Redtail...</div>

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-black text-red-500 mb-6 uppercase italic tracking-tighter">
        Atleti Redtail
      </h1>

      <div className="grid gap-4">
        {clients.length > 0 ? clients.map(c => (
          <div
            key={c.id}
            onClick={() => router.push(`/trainer/${c.id}`)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-red-600 hover:bg-zinc-800/50 transition-all group"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-black text-lg group-hover:text-red-500 transition-colors uppercase italic">{c.email.split('@')[0]}</p>
                <p className="text-xs text-zinc-500 font-medium">{c.email}</p>
              </div>
              <div className="text-red-600 font-bold">→</div>
            </div>
          </div>
        )) : (
          <p className="text-zinc-600 font-bold uppercase italic">Nessun atleta registrato.</p>
        )}
      </div>
    </div>
  )
}