'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Seleziona Giorno
          </h1>
          <p className="mt-2 text-zinc-400">
            Settimana {week} • Scegli il giorno di allenamento
          </p>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DAYS_ORDER.map((day) => (
              <button
                key={day}
                onClick={() => handleDaySelect(day)}
                className={`rounded-lg px-4 py-4 font-medium transition-colors ${
                  selectedDay === day
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                {DAYS_IT[day]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => router.push(`/client/select-week`)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Cambia Settimana
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Inizia Allenamento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
