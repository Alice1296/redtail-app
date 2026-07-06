'use client'

import Image from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
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

export default function TrainerSelectDayPageWrapper() {
  const params = useParams<{ id: string }>()

  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-400">Caricamento...</div></div>}>
      <TrainerSelectDayPage id={params.id} />
    </Suspense>
  )
}

function TrainerSelectDayPage({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const week = searchParams.get('week') || '1'
  const [selectedDay, setSelectedDay] = useState<DayKey>('monday')
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

  const handleDaySelect = (day: DayKey) => {
    setSelectedDay(day)
  }

  const handleContinue = () => {
    router.push(`/trainer/${id}?week=${week}&day=${selectedDay}`)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 font-sans sm:p-6">
        <p className="text-red-500 font-black uppercase italic animate-pulse">
          Caricamento...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-4 font-sans text-white sm:p-6">
      <div className="mx-auto max-w-2xl">
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
            <span className="text-red-400">{clientName}</span> &bull; Settimana {week}
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
              onClick={() => router.push(`/trainer/${id}/select-week`)}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-600 hover:text-red-400"
            >
              Cambia Settimana
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase italic tracking-widest shadow-xl shadow-red-600/30 transition-all active:scale-95 hover:bg-red-700"
            >
              Modifica Allenamento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
