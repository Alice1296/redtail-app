'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WeekSelector } from '@/app/components/WeekSelector'

export default function SelectWeekPage() {
  const router = useRouter()
  const [selectedWeek, setSelectedWeek] = useState(1)

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week)
  }

  const handleContinue = () => {
    router.push(`/client/select-day?week=${selectedWeek}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Seleziona Settimana
          </h1>
          <p className="mt-2 text-zinc-400">
            Scegli la settimana di allenamento
          </p>
        </div>

        <div className="space-y-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <WeekSelector
              currentWeek={selectedWeek}
              onWeekChange={handleWeekChange}
              maxVisibleWeeks={12}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Indietro
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Continua
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
