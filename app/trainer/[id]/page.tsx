'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { WorkoutParser } from '@/app/components/WorkoutParser'
import {
  DAYS,
  DEFAULT_MAX_LIFTS,
  SCORE_TYPE_OPTIONS,
  TIMER_DURATION_OPTIONS,
  TIMER_PHASE_OPTIONS,
  WOD_MODE_OPTIONS,
  createTimerSegment,
  formatTimerDuration,
  normalizeWodConfig,
  type ScoreType,
  type WodConfig,
  type WodMode,
  type WodTimerPhase,
} from '@/lib/community'

type WorkoutForm = {
  mobility: string
  strength: string
  wod: string
  wod_timer_config: WodConfig | null
  wod_score_type: ScoreType | ''
  wod_score_label: string
  coach_notes_mobility: string
  coach_notes_strength: string
  coach_notes_wod: string
}

type ClientLog = {
  section: string
  notes: string | null
  video_url?: string | null
  video_urls?: string[] | null
}

type VisibleVideoState = Record<string, string[]>

type CleanClientVideosResponse = {
  logs?: ClientLog[]
}

type MaxRow = {
  value: number
  unit: string
}

function getInitialTimerConfig(value?: WodConfig | null) {
  return (
    normalizeWodConfig(value) || {
      mode: 'Free' as WodMode,
      description: '',
      segments: [],
    }
  )
}

const EMPTY_FORM: WorkoutForm = {
  mobility: '',
  strength: '',
  wod: '',
  wod_timer_config: null,
  wod_score_type: '',
  wod_score_label: '',
  coach_notes_mobility: '',
  coach_notes_strength: '',
  coach_notes_wod: '',
}

export default function TrainerPageWrapper() {
  const params = useParams<{ id: string }>()
  
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-400">Caricamento...</div></div>}>
      <TrainerPage id={params.id} />
    </Suspense>
  )
}

