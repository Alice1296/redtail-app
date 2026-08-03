'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DAYS, SCORE_TYPE_OPTIONS, type DayKey, type ScoreType } from '@/lib/community'

type ClientProfile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role?: string | null
}

type SectionKey = 'mobility' | 'strength' | 'wod'

const SECTION_OPTIONS: Array<{ value: SectionKey; label: string }> = [
  { value: 'mobility', label: 'Mobility' },
  { value: 'strength', label: 'Strength' },
  { value: 'wod', label: 'WOD' },
]

type AssignResult = {
  clientId: string
  clientName: string
  week?: number
  error?: string
}

export default function NewSchedaPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [day, setDay] = useState<DayKey>('monday')
  const [section, setSection] = useState<SectionKey>('strength')
  const [content, setContent] = useState('')
  const [coachNote, setCoachNote] = useState('')
  const [scoreType, setScoreType] = useState<ScoreType | ''>('')
  const [scoreLabel, setScoreLabel] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<AssignResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadClients() {
      try {
        setLoadingClients(true)

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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Errore caricamento atleti')
      } finally {
        setLoadingClients(false)
      }
    }

    loadClients()
  }, [router])

  function getClientLabel(client: ClientProfile) {
    if (client.first_name && client.last_name) {
      return `${client.first_name} ${client.last_name}`
    }

    return client.email?.split('@')[0] || 'Atleta anonimo'
  }

  function toggleClient(clientId: string) {
    setSelectedClientIds((current) => {
      const next = new Set(current)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  async function handleSubmit() {
    setError(null)
    setResults(null)

    if (!content.trim()) {
      setError('Scrivi il contenuto della scheda')
      return
    }

    if (selectedClientIds.size === 0) {
      setError('Seleziona almeno un cliente')
      return
    }

    try {
      setSubmitting(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/trainer/assign-scheda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          day,
          section,
          content,
          coachNote,
          scoreType: section === 'wod' ? scoreType : '',
          scoreLabel: section === 'wod' ? scoreLabel : '',
          clientIds: Array.from(selectedClientIds),
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Errore creazione scheda')
      }

      setResults(payload.results as AssignResult[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore creazione scheda')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForCreatingAnother() {
    setContent('')
    setCoachNote('')
    setScoreType('')
    setScoreLabel('')
    setSelectedClientIds(new Set())
    setResults(null)
    setError(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.push('/trainer')}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">
            Atleti
          </span>
        </button>

        <div className="text-center flex-1">
          <div className="font-black italic uppercase text-red-500 text-sm tracking-tighter">
            Nuova scheda
          </div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">
            Redtail Coach
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto mt-4">
        <div className="flex flex-col items-center text-center gap-2">
          <Image
            src="/logo.png"
            alt="Redtail Logo"
            width={56}
            height={56}
            className="drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            priority
          />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Scrivi una sezione una sola volta e assegnala a piu atleti: verra
            inserita automaticamente nella prima settimana libera di ciascuno.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-600/50 bg-red-600/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
          <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-4 bg-red-600 rounded-full" />
            Giorno
          </label>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {DAYS.map((dayOption) => (
              <button
                key={dayOption.key}
                type="button"
                onClick={() => setDay(dayOption.key)}
                className={`flex-1 min-w-[55px] py-3 rounded-xl font-black text-[10px] border text-center transition-all ${
                  day === dayOption.key
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-red-600 hover:text-red-400'
                }`}
              >
                {dayOption.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
          <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-4 bg-red-600 rounded-full" />
            Sezione
          </label>
          <div className="flex gap-2">
            {SECTION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSection(option.value)}
                className={`flex-1 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  section === option.value
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-red-600 hover:text-red-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`Scrivi il programma ${section}...`}
            className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-40 text-sm outline-none focus:border-red-600 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-700"
          />

          {section === 'wod' && (
            <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Score per leaderboard (opzionale)
              </p>

              <select
                value={scoreType}
                onChange={(event) => setScoreType(event.target.value as ScoreType | '')}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-200"
              >
                <option value="">Nessun punteggio</option>
                {SCORE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                value={scoreLabel}
                onChange={(event) => setScoreLabel(event.target.value)}
                placeholder="Es. Time cap 12', Max reps, Peso migliore..."
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          )}

          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-xl space-y-2">
            <label className="text-yellow-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-2 bg-yellow-500 rounded-full" />
              Note coach (opzionale)
            </label>
            <textarea
              value={coachNote}
              onChange={(event) => setCoachNote(event.target.value)}
              placeholder={`Note per l'atleta su ${section}...`}
              className="w-full bg-black border border-yellow-700/30 p-3 rounded-lg h-24 text-xs outline-none focus:border-yellow-500 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-red-600 rounded-full" />
              Assegna a
            </label>
            <span className="text-[10px] font-black uppercase text-zinc-600">
              {selectedClientIds.size} selezionati
            </span>
          </div>

          {loadingClients ? (
            <p className="text-center text-zinc-500 text-xs font-black uppercase animate-pulse py-6">
              Caricamento atleti...
            </p>
          ) : clients.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {clients.map((client) => {
                const isSelected = selectedClientIds.has(client.id)
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => toggleClient(client.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'bg-red-600/10 border-red-600 text-red-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-red-600/60'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wide">
                      {getClientLabel(client)}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? 'bg-red-600 border-red-500'
                          : 'border-zinc-600 bg-black/40'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-zinc-600 text-xs font-black uppercase py-6">
              Nessun atleta disponibile
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-red-600/40 active:scale-95 transition-all disabled:opacity-50"
        >
          {submitting ? 'Assegnazione in corso...' : 'Crea scheda e assegna'}
        </button>

        {results && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Risultato assegnazione
            </p>
            {results.map((result) => (
              <div
                key={result.clientId}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs font-bold ${
                  result.error
                    ? 'border-red-600/40 bg-red-600/10 text-red-300'
                    : 'border-green-600/40 bg-green-600/10 text-green-300'
                }`}
              >
                <span>{result.clientName}</span>
                <span>
                  {result.error ? result.error : `Settimana ${result.week}`}
                </span>
              </div>
            ))}

            <button
              type="button"
              onClick={resetForCreatingAnother}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-600 hover:text-red-400"
            >
              Crea un&apos;altra scheda
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
