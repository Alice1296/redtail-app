'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { WeekSelector } from '@/app/components/WeekSelector'

type ClientProfile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role?: string | null
}

type WorkoutRow = {
  client_id: string
  week_number: number
  day: string
}

const DAYS_IN_WEEK = 7

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [weekStatus, setWeekStatus] = useState<Record<string, number>>({})
  const [currentWeek, setCurrentWeek] = useState(1)
  const [loading, setLoading] = useState(true)
  const [sendingWeek, setSendingWeek] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [sendFeedback, setSendFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/')
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, role')
          .order('first_name', { ascending: true })

        if (profileError) {
          throw profileError
        }

        const filteredProfiles = (profileData || []).filter(
          (profile) => profile.id !== user.id && profile.role !== 'trainer'
        )
        setClients(filteredProfiles as ClientProfile[])

        const { data: workoutData, error: workoutError } = await supabase
          .from('workouts')
          .select('client_id, week_number, day')

        if (workoutError) {
          throw workoutError
        }

        const statusMap: Record<string, Set<string>> = {}

        ;((workoutData || []) as WorkoutRow[]).forEach((workout) => {
          const key = `${workout.client_id}-${workout.week_number}`

          if (!statusMap[key]) {
            statusMap[key] = new Set()
          }

          statusMap[key].add(workout.day)
        })

        const finalStatus: Record<string, number> = {}

        Object.keys(statusMap).forEach((key) => {
          finalStatus[key] = statusMap[key].size
        })

        setWeekStatus(finalStatus)
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Errore nel caricamento degli atleti'
        )
      } finally {
        setLoading(false)
      }
    }

    loadPage()
  }, [router])

  function getClientLabel(client: ClientProfile) {
    if (client.first_name && client.last_name) {
      return `${client.first_name} ${client.last_name}`
    }

    return client.email?.split('@')[0] || 'Atleta anonimo'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleDeleteClient(client: ClientProfile) {
    const clientLabel = getClientLabel(client)
    const confirmed = confirm(
      `Eliminare definitivamente l'account di ${clientLabel}? Questa azione cancellerà anche schede, feedback, notifiche e video caricati.`
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingClientId(client.id)
      setError(null)
      setSendFeedback(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/admin/delete-client', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ clientId: client.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Eliminazione atleta non riuscita')
      }

      setClients((current) => current.filter((item) => item.id !== client.id))
      setWeekStatus((current) => {
        const next = { ...current }
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${client.id}-`)) {
            delete next[key]
          }
        })
        return next
      })
      setSendFeedback(`${clientLabel} eliminato correttamente.`)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Errore durante eliminazione atleta'
      )
    } finally {
      setDeletingClientId(null)
    }
  }

  async function handleSendWeekReady() {
    try {
      setSendingWeek(true)
      setSendFeedback(null)

      const response = await fetch('/api/notify-week-ready', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weekNumber: currentWeek }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Invio notifiche non riuscito')
      }

      const emailMessage = result.firstEmailError
        ? `Email inviate: ${result.emailsSent}. Email fallite: ${result.emailsFailed}. Primo errore: ${result.firstEmailError}`
        : `Email inviate: ${result.emailsSent}`

      setSendFeedback(
        `Settimana ${currentWeek}: notifiche create ${result.notificationsCreated}. ${emailMessage}.`
      )
    } catch (err: unknown) {
      setSendFeedback(
        err instanceof Error ? err.message : 'Errore durante l’invio'
      )
    } finally {
      setSendingWeek(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-500 font-black uppercase italic animate-pulse">
          Caricamento atleti...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-md mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8 border-b-2 border-red-600 pb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-red-600 uppercase italic tracking-tighter">
              Atleti Redtail
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>

        <div className="mb-6">
          <WeekSelector
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
            maxVisibleWeeks={8}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-600/50 bg-red-600/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 space-y-3">
          <button
            onClick={() => router.push('/community')}
            className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl font-black uppercase italic tracking-widest text-sm hover:border-red-600 hover:text-red-400 transition-all"
          >
            Apri community e leaderboard
          </button>

          <button
            onClick={handleSendWeekReady}
            disabled={sendingWeek || clients.length === 0}
            className="w-full bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest text-sm hover:bg-red-700 active:scale-[0.98] transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingWeek
              ? `Invio settimana ${currentWeek}...`
              : `Invia settimana ${currentWeek} a tutti`}
          </button>

          {sendFeedback && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-300">
              {sendFeedback}
            </div>
          )}

          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">
            Ogni click reinvia notifiche ed email per la settimana selezionata.
          </p>
        </div>

        <div className="space-y-4">
          {clients.length > 0 ? (
            clients.map((client) => {
              const completedDays =
                weekStatus[`${client.id}-${currentWeek}`] || 0
              const isComplete = completedDays === DAYS_IN_WEEK

              return (
                <div
                  key={client.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-red-600 hover:bg-zinc-800/50 transition-all flex justify-between items-center gap-4 group shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/trainer/${client.id}/select-week`)}
                    className="flex flex-1 items-center justify-between gap-4 text-left"
                    aria-label={`Apri profilo di ${getClientLabel(client)}`}
                  >
                    <div className="flex-1">
                      <p className="font-black text-lg uppercase italic group-hover:text-red-500 transition-colors">
                        {getClientLabel(client)}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tight border ${
                            isComplete
                              ? 'bg-green-600/20 text-green-400 border-green-600/50'
                              : completedDays > 0
                                ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/50'
                                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                          }`}
                        >
                          {isComplete
                            ? `Settimana ${currentWeek} completa`
                            : `${completedDays}/${DAYS_IN_WEEK} giorni`}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-full bg-zinc-800 p-2 transition-all group-hover:bg-red-600">
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
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClient(client)}
                    disabled={deletingClientId === client.id}
                    className="flex-shrink-0 min-w-[88px] rounded-xl border border-red-600/60 bg-red-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-400 hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Elimina ${getClientLabel(client)}`}
                  >
                    {deletingClientId === client.id ? 'Eliminazione...' : 'Elimina'}
                  </button>
                </div>
              )
            })
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-600 font-black uppercase italic">
                Nessun atleta registrato
              </p>
              <p className="text-[10px] text-zinc-700 mt-2">
                Verifica la tabella profiles su Supabase
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
