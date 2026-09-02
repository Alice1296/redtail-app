'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { WeekSelector } from '@/app/components/WeekSelector'
import { supabase } from '@/lib/supabaseClient'

type WeekInfo = {
  week: number
  hasWorkouts: boolean
  lastModified: string | null
}

export default function SelectWeekPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [previousWeek, setPreviousWeek] = useState<number | null>(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveWeek, setArchiveWeek] = useState(1)

  useEffect(() => {
    async function loadWeeks() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/')
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        const response = await fetch('/api/weeks-info', {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        })

        let latest = 1

        if (response.ok) {
          const payload = await response.json()
          const weeks = (payload.weeks || []) as WeekInfo[]
          const weeksWithContent = weeks
            .filter((entry) => entry.hasWorkouts)
            .map((entry) => entry.week)

          if (weeksWithContent.length > 0) {
            latest = Math.max(...weeksWithContent)
          } else if (payload.lastModifiedWeek) {
            latest = Number(payload.lastModifiedWeek)
          }
        }

        setCurrentWeek(latest)
        setPreviousWeek(latest > 1 ? latest - 1 : null)
        setArchiveWeek(latest)
      } catch (error) {
        console.error('Errore caricamento settimane:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWeeks()
  }, [router])

  function goToWeek(week: number) {
    router.push(`/client/select-day?week=${week}`)
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

        {loading ? (
          <p className="py-10 text-center text-red-500 font-black uppercase italic animate-pulse">
            Caricamento settimane...
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3">
              <button
                onClick={() => goToWeek(currentWeek)}
                className="rounded-2xl border border-red-500 bg-red-600 px-5 py-5 text-left shadow-xl shadow-red-600/30 transition-all active:scale-[0.98] hover:bg-red-700"
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-white/80">
                  Settimana corrente
                </span>
                <span className="mt-1 block text-2xl font-black italic uppercase tracking-tight text-white">
                  Settimana {currentWeek}
                </span>
              </button>

              {previousWeek !== null && (
                <button
                  onClick={() => goToWeek(previousWeek)}
                  className="rounded-2xl border border-zinc-700 bg-zinc-800 px-5 py-5 text-left transition-all active:scale-[0.98] hover:border-red-600 hover:text-red-400"
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                    Settimana precedente
                  </span>
                  <span className="mt-1 block text-2xl font-black italic uppercase tracking-tight text-zinc-200">
                    Settimana {previousWeek}
                  </span>
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl sm:p-6">
              <button
                onClick={() => setShowArchive((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={showArchive}
              >
                <span>
                  <span className="block text-[11px] font-black uppercase tracking-widest text-zinc-300">
                    Archivio settimane
                  </span>
                  <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Consulta tutte le settimane
                  </span>
                </span>
                <span
                  className={`text-zinc-400 transition-transform ${
                    showArchive ? 'rotate-180' : ''
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              {showArchive && (
                <div className="mt-4 space-y-4">
                  <WeekSelector
                    currentWeek={archiveWeek}
                    onWeekChange={setArchiveWeek}
                    maxVisibleWeeks={12}
                  />
                  <button
                    onClick={() => goToWeek(archiveWeek)}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase italic tracking-widest shadow-xl shadow-red-600/30 transition-all active:scale-95 hover:bg-red-700"
                  >
                    Apri settimana {archiveWeek}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/client/diario')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-600 bg-red-600/10 px-5 py-4 text-[11px] font-black uppercase italic tracking-widest text-red-400 transition-all active:scale-[0.98] hover:bg-red-600/20"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Diario · progressi carichi
            </button>

            <button
              onClick={() => router.back()}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-600 hover:text-red-400"
            >
              Indietro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
