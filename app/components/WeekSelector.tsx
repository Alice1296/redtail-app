'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type WeekInfo = {
  week: number
  hasWorkouts: boolean
  lastModified: string | null
}

function formatLastModified(dateString: string | null): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'adesso'
    if (diffMins < 60) return `${diffMins}m fa`
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays === 0) return 'oggi'
    if (diffDays === 1) return 'ieri'
    if (diffDays < 7) return `${diffDays}g fa`

    return new Intl.DateTimeFormat('it-IT', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return ''
  }
}

interface WeekSelectorProps {
  currentWeek: number
  onWeekChange: (week: number) => void
  clientId?: string
  maxVisibleWeeks?: number
}

export function WeekSelector({
  currentWeek,
  onWeekChange,
  clientId,
  maxVisibleWeeks = 12,
}: WeekSelectorProps) {
  const [weeks, setWeeks] = useState<WeekInfo[]>([])
  const [lastModifiedWeek, setLastModifiedWeek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const activeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    async function loadWeeks() {
      try {
        setLoading(true)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        const query = clientId ? `?clientId=${clientId}` : ''
        const response = await fetch(`/api/weeks-info${query}`, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        })

        if (response.ok) {
          const payload = await response.json()
          setWeeks(payload.weeks || [])
          setLastModifiedWeek(payload.lastModifiedWeek)
        }
      } catch (error) {
        console.error('Errore caricamento settimane:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWeeks()
  }, [clientId])

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [currentWeek])

  // Genera dinamicamente le settimane da visualizzare
  // Se currentWeek è nei dati, mostra da max(1, currentWeek - 2) a currentWeek + 10
  // Altrimenti mostra da 1 a 12
  const getVisibleWeeks = (): number[] => {
    const startWeek = Math.max(1, currentWeek - 2)
    const endWeek = startWeek + maxVisibleWeeks - 1
    return Array.from({ length: endWeek - startWeek + 1 }, (_, i) => startWeek + i)
  }

  const visibleWeeks = getVisibleWeeks()
  const weekMap: Record<number, WeekInfo> = {}
  weeks.forEach((w) => {
    weekMap[w.week] = w
  })

  const canScrollLeft = visibleWeeks[0] > 1
  const canScrollRight = visibleWeeks[visibleWeeks.length - 1] < Math.max(...weeks.map((w) => w.week), currentWeek) + 5

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
          Settimane
        </span>
        {lastModifiedWeek && (
          <span className="text-[9px] text-zinc-600 font-black italic">
            Ultima modifica: W{lastModifiedWeek}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Left Fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none rounded-l-xl" />
        )}

        {/* Weeks Scroll Container */}
        <div className="overflow-x-auto no-scrollbar rounded-xl bg-zinc-950 border border-zinc-800 p-2">
          <div className="flex gap-1 min-w-max">
            {visibleWeeks.map((week) => {
              const weekInfo = weekMap[week]
              const isCurrentWeek = week === currentWeek
              const isLastModified = week === lastModifiedWeek
              const hasData = weekInfo?.hasWorkouts

              return (
                <button
                  key={week}
                  ref={isCurrentWeek ? activeButtonRef : undefined}
                  onClick={() => onWeekChange(week)}
                  className={`
                    relative min-w-[60px] py-2.5 px-3 rounded-lg font-black text-[10px]
                    border transition-all duration-200 flex flex-col items-center gap-0.5
                    ${
                      isCurrentWeek
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                        : isLastModified
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-lg shadow-amber-600/20'
                          : hasData
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                    }
                  `}
                  title={
                    weekInfo?.lastModified
                      ? `Ultimo aggiornamento: ${new Date(weekInfo.lastModified).toLocaleDateString('it-IT')}`
                      : 'Nessun dato'
                  }
                >
                  <span className="tracking-wider">W{week}</span>

                  {/* Badge di modifica recente */}
                  {isLastModified && !isCurrentWeek && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                  )}

                  {/* Dot verde se ha dati */}
                  {hasData && !isCurrentWeek && !isLastModified && (
                    <span className="w-1 h-1 bg-green-500/60 rounded-full" />
                  )}

                  {/* Time label se modificato recentemente */}
                  {weekInfo?.lastModified && (
                    <span className="text-[7px] text-zinc-500 font-bold">
                      {formatLastModified(weekInfo.lastModified)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none rounded-r-xl" />
        )}
      </div>

      {/* Navigation Arrows */}
      <div className="flex justify-between gap-2 px-1">
        <button
          onClick={() => {
            const newWeek = Math.max(1, currentWeek - 5)
            onWeekChange(newWeek)
          }}
          className="flex-1 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase p-1 border border-zinc-800 rounded-lg transition-colors"
        >
          ← Indietro
        </button>
        <button
          onClick={() => {
            onWeekChange(currentWeek + 5)
          }}
          className="flex-1 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase p-1 border border-zinc-800 rounded-lg transition-colors"
        >
          Avanti →
        </button>
      </div>
    </div>
  )
}
