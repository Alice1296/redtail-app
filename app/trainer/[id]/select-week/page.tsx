'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { WeekSelector } from '@/app/components/WeekSelector'

export default function TrainerSelectWeekPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
      }
    }

    checkUser()
  }, [router])

  useEffect(() => {
    async function loadClientName() {
      if (!id) {
        return
      }

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', id)
          .maybeSingle()

        const fullName =
          profileData?.first_name && profileData?.last_name
            ? `${profileData.first_name} ${profileData.last_name}`
            : profileData?.email || 'Cliente'

        setClientName(fullName)
      } catch (error) {
        console.error('Errore caricamento cliente:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClientName()
  }, [id])

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week)
  }

  const handleContinue = () => {
    router.push(`/trainer/${id}/select-day?week=${selectedWeek}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-zinc-400">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Seleziona Settimana
          </h1>
          <p className="mt-2 text-zinc-400">
            Allena: <span className="text-white font-medium">{clientName}</span>
          </p>
        </div>

        <div className="space-y-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
            <WeekSelector
              currentWeek={selectedWeek}
              onWeekChange={handleWeekChange}
              clientId={id}
              maxVisibleWeeks={12}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => router.push('/trainer')}
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
