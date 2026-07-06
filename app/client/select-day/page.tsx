'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'

const DAYS_IT = {
  monday: 'Lunedì',
  tuesday: 'Martedì',
  wednesday: 'Mercoledì',
  thursday: 'Giovedì',
  friday: 'Venerdì',
  saturday: 'Sabato',
  sunday: 'Domenica',
}

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

type DayKey = typeof DAYS_ORDER[number]

export default function SelectDayPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-400">Caricamento...</div></div>}>
      <SelectDayPage />
    </Suspense>
  )
}

function SelectDayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const week = searchParams.get('week') || '1'
  const [selectedDay, setSelectedDay] = useState<DayKey>('monday')

  const handleDaySelect = (day: DayKey) => {
    setSelectedDay(day)
  }

  const handleContinue = () => {
    router.push(`/client?week=${week}&day=${selectedDay}`)
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
            Seleziona Giorno
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Settimana {week} &bull; Scegli il giorno di allenamento
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DAYS_ORDER.map((day) => (
              <button
                key={day}
                onClick={() => handleDaySelect(day)}
                className={`rounded-xl border px-4 py-4 text-[11px] font-black uppercase tracking-widest transition-all ${
                  selectedDay === day
                    ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-600 hover:text-red-400'
                }`}
              >
                {DAYS_IT[day]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/client/select-week`)}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-600 hover:text-red-400"
            >
              Cambia Settimana
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase italic tracking-widest shadow-xl shadow-red-600/30 transition-all active:scale-95 hover:bg-red-700"
            >
              Inizia Allenamento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