function TrainerPage({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize from URL params
  const initialWeek = parseInt(searchParams.get('week') || '1', 10)
  const initialDay = searchParams.get('day') || 'monday'
  
  // Redirect to week/day selector if params missing
  useEffect(() => {
    if (!searchParams.has('week') || !searchParams.has('day')) {
      router.push(`/trainer/${id}/select-week`)
    }
  }, [searchParams, router, id])
  
  const [week, setWeek] = useState(initialWeek)
  const [activeDay, setActiveDay] = useState(initialDay)
  const [clientName, setClientName] = useState('')
  const [form, setForm] = useState<WorkoutForm>(EMPTY_FORM)
  const [logs, setLogs] = useState<Record<string, ClientLog>>({})
  const [maxValues, setMaxValues] = useState<Record<string, MaxRow>>({})
  const [visibleVideos, setVisibleVideos] = useState<VisibleVideoState>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [timerAppliedMessage, setTimerAppliedMessage] = useState('')

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
    async function loadPageData() {
      if (!id) {
        return
      }

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
      setLogs({})
      setMaxValues({})
      setVisibleVideos({})
      setForm(EMPTY_FORM)

      try {
        const maxesResponse = await fetch(`/api/maxes?clientId=${id}`)
        if (maxesResponse.ok) {
          const maxesPayload = await maxesResponse.json()
          setMaxValues((maxesPayload.values || {}) as Record<string, MaxRow>)
        }
      } catch (error) {
        console.error('Errore caricamento massimali atleta:', error)
      }

      const { data: workoutData } = await supabase
        .from('workouts')
        .select('*')
        .eq('client_id', id)
        .eq('week_number', Number(week))
        .eq('day', activeDay)
        .maybeSingle()

      if (workoutData) {
        let legacyTimerConfig: WodConfig | null = null

        if (
          typeof workoutData.wod === 'string' &&
          workoutData.wod.trim().startsWith('{')
        ) {
          try {
            legacyTimerConfig = JSON.parse(workoutData.wod) as WodConfig
          } catch {}
        }

        const coachNotes =
          typeof workoutData.coach_notes === 'string'
            ? JSON.parse(workoutData.coach_notes || '{}')
            : workoutData.coach_notes || {}

        setForm({
          mobility:
            typeof workoutData.mobility === 'string' ? workoutData.mobility : '',
          strength:
            typeof workoutData.strength === 'string' ? workoutData.strength : '',
          wod:
            legacyTimerConfig?.description ||
            (typeof workoutData.wod === 'string' &&
            !workoutData.wod.trim().startsWith('{')
              ? workoutData.wod
              : ''),
          wod_timer_config: getInitialTimerConfig(
            coachNotes.wod_timer_config || legacyTimerConfig
          ),
          wod_score_type: coachNotes.wod_score_type || '',
          wod_score_label: coachNotes.wod_score_label || '',
          coach_notes_mobility: coachNotes.mobility || '',
          coach_notes_strength: coachNotes.strength || '',
          coach_notes_wod: coachNotes.wod || '',
        })
      }

      const { data: logData } = await supabase
        .from('client_logs')
        .select('*')
        .eq('client_id', id)
        .eq('week_number', Number(week))
        .eq('day', activeDay)

      let sanitizedLogs = ((logData || []) as ClientLog[]).map((log) => ({
        ...log,
      }))

      try {
        const cleanupResponse = await fetch('/api/admin/clean-client-videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: id,
            weekNumber: Number(week),
            day: activeDay,
          }),
        })

        if (cleanupResponse.ok) {
          const cleanupPayload =
            (await cleanupResponse.json()) as CleanClientVideosResponse

          if (Array.isArray(cleanupPayload.logs)) {
            sanitizedLogs = cleanupPayload.logs
          }
        }
      } catch (error) {
        console.error('Errore pulizia video atleta:', error)
      }

      const map: Record<string, ClientLog> = {}

      sanitizedLogs.forEach((log) => {
        map[log.section] = log
      })

      setLogs(map)

      const nextVisibleVideos: VisibleVideoState = {}

      Object.entries(map).forEach(([section, log]) => {
        const validUrls =
          Array.isArray(log.video_urls) && log.video_urls.length > 0
            ? log.video_urls
            : log.video_url
              ? [log.video_url]
              : []

        if (validUrls.length > 0) {
          nextVisibleVideos[section] = validUrls
        }
      })

      setVisibleVideos(nextVisibleVideos)
    }

    loadPageData()
  }, [id, week, activeDay])

  async function saveWorkout() {
    setLoading(true)

    const normalizedTimerConfig = normalizeWodConfig({
      ...(form.wod_timer_config || { mode: 'Free' as WodMode }),
      description: form.wod,
    })

    const payload = {
      client_id: id,
      week_number: Number(week),
      day: activeDay,
      mobility: form.mobility,
      strength: form.strength,
      wod: form.wod,
      coach_notes: JSON.stringify({
        mobility: form.coach_notes_mobility,
        strength: form.coach_notes_strength,
        wod: form.coach_notes_wod,
        wod_score_type: form.wod_score_type || null,
        wod_score_label: form.wod_score_label || null,
        wod_timer_config:
          normalizedTimerConfig && normalizedTimerConfig.mode !== 'Free'
            ? normalizedTimerConfig
            : normalizedTimerConfig?.segments?.length
              ? normalizedTimerConfig
              : null,
      }),
    }

    const { error } = await supabase
      .from('workouts')
      .upsert(payload, { onConflict: 'client_id,week_number,day' })

    if (!error) {
      setSaved(true)
      setSaveMessage('Programma salvato')

      setTimeout(() => {
        setSaved(false)
        setSaveMessage('')
      }, 3000)
    }

    setLoading(false)
    return !error
  }

  async function saveWorkoutAndReturn() {
    const success = await saveWorkout()

    if (success) {
      router.push(`/trainer/${id}/select-week`)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function handleDayChange(day: string) {
    if (day === activeDay) {
      return
    }

    setActiveDay(day)
    router.replace(`/trainer/${id}?week=${week}&day=${day}`, { scroll: false })
  }

  async function deleteClientVideo(section: string, videoUrl: string) {
    if (!id || !confirm('Eliminare il video dell atleta?')) {
      return
    }

    try {
      const response = await fetch('/api/delete-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: id,
          section,
          weekNumber: Number(week),
          day: activeDay,
          videoUrl,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Errore eliminazione video')
      }

      setVisibleVideos((current) => ({
        ...current,
        [section]: (current[section] || []).filter((value) => value !== videoUrl),
      }))
      setLogs((current) => {
        const currentLog = current[section]
        if (!currentLog) {
          return current
        }

        const nextVideoUrls = (currentLog.video_urls || []).filter(
          (value) => value !== videoUrl
        )

        return {
          ...current,
          [section]: {
            ...currentLog,
            video_url: null,
            video_urls: nextVideoUrls.length > 0 ? nextVideoUrls : null,
          },
        }
      })
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Errore eliminazione video')
    }
  }

  function updateTimerMode(mode: WodMode) {
    setForm((current) => {
      const timerConfig = getInitialTimerConfig(current.wod_timer_config)

      return {
        ...current,
        wod_timer_config: {
          ...timerConfig,
          mode,
          segments:
            mode === 'Free'
              ? []
              : timerConfig.segments && timerConfig.segments.length > 0
                ? timerConfig.segments
                : [createTimerSegment('work', 6 * 60)],
        },
      }
    })
  }

  function addTimerSegment(phase: WodTimerPhase) {
    setForm((current) => {
      const timerConfig = getInitialTimerConfig(current.wod_timer_config)

      return {
        ...current,
        wod_timer_config: {
          ...timerConfig,
          segments: [...(timerConfig.segments || []), createTimerSegment(phase, 60)],
        },
      }
    })
  }

  function updateTimerSegment(
    segmentId: string,
    updates: Partial<{
      phase: WodTimerPhase
      durationSeconds: number
      label: string
    }>
  ) {
    setForm((current) => {
      const timerConfig = getInitialTimerConfig(current.wod_timer_config)

      return {
        ...current,
        wod_timer_config: {
          ...timerConfig,
          segments: (timerConfig.segments || []).map((segment) =>
            segment.id === segmentId ? { ...segment, ...updates } : segment
          ),
        },
      }
    })
  }

  function removeTimerSegment(segmentId: string) {
    setForm((current) => {
      const timerConfig = getInitialTimerConfig(current.wod_timer_config)

      return {
        ...current,
        wod_timer_config: {
          ...timerConfig,
          segments: (timerConfig.segments || []).filter(
            (segment) => segment.id !== segmentId
          ),
        },
      }
    })
  }

  function applyParsedWorkoutTimer(config: WodConfig) {
    setForm((current) => ({
      ...current,
      wod: config.description || current.wod,
      wod_timer_config: getInitialTimerConfig(config),
    }))
    setSaved(false)
    setTimerAppliedMessage('Timer riconosciuto: salva il programma per inviarlo.')

    setTimeout(() => {
      setTimerAppliedMessage('')
    }, 3000)
  }

  const timerConfig = getInitialTimerConfig(form.wod_timer_config)
  const timerSegments = timerConfig.segments || []
  const totalTimerSeconds = timerSegments.reduce(
    (total, segment) => total + segment.durationSeconds,
    0
  )

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
            {clientName}
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

      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex gap-2">
        <button
          onClick={() => router.push(`/trainer/${id}/select-week`)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all active:scale-95"
        >
          Cambia Settimana (Settimana {week})
        </button>
      </div>

      <div className="flex gap-1 p-2 bg-zinc-900 overflow-x-auto sticky top-[68px] z-40 no-scrollbar border-b border-white/5">
        {DAYS.map((day) => (
          <button
            key={day.key}
            onClick={() => handleDayChange(day.key)}
            className={`flex-1 min-w-[55px] py-3 rounded-xl font-black text-[10px] border text-center transition-all ${
              activeDay === day.key
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-red-600 hover:text-red-400'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto mt-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-red-500">
              Massimali atleta
            </p>
            <span className="text-[10px] font-black uppercase text-zinc-600">
              {Object.keys(maxValues).length} salvati
            </span>
          </div>

          {Object.keys(maxValues).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_MAX_LIFTS.filter((lift) => maxValues[lift]).map((lift) => (
                <div
                  key={lift}
                  className="rounded-xl border border-zinc-800 bg-black/40 p-3"
                >
                  <p className="truncate text-[10px] font-black uppercase text-zinc-500">
                    {lift}
                  </p>
                  <p className="mt-1 text-lg font-black italic text-white">
                    {maxValues[lift].value} {maxValues[lift].unit}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-center text-xs font-bold uppercase text-zinc-600">
              Nessun massimale salvato
            </p>
          )}
        </div>

        {['mobility', 'strength', 'wod'].map((section) => (
          <div
            key={section}
            className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl"
          >
            <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-red-600 rounded-full" />
              {section}
            </label>

            <textarea
              value={form[section as keyof Pick<WorkoutForm, 'mobility' | 'strength' | 'wod'>]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [section]: event.target.value }))
              }
              placeholder={`Scrivi il programma ${section}...`}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-40 text-sm outline-none focus:border-red-600 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-700"
            />

            {section === 'wod' && (
              <div className="space-y-4">
                <WorkoutParser
                  initialText={form.wod}
                  onApply={applyParsedWorkoutTimer}
                />

                {timerAppliedMessage && (
                  <p className="rounded-xl border border-blue-600/40 bg-blue-600/10 p-3 text-center text-[10px] font-black uppercase tracking-wide text-blue-300">
                    {timerAppliedMessage}
                  </p>
                )}

                <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      Timer WOD
                    </p>
                    {timerSegments.length > 0 && (
                      <span className="rounded-full border border-red-600/40 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                        {formatTimerDuration(totalTimerSeconds)}
                      </span>
                    )}
                  </div>

                  <select
                    value={timerConfig.mode}
                    onChange={(event) => updateTimerMode(event.target.value as WodMode)}
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-200"
                  >
                    {WOD_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-zinc-500">
                    Crea una sequenza di lavoro e recupero con scatti da 15 secondi.
                    Esempio: `6&apos; lavoro / 2&apos; recupero / 6&apos; lavoro`.
                  </p>

                  {timerConfig.mode !== 'Free' && (
                    <div className="space-y-3">
                      {timerSegments.length > 0 ? (
                        timerSegments.map((segment, index) => (
                          <div
                            key={segment.id}
                            className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                          >
                            <select
                              value={segment.phase}
                              onChange={(event) =>
                                updateTimerSegment(segment.id, {
                                  phase: event.target.value as WodTimerPhase,
                                  label:
                                    event.target.value === 'rest'
                                      ? 'Recupero'
                                      : 'Lavoro',
                                })
                              }
                              className="bg-black border border-zinc-800 p-3 rounded-lg text-xs outline-none focus:border-red-600 text-zinc-200"
                            >
                              {TIMER_PHASE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={segment.durationSeconds}
                              onChange={(event) =>
                                updateTimerSegment(segment.id, {
                                  durationSeconds: Number(event.target.value),
                                })
                              }
                              className="bg-black border border-zinc-800 p-3 rounded-lg text-xs outline-none focus:border-red-600 text-zinc-200"
                            >
                              {TIMER_DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => removeTimerSegment(segment.id)}
                              className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 text-[10px] font-black uppercase tracking-wide text-red-400 hover:bg-red-600/20"
                            >
                              Elimina
                            </button>

                            <div className="col-span-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                              Blocco {index + 1}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                          Nessun blocco configurato.
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addTimerSegment('work')}
                          className="flex-1 rounded-xl border border-green-600/40 bg-green-600/10 p-3 text-[10px] font-black uppercase tracking-wide text-green-400 hover:bg-green-600/20"
                        >
                          Aggiungi lavoro
                        </button>
                        <button
                          type="button"
                          onClick={() => addTimerSegment('rest')}
                          className="flex-1 rounded-xl border border-yellow-600/40 bg-yellow-600/10 p-3 text-[10px] font-black uppercase tracking-wide text-yellow-400 hover:bg-yellow-600/20"
                        >
                          Aggiungi recupero
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Score per leaderboard
                  </p>

                  <select
                    value={form.wod_score_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        wod_score_type: event.target.value as ScoreType | '',
                      }))
                    }
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
                    value={form.wod_score_label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        wod_score_label: event.target.value,
                      }))
                    }
                    placeholder="Es. Time cap 12', Max reps, Peso migliore..."
                    className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>
              </div>
            )}

            {logs[section] && (
              <div className="bg-zinc-800/60 border-l-4 border-green-500 p-4 mt-2 rounded-r-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-[10px] font-black text-green-500 uppercase italic">
                    Feedback atleta
                  </p>
                </div>

                {logs[section].notes && (
                  <p className="text-sm italic text-zinc-200 bg-black/30 p-3 rounded-lg border border-white/5">
                    &quot;{logs[section].notes}&quot;
                  </p>
                )}

                {(visibleVideos[section]?.length || 0) > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-green-400 uppercase italic">
                        Video caricati ({visibleVideos[section].length})
                      </p>

                      {visibleVideos[section].map((videoUrl, index) => (
                        <div
                          key={index}
                          className="rounded-xl overflow-hidden border border-zinc-700 bg-black shadow-2xl"
                        >
                          <div className="flex items-center justify-between bg-zinc-900 p-3">
                            <span className="text-[10px] font-bold text-zinc-300">
                              Video {index + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <a
                                href={videoUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-700 transition-all active:scale-95"
                              >
                                Scarica
                              </a>
                              <button
                                type="button"
                                onClick={() => deleteClientVideo(section, videoUrl)}
                                className="rounded border border-red-600 bg-red-600/10 px-2 py-1 text-[10px] font-bold text-red-400 transition-all hover:bg-red-600/20 active:scale-95"
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                          <video
                            src={videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full aspect-video object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-xl space-y-2">
              <label className="text-yellow-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-2 bg-yellow-500 rounded-full" />
                Note coach
              </label>
              {(() => {
                const coachNoteKey =
                  `coach_notes_${section}` as
                    | 'coach_notes_mobility'
                    | 'coach_notes_strength'
                    | 'coach_notes_wod'

                return (
                  <textarea
                    value={form[coachNoteKey]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [coachNoteKey]: event.target.value,
                      }))
                    }
                    placeholder={`Note per l'atleta su ${section}...`}
                    className="w-full bg-black border border-yellow-700/30 p-3 rounded-lg h-24 text-xs outline-none focus:border-yellow-500 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-600"
                  />
                )
              })()}
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <button
            onClick={saveWorkout}
            disabled={loading}
            className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-red-600/40 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : saved ? 'Programma inviato' : 'Salva programma'}
          </button>

          <button
            onClick={saveWorkoutAndReturn}
            disabled={loading}
            className="w-full max-w-xl mx-auto block bg-zinc-800 border border-zinc-700 p-4 rounded-2xl font-black uppercase italic tracking-widest active:scale-95 transition-all disabled:opacity-50 hover:border-red-600"
          >
            Salva e torna a Step 1
          </button>

          {saved && saveMessage && (
            <p className="text-center text-xs font-black text-green-400 animate-pulse">
              {saveMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
