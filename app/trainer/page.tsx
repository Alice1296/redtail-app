'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')

    setClients(data || [])
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">

      <h1 className="text-2xl font-black text-red-500 mb-6 uppercase">
        Clienti
      </h1>

      <div className="space-y-3">
        {clients.map(c => (
          <div
            key={c.id}
            onClick={() => router.push(`/trainer/${c.id}`)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-red-500 transition-all"
          >
            <p className="font-bold text-lg">{c.name}</p>
            <p className="text-sm text-zinc-400">{c.email}</p>
          </div>
        ))}
      </div>

    </div>
  )
}