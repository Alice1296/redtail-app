'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WeekSelector } from '@/app/components/WeekSelector'
import { supabase } from '@/lib/supabaseClient'

export default function SelectWeekPage() {
  const router = useRouter()
  const [selectedWeek, setSelectedWeek] = useState(1)

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week)
  }

  const handleContinue = () => {
    router.push(`/client/select-day?week=${selectedWeek}`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-black p-4 font-sans text-white sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleLogout}
            className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>

        <div className="mb-10 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Redtail Logo"
            width={72}
            height={72}
            className="mb-3 drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            priority
          />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-red-600">
            Seleziona Settimana
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Scegli la settimana di allenamento
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl sm:p-6">
            <WeekSelector
              currentWeek={selectedWeek}
              onWeekChange={handleWeekChange}
              maxVisibleWeeks={12}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-600 hover:text-red-400"
            >
              Indietro
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase italic tracking-widest shadow-xl shadow-red-600/30 transition-all active:scale-95 hover:bg-red-700"
            >
              Continua
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
