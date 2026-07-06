'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DAYS,
  DEFAULT_MAX_LIFTS,
  TIMER_DURATION_OPTIONS,
  TIMER_PHASE_OPTIONS,
  WOD_MODE_OPTIONS,
  createTimerSegment,
  formatTimerDuration,
  getScorePlaceholder,
  getTimerTimelineState,
  normalizeExerciseName,
  normalizeWodConfig,
  parseScoreValue,
  findExerciseNameInText,
  type DayKey,
  type ScoreType,
  type TimerTimelineState,
  type WodConfig,
  type WodMode,
  type WodTimerPhase,
  type WodTimerSegment,
} from '@/lib/community'

type WorkoutRow = {
  wod?: string | null
  wod_score_type?: ScoreType | null
  wod_score_label?: string | null
  wod_timer_config?: WodConfig | null
  coach_notes?: string | null
  [key: string]: unknown
}

type ScoreEntry = {
  id?: string
  score_type: ScoreType
  score_display: string
  note: string | null
}

type SessionUser = {
  id: string
}

type ClientLog = {
  notes: string | null
  video_urls?: string[] | null
}

type PrValue = {
  value: number
  unit: string
  updatedAt?: string | null
}

type BrowserWindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

function formatTime(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')
    const videoId =
      hostname === 'youtu.be'
        ? parsed.pathname.split('/').filter(Boolean)[0]
        : hostname.endsWith('youtube.com')
          ? parsed.searchParams.get('v') ||
            parsed.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1]
          : null

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  } catch {
    return null
  }
}

function formatPrDate(value?: string | null) {
  if (!value) {
    return 'data non disponibile'
  }

  try {
    return new Intl.DateTimeFormat('it-IT').format(new Date(value))
  } catch {
    return 'data non disponibile'
  }
}

function getInitialClientTimerConfig(value?: WodConfig | null): WodConfig {
  return normalizeWodConfig(value) || { mode: 'Free', segments: [] }
}

function calculateLoad(
  exerciseName: string,
  percentage: number,
  prValues: Record<string, PrValue>
) {
  const normalizedName = normalizeExerciseName(exerciseName)
  const pr = prValues[normalizedName]

  if (!pr) {
    return null
  }

  return {
    exerciseName: normalizedName,
    percentage,
    calculatedWeight: Math.round(pr.value * (percentage / 100) * 10) / 10,
    maxWeight: pr.value,
    unit: pr.unit || 'kg',
    updatedAt: pr.updatedAt || null,
  }
}

function SmartPrText({
  text,
  prValues,
}: {
  text: string
  prValues: Record<string, PrValue>
}) {
  const percentagePattern = /((?:\d+\s*(?:r|x)?\s*@\s*)?(\d{1,3}(?:[.,]\d+)?(?:\s*[-–]\s*\d{1,3}(?:[.,]\d+)?)*?)\s*%)/gi
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let currentExercise: string | null = null
  let match: RegExpExecArray | null

  const renderTextWithLineBreaks = (value: string, keyPrefix: string) =>
    value.split('\n').flatMap((segment, segmentIndex, array) =>
      segmentIndex === array.length - 1
        ? [<span key={`${keyPrefix}-${segmentIndex}`}>{segment}</span>]
        : [
            <span key={`${keyPrefix}-${segmentIndex}`}>{segment}</span>,
            <br key={`${keyPrefix}-br-${segmentIndex}`} />,
          ]
    )

  const parsePercentageSequence = (rawValue: string) =>
    rawValue
      .split(/[-–]/g)
      .map((part) => Number(part.replace(',', '.').trim()))
      .filter((value) => !Number.isNaN(value))

  percentagePattern.lastIndex = 0

  while ((match = percentagePattern.exec(text)) !== null) {
    const [rawMatch, , rawPercentageSequence] = match
    const start = match.index
    const end = start + rawMatch.length
    const percentages = parsePercentageSequence(rawPercentageSequence)

    if (start > lastIndex) {
      nodes.push(
        ...renderTextWithLineBreaks(text.slice(lastIndex, start), `text-${lastIndex}`)
      )
    }

    const surroundingText = text.slice(Math.max(0, start - 50), start)
    const exerciseName: string | null =
      findExerciseNameInText(surroundingText) ||
      findExerciseNameInText(rawMatch) ||
      currentExercise

    if (exerciseName) {
      currentExercise = exerciseName
    }

    const loads = exerciseName
      ? percentages
          .map((percentage) => calculateLoad(exerciseName, percentage, prValues))
          .filter(
            (load): load is Exclude<ReturnType<typeof calculateLoad>, null> =>
              Boolean(load)
          )
      : []

    const loadDisplay = loads.length
      ? loads.map((load) => `${load.calculatedWeight}${load.unit}`).join(', ')
      : null

    nodes.push(
      <span key={`pr-${start}`} className="inline-flex flex-wrap items-center gap-1">
        <span>{renderTextWithLineBreaks(rawMatch, `raw-${start}`)}</span>
        {loadDisplay ? (
          <span
            tabIndex={0}
            title={`Calcolato sul tuo massimale di ${loads[0]?.maxWeight}${loads[0]?.unit} impostato il ${formatPrDate(
              loads[0]?.updatedAt
            )}`}
            className="inline-flex rounded-md border border-green-600/40 bg-green-600/10 px-1.5 py-0.5 text-[11px] font-black text-green-300"
          >
            {'->'} {loadDisplay}
          </span>
        ) : exerciseName ? (
          <span
            tabIndex={0}
            title={`Imposta il massimale di ${normalizeExerciseName(exerciseName)} per calcolare il peso`}
            className="inline-flex rounded-md border border-yellow-600/40 bg-yellow-600/10 px-1.5 py-0.5 text-[11px] font-black text-yellow-300"
          >
            imposta massimale
          </span>
        ) : null}
      </span>
    )

    lastIndex = end
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...renderTextWithLineBreaks(text.slice(lastIndex), `text-${lastIndex}`)
    )
  }

  return <>{nodes}</>
}

function LinkifiedText({
  text,
  prValues,
}: {
  text: string
  prValues: Record<string, PrValue>
}) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) {
          return <SmartPrText key={index} text={part} prValues={prValues} />
        }

        const cleanUrl = part.replace(/[),.;!?]+$/, '')
        const trailing = part.slice(cleanUrl.length)
        const youtubeEmbedUrl = getYouTubeEmbedUrl(cleanUrl)

        return (
          <span key={index}>
            <a
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline decoration-blue-400/50 underline-offset-2"
            >
              {cleanUrl}
            </a>
            {youtubeEmbedUrl && (
              <span className="mt-3 block overflow-hidden rounded-xl border border-zinc-800 bg-black">
                <iframe
                  src={youtubeEmbedUrl}
                  title="Video YouTube"
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </span>
            )}
            {trailing}
          </span>
        )
      })}
    </>
  )
}

function TimerPanel({
  seconds,
  isTimerRunning,
  laps,
  wodConfig,
  timeline,
  onModeChange,
  onAddSegment,
  onUpdateSegment,
  onRemoveSegment,
  onToggle,
  onSplit,
  onReset,
}: {
  seconds: number
  isTimerRunning: boolean
  laps: number[]
  wodConfig: WodConfig | null
  timeline: TimerTimelineState
  onModeChange: (mode: WodMode) => void
  onAddSegment: (phase: WodTimerPhase) => void
  onUpdateSegment: (
    segmentId: string,
    updates: Partial<Pick<WodTimerSegment, 'phase' | 'durationSeconds' | 'label'>>
  ) => void
  onRemoveSegment: (segmentId: string) => void
  onToggle: () => void
  onSplit: () => void
  onReset: () => void
}) {
  const hasCountdown = timeline.type === 'countdown'
  const timerConfig = getInitialClientTimerConfig(wodConfig)
  const timerSegments = timerConfig.segments || []
  const totalTimerSeconds = timerSegments.reduce(
    (total, segment) => total + segment.durationSeconds,
    0
  )
  const currentPhase = timeline.currentSegment?.phase || null
  const currentLabel =
    timeline.currentSegment?.label ||
    (currentPhase === 'rest' ? 'Recupero' : currentPhase === 'work' ? 'Lavoro' : '')
  const mainDisplay = hasCountdown
    ? formatTime(timeline.remainingSegmentSeconds || 0)
    : formatTime(seconds)

  return (
    <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-6 shadow-2xl">
      <div className="text-center space-y-2">
        {wodConfig?.mode && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-red-600/40 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
              {wodConfig.mode}
            </span>
            {currentPhase && (
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] transition-all ${
                  currentPhase === 'work'
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {currentLabel}
              </span>
            )}
          </div>
        )}

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
          {hasCountdown ? 'Countdown Timer' : 'Training Timer'}
        </p>
        <div className="text-6xl font-black italic tracking-tighter text-white tabular-nums">
          {mainDisplay}
        </div>
        {hasCountdown && (
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">
              Totale rimanente {formatTime(timeline.remainingSeconds || 0)}
            </p>
            {timeline.totalSeconds !== null && (
              <p className="text-[10px] text-zinc-600">
                Durata totale {formatTimerDuration(timeline.totalSeconds)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Imposta timer
          </p>
          {timerSegments.length > 0 && (
            <span className="rounded-full border border-red-600/40 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
              {formatTimerDuration(totalTimerSeconds)}
            </span>
          )}
        </div>

        <select
          value={timerConfig.mode}
          onChange={(event) => onModeChange(event.target.value as WodMode)}
          className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-200 outline-none focus:border-red-600"
        >
          {WOD_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

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
                      onUpdateSegment(segment.id, {
                        phase: event.target.value as WodTimerPhase,
                        label:
                          event.target.value === 'rest' ? 'Recupero' : 'Lavoro',
                      })
                    }
                    className="rounded-lg border border-zinc-800 bg-black p-3 text-xs text-zinc-200 outline-none focus:border-red-600"
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
                      onUpdateSegment(segment.id, {
                        durationSeconds: Number(event.target.value),
                      })
                    }
                    className="rounded-lg border border-zinc-800 bg-black p-3 text-xs text-zinc-200 outline-none focus:border-red-600"
                  >
                    {TIMER_DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onRemoveSegment(segment.id)}
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
                onClick={() => onAddSegment('work')}
                className="flex-1 rounded-xl border border-green-600/40 bg-green-600/10 p-3 text-[10px] font-black uppercase tracking-wide text-green-400 hover:bg-green-600/20"
              >
                Aggiungi lavoro
              </button>
              <button
                type="button"
                onClick={() => onAddSegment('rest')}
                className="flex-1 rounded-xl border border-yellow-600/40 bg-yellow-600/10 p-3 text-[10px] font-black uppercase tracking-wide text-yellow-400 hover:bg-yellow-600/20"
              >
                Aggiungi recupero
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onToggle}
          className={`flex-1 rounded-2xl p-4 font-black uppercase italic transition-all ${
            isTimerRunning
              ? 'border border-zinc-600 bg-zinc-700 text-white'
              : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
          }`}
        >
          {isTimerRunning ? 'Pausa' : 'Avvia'}
        </button>

        <button
          onClick={onSplit}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-6 font-black uppercase text-[10px]"
        >
          Split
        </button>

        <button
          onClick={onReset}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {laps.length > 0 && (
        <div className="space-y-2 border-t border-zinc-700 pt-4">
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Intervalli segnati:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {laps.map((lap, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/40 p-2"
              >
                <span className="text-[10px] font-bold text-zinc-600">#{idx + 1}</span>
                <span className="font-mono text-sm font-bold text-red-400">
                  {formatTime(lap)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-400">Caricamento...</div></div>}>
      <ClientPage />
    </Suspense>
  )
}

function ClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize from URL params
  const initialWeek = parseInt(searchParams.get('week') || '1', 10)
  const initialDay = (searchParams.get('day') || 'monday') as DayKey
  
  // Redirect to week/day selector if params missing
  useEffect(() => {
    if (!searchParams.has('week') || !searchParams.has('day')) {
      router.push('/client/select-week')
    }
  }, [searchParams, router])
  
  const [user, setUser] = useState<SessionUser | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [week, setWeek] = useState(initialWeek)
  const [activeDay, setActiveDay] = useState<DayKey>(initialDay)
  const [workout, setWorkout] = useState<WorkoutRow | null>(null)
  const [logs, setLogs] = useState<Record<string, ClientLog>>({})
  const [prValues, setPrValues] = useState<Record<string, PrValue>>({})
  const [scoreDisplay, setScoreDisplay] = useState('')
  const [scoreNote, setScoreNote] = useState('')
  const [scoreSavedMessage, setScoreSavedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [uploadingSection, setUploadingSection] = useState<string | null>(null)

  // Visual Flash State
  const [isFlashing, setIsFlashing] = useState(false)
  const triggerFlash = () => {
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 500)
  }
  
  const playBeep = (frequency = 440, duration = 0.1) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as BrowserWindowWithWebkitAudio).webkitAudioContext

      if (!AudioContextClass) return

      const audioCtx = new AudioContextClass()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + duration)
    } catch {}
  }
  
  const speakAnnouncement = (text: string) => {
    try {
      // Cancella eventuali annunci precedenti
      window.speechSynthesis?.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'it-IT'
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1
      
      window.speechSynthesis?.speak(utterance)
    } catch {}
  }
  
  // Timer States
  const [seconds, setSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])
  const [clientWodConfig, setClientWodConfig] = useState<WodConfig>({
    mode: 'Free',
    segments: [],
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartedAtRef = useRef<number | null>(null)
  const timerBaseSecondsRef = useRef(0)
  const lastBeepSecondRef = useRef(0)
  const lastAnnouncedSegmentIdRef = useRef<string | null>(null)
  const lastAnnouncedHalfwayRef = useRef<string | null>(null)
  const lastAnnounced30SecRef = useRef<string | null>(null)
  const lastCountdownSecRef = useRef(-1)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        loadData(user.id)
        loadUnreadNotifications(user.id)
      } else {
        router.push('/')
      }
    }

    init()
  }, [week, activeDay])

  async function loadUnreadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('client_id', userId)
      .eq('read', false)

    if (!error && data) {
      setUnreadCount(data.length)
    }
  }

  async function loadData(userId: string) {
    setLoading(true)
    setLogs({})
    setScoreSavedMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const maxesResponse = await fetch('/api/maxes', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      })
      if (maxesResponse.ok) {
        const maxesPayload = await maxesResponse.json()
        setPrValues((maxesPayload.values || {}) as Record<string, PrValue>)
      }
    } catch (error) {
      console.error('Errore caricamento massimali:', error)
    }

    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)
      .maybeSingle()

    if (workoutData) {
      let coachNotes: Record<string, unknown> = {}
      let legacyTimerConfig: WodConfig | null = null

      if (
        typeof workoutData.wod === 'string' &&
        workoutData.wod.trim().startsWith('{')
      ) {
        try {
          legacyTimerConfig = JSON.parse(workoutData.wod) as WodConfig
        } catch {}
      }

      try {
        coachNotes =
          typeof workoutData.coach_notes === 'string'
            ? JSON.parse(workoutData.coach_notes || '{}')
            : workoutData.coach_notes || {}
      } catch {}

      setWorkout({
        ...workoutData,
        wod_score_type: coachNotes.wod_score_type || null,
        wod_score_label: coachNotes.wod_score_label || null,
        wod_timer_config: normalizeWodConfig(
          (coachNotes.wod_timer_config as WodConfig | null) || legacyTimerConfig
        ),
        wod:
          legacyTimerConfig?.description ||
          (typeof workoutData.wod === 'string' &&
          !workoutData.wod.trim().startsWith('{')
            ? workoutData.wod
            : ''),
      })
    } else {
      setWorkout(null)
    }

    const { data: logData } = await supabase
      .from('client_logs')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)

    const logMap: Record<string, ClientLog> = {}
    logData?.forEach((log) => {
      logMap[log.section] = log
    })
    setLogs(logMap)

    const { data: scoreData } = await supabase
      .from('workout_scores')
      .select('score_type, score_display, note')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)
      .maybeSingle()

    const typedScore = scoreData as ScoreEntry | null
    setScoreDisplay(typedScore?.score_display || '')
    setScoreNote(typedScore?.note || '')
    setLoading(false)
  }

  useEffect(() => {
    const storageKey = user
      ? `client-timer:${user.id}:${week}:${activeDay}`
      : null
    let savedConfig: WodConfig | null = null

    if (storageKey) {
      try {
        savedConfig = JSON.parse(localStorage.getItem(storageKey) || 'null')
      } catch {}
    }

    setClientWodConfig(
      getInitialClientTimerConfig(savedConfig || workout?.wod_timer_config || null)
    )
    setIsTimerRunning(false)
    setSeconds(0)
    setLaps([])
    timerStartedAtRef.current = null
    timerBaseSecondsRef.current = 0
    lastBeepSecondRef.current = 0
    lastAnnouncedSegmentIdRef.current = null
    lastAnnouncedHalfwayRef.current = null
    lastAnnounced30SecRef.current = null
    lastCountdownSecRef.current = -1
  }, [activeDay, user, week, workout?.wod_timer_config])

  useEffect(() => {
    if (!user) {
      return
    }

    localStorage.setItem(
      `client-timer:${user.id}:${week}:${activeDay}`,
      JSON.stringify(clientWodConfig)
    )
  }, [activeDay, clientWodConfig, user, week])

  const wodConfig = useMemo(() => {
    return normalizeWodConfig(clientWodConfig)
  }, [clientWodConfig])

  function updateTimerMode(mode: WodMode) {
    setClientWodConfig((current) => {
      const timerConfig = getInitialClientTimerConfig(current)

      let newSegments: WodTimerSegment[]
      if (mode === 'Free') {
        newSegments = []
      } else if (timerConfig.segments && timerConfig.segments.length > 0) {
        newSegments = timerConfig.segments
      } else if (mode === 'EMOM') {
        // Per EMOM, creare 5 minuti (5 segmenti di 60 secondi)
        newSegments = Array.from({ length: 5 }, (_, i) => 
          createTimerSegment('work', 60)
        )
      } else {
        newSegments = [createTimerSegment('work', 6 * 60)]
      }

      return {
        ...timerConfig,
        mode,
        segments: newSegments,
      }
    })
  }

  function addTimerSegment(phase: WodTimerPhase) {
    setClientWodConfig((current) => {
      const timerConfig = getInitialClientTimerConfig(current)

      return {
        ...timerConfig,
        mode: timerConfig.mode === 'Free' ? 'AMRAP' : timerConfig.mode,
        segments: [...(timerConfig.segments || []), createTimerSegment(phase, 60)],
      }
    })
  }

  function updateTimerSegment(
    segmentId: string,
    updates: Partial<Pick<WodTimerSegment, 'phase' | 'durationSeconds' | 'label'>>
  ) {
    setClientWodConfig((current) => {
      const timerConfig = getInitialClientTimerConfig(current)

      return {
        ...timerConfig,
        segments: (timerConfig.segments || []).map((segment) =>
          segment.id === segmentId ? { ...segment, ...updates } : segment
        ),
      }
    })
  }

  function removeTimerSegment(segmentId: string) {
    setClientWodConfig((current) => {
      const timerConfig = getInitialClientTimerConfig(current)

      return {
        ...timerConfig,
        segments: (timerConfig.segments || []).filter(
          (segment) => segment.id !== segmentId
        ),
      }
    })
  }

  async function requestScreenWakeLock() {
    try {
      if (!('wakeLock' in navigator)) {
        return
      }

      wakeLockRef.current = await (navigator as NavigatorWithWakeLock).wakeLock?.request(
        'screen'
      ) || null
      wakeLockRef.current?.addEventListener('release', () => {
        wakeLockRef.current = null
      })
    } catch {}
  }

  async function releaseScreenWakeLock() {
    try {
      await wakeLockRef.current?.release()
    } catch {
    } finally {
      wakeLockRef.current = null
    }
  }

  function syncTimerFromClock() {
    if (timerStartedAtRef.current === null) {
      return seconds
    }

    const next = timerBaseSecondsRef.current + Math.floor(
      (Date.now() - timerStartedAtRef.current) / 1000
    )
    setSeconds(next)
    return next
  }

  function startTimer() {
    timerBaseSecondsRef.current = seconds
    timerStartedAtRef.current = Date.now()
    lastBeepSecondRef.current = seconds
    setIsTimerRunning(true)
    void requestScreenWakeLock()
  }

  function pauseTimer() {
    const next = syncTimerFromClock()
    timerBaseSecondsRef.current = next
    timerStartedAtRef.current = null
    setIsTimerRunning(false)
    void releaseScreenWakeLock()
  }

  function toggleTimer() {
    if (isTimerRunning) {
      pauseTimer()
      return
    }

    startTimer()
  }

  function resetTimer() {
    if (confirm('Resettare il timer?')) {
      setIsTimerRunning(false)
      setSeconds(0)
      setLaps([])
      timerStartedAtRef.current = null
      timerBaseSecondsRef.current = 0
      lastBeepSecondRef.current = 0
      lastAnnouncedSegmentIdRef.current = null
      lastAnnouncedHalfwayRef.current = null
      lastAnnounced30SecRef.current = null
      lastCountdownSecRef.current = -1
      void releaseScreenWakeLock()
    }
  }

  const timerTimeline = useMemo(
    () => getTimerTimelineState(wodConfig, seconds),
    [wodConfig, seconds]
  )

  const checkAndPlayBeep = (currentSecs: number, config: WodConfig | null) => {
    const timeline = getTimerTimelineState(config, currentSecs)

    if (timeline.type === 'countdown') {
      const segmentId = timeline.currentSegment?.id || null
      const remaining = timeline.remainingSegmentSeconds || 0
      const totalDuration = timeline.currentSegment?.durationSeconds || 0
      const phase = timeline.currentSegment?.phase || null
      const segmentIndex = config?.segments?.findIndex(s => s.id === segmentId) ?? -1
      const roundNumber = segmentIndex + 1

      // Annuncia quando inizia un nuovo segmento
      if (segmentId && lastAnnouncedSegmentIdRef.current !== segmentId) {
        lastAnnouncedSegmentIdRef.current = segmentId
        if (phase === 'rest') {
          speakAnnouncement('Rest')
        } else if (phase === 'work') {
          speakAnnouncement(`Round ${roundNumber}`)
        }
      }

      // Annuncia a metà del segmento
      if (segmentId && totalDuration > 0) {
        const halfway = Math.ceil(totalDuration / 2)
        if (remaining === halfway && lastAnnouncedHalfwayRef.current !== segmentId) {
          lastAnnouncedHalfwayRef.current = segmentId
          speakAnnouncement('Halfway')
        }
      }

      // Annuncia a 30 secondi rimanenti
      if (remaining === 30 && lastAnnounced30SecRef.current !== segmentId) {
        lastAnnounced30SecRef.current = segmentId
        speakAnnouncement('30 secondi')
      }

      // Conto alla rovescia degli ultimi 10 secondi
      if (remaining <= 10 && remaining > 0) {
        if (lastCountdownSecRef.current !== remaining) {
          lastCountdownSecRef.current = remaining
          if (remaining <= 5) {
            speakAnnouncement(remaining.toString())
          }
        }
      }

      // Beep sonori
      if (remaining === 3 || remaining === 2) {
        playBeep(440, 0.1)
      }

      if (remaining === 1) {
        playBeep(880, 0.2)
        triggerFlash()
      }

      return
    }

    // Se la configurazione non ha segmenti espliciti ma è in modalità EMOM
    // (non dovrebbe accadere con il nuovo codice, ma per sicurezza)
    if (config?.mode === 'EMOM' && timeline.type === 'stopwatch') {
      const secInMin = currentSecs % 60
      // Beep a 3, 2 secondi prima della fine del minuto
      if (secInMin === 57 || secInMin === 58) playBeep(440, 0.1)
      // Beep più forte a 1 secondo prima della fine
      if (secInMin === 59) {
        playBeep(880, 0.2)
        triggerFlash()
      }
    }
  }

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        const next = syncTimerFromClock()
        const missedSeconds = next - lastBeepSecondRef.current

        if (missedSeconds > 0 && missedSeconds <= 3) {
          for (
            let beepSecond = lastBeepSecondRef.current + 1;
            beepSecond <= next;
            beepSecond += 1
          ) {
            checkAndPlayBeep(beepSecond, wodConfig)
          }
        }

        lastBeepSecondRef.current = next
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isTimerRunning, wodConfig])

  useEffect(() => {
    if (!isTimerRunning) {
      return
    }

    const handleVisibilityChange = () => {
      const next = syncTimerFromClock()
      lastBeepSecondRef.current = next

      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void requestScreenWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isTimerRunning])

  useEffect(() => {
    if (timerTimeline.type === 'countdown' && timerTimeline.isComplete && isTimerRunning) {
      setIsTimerRunning(false)
      timerStartedAtRef.current = null
      timerBaseSecondsRef.current = timerTimeline.totalSeconds || seconds
      triggerFlash()
      playBeep(1040, 0.3)
      void releaseScreenWakeLock()
    }
  }, [isTimerRunning, seconds, timerTimeline])

  async function saveFeedback(section: string, notes: string, videoUrls?: string[]) {
    if (!user) return

    const currentVideos = logs[section]?.video_urls || []
    const finalVideos = videoUrls !== undefined ? videoUrls : currentVideos

    await supabase.from('client_logs').upsert(
      {
        client_id: user.id,
        week_number: Number(week),
        day: activeDay,
        section,
        notes: notes || '',
        video_urls: finalVideos.length > 0 ? finalVideos : null,
      },
      { onConflict: 'client_id,week_number,day,section' }
    )

    loadData(user.id)
  }

  async function saveScore() {
    if (!user || !workout?.wod_score_type) {
      return
    }

    const parsedValue = parseScoreValue(workout.wod_score_type, scoreDisplay)

    if (parsedValue === null) {
      alert('Inserisci un punteggio valido per questo formato')
      return
    }

    try {
      setScoreLoading(true)

      const { error } = await supabase.from('workout_scores').upsert(
        {
          client_id: user.id,
          week_number: Number(week),
          day: activeDay,
          score_type: workout.wod_score_type,
          score_value: parsedValue,
          score_display: scoreDisplay.trim(),
          note: scoreNote.trim() || null,
        },
        { onConflict: 'client_id,week_number,day' }
      )

      if (error) {
        throw error
      }

      setScoreSavedMessage('Score aggiornato sulla leaderboard')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore salvataggio score')
    } finally {
      setScoreLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function handleDayChange(day: DayKey) {
    if (day === activeDay) {
      return
    }

    setActiveDay(day)
    router.replace(`/client?week=${week}&day=${day}`, { scroll: false })
  }

  async function handleVideoUpload(section: string, file: File) {
    if (!user) {
      return
    }

    try {
      setUploadingSection(section)
      const fileName = `${user.id}/${Date.now()}-${section}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
      if (upErr) throw upErr
      const {
        data: { publicUrl },
      } = supabase.storage.from('videos').getPublicUrl(fileName)
      const currentVideos = logs[section]?.video_urls || []
      await saveFeedback(section, logs[section]?.notes || '', [
        ...currentVideos,
        publicUrl,
      ])
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore upload video')
    } finally {
      setUploadingSection(null)
    }
  }

  async function deleteVideo(section: string, videoUrl: string) {
    if (!user || !confirm('Eliminare il video?')) return

    try {
      setUploadingSection(section)
      const storagePath = videoUrl.split('/storage/v1/object/public/videos/')[1]

      if (storagePath) {
        const apiRes = await fetch('/api/delete-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: storagePath }),
        })

        const apiData = await apiRes.json()

        if (!apiRes.ok) {
          alert(`Errore: ${apiData.error}`)
        }
      }

      const currentVideos = logs[section]?.video_urls || []
      const updatedVideos = currentVideos.filter((value: string) => value !== videoUrl)
      await saveFeedback(section, logs[section]?.notes || '', updatedVideos)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione video')
    } finally {
      setUploadingSection(null)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.push('/client/notifications')}
          className="relative flex items-center gap-1 text-zinc-400 hover:text-red-500 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="text-center flex-1 font-black italic uppercase text-lg">
          Redtail Client
        </div>
        <button
          onClick={handleLogout}
          className="ml-4 bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => router.push('/community')}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all"
        >
          Community
        </button>
        <button
          onClick={() => router.push('/client/maxes')}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all"
        >
          Massimali
        </button>
      </div>

      <div className="p-4 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => router.push('/client/select-week')}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all active:scale-95"
        >
          Torna a selezione settimana
        </button>
      </div>

      <div className="flex gap-1 p-2 bg-zinc-900 overflow-x-auto no-scrollbar border-b border-white/5">
        {DAYS.map((day) => (
          <button
            key={day.key}
            onClick={() => handleDayChange(day.key)}
            className={`flex-1 min-w-[55px] py-3 rounded-xl font-black text-[10px] border text-center transition-all ${
              activeDay === day.key
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-red-600 hover:text-red-400'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto">
        <TimerPanel
          seconds={seconds}
          isTimerRunning={isTimerRunning}
          laps={laps}
          wodConfig={wodConfig}
          timeline={timerTimeline}
          onModeChange={updateTimerMode}
          onAddSegment={addTimerSegment}
          onUpdateSegment={updateTimerSegment}
          onRemoveSegment={removeTimerSegment}
          onToggle={toggleTimer}
          onSplit={() => setLaps((current) => [...current, syncTimerFromClock()])}
          onReset={resetTimer}
        />

        {loading ? (
          <p className="text-center text-zinc-500 font-black italic animate-pulse py-10 uppercase">
            Syncing...
          </p>
        ) : workout ? (
          <>
            {['mobility', 'strength', 'wod'].map((section) => {
                const hasContent = !!workout[section]
                const isWod = section === 'wod'
                
                // Se non c'è contenuto e non è il WOD, non renderizzare la card
                if (!hasContent && !isWod) return null

                return (
                  <div
                    key={section}
                    className={`bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 transition-colors duration-500 ${
                      isWod && isFlashing ? 'bg-red-900/40 border-red-600' : ''
                    }`}
                  >
                    <label className="text-red-500 font-black uppercase text-[11px] flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-red-600 rounded-full" />
                      {section}
                    </label>

                    {hasContent && (
                      <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed">
                        <LinkifiedText
                          text={String(workout[section] ?? '')}
                          prValues={prValues}
                        />
                      </div>
                    )}

                      {false && section === 'wod' && wodConfig && (
                        <div className="mt-6 bg-zinc-800/50 border border-zinc-700 rounded-3xl p-6 space-y-6">
                          <div className="text-center space-y-2">
                            {wodConfig?.mode === 'TABATA' && (
                              <div className="flex justify-center mb-2">
                                <span className={`text-[10px] font-black uppercase px-4 py-1 rounded-full tracking-widest transition-all ${
                                  (seconds % ((wodConfig!.workSeconds || 20) + (wodConfig!.restSeconds || 10))) < (wodConfig!.workSeconds || 20)
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : 'bg-zinc-700 text-zinc-400'
                                }`}>
                                  {(seconds % ((wodConfig!.workSeconds || 20) + (wodConfig!.restSeconds || 10))) < (wodConfig!.workSeconds || 20)
                                    ? '🔥 WORK'
                                    : '💤 REST'}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Training Timer</p>
                            <div className="text-6xl font-black italic tracking-tighter text-white tabular-nums">
                              {formatTime(seconds)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsTimerRunning(!isTimerRunning)}
                              className={`flex-1 p-4 rounded-2xl font-black uppercase italic transition-all ${
                                isTimerRunning 
                                  ? 'bg-zinc-700 text-white border border-zinc-600' 
                                  : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                              }`}
                            >
                              {isTimerRunning ? 'Pausa' : 'Avvia'}
                            </button>
                            
                            <button
                              onClick={() => {
                                setLaps([...laps, seconds])
                              }}
                              className="bg-zinc-900 border border-zinc-700 px-6 rounded-2xl font-black uppercase text-[10px]"
                            >
                              Split
                            </button>

                            <button
                              onClick={() => {
                                if(confirm('Resettare il timer?')) {
                                  setIsTimerRunning(false)
                                  setSeconds(0)
                                  setLaps([])
                                }
                              }}
                              className="bg-zinc-900 border border-zinc-700 px-4 rounded-2xl text-zinc-500"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            </button>
                          </div>

                          {laps.length > 0 && (
                            <div className="space-y-2 border-t border-zinc-700 pt-4">
                              <p className="text-[10px] font-black uppercase text-zinc-500">Intervalli segnati:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {laps.map((lap, idx) => (
                                  <div key={idx} className="bg-black/40 p-2 rounded-xl border border-zinc-800 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-600">#{idx+1}</span>
                                    <span className="text-sm font-mono font-bold text-red-400">{formatTime(lap)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {section === 'wod' && workout.wod_score_type && (
                      <div className="bg-red-600/5 border border-red-600/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
                              Score del giorno
                            </p>
                            <p className="text-xs text-zinc-400">
                              {workout.wod_score_label || `Formato score: ${workout.wod_score_type}`}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push('/community')}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] font-black uppercase hover:border-red-600 hover:text-red-400 transition-all"
                          >
                            Leaderboard
                          </button>
                        </div>

                        <input
                          value={scoreDisplay}
                          onChange={(event) => setScoreDisplay(event.target.value)}
                          placeholder={getScorePlaceholder(workout.wod_score_type)}
                          className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-100 placeholder:text-zinc-600"
                        />

                        <textarea
                          value={scoreNote}
                          onChange={(event) => setScoreNote(event.target.value)}
                          placeholder="Note sul tuo score, sensazioni o strategia..."
                          className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-red-600 min-h-[80px]"
                        />

                        <button
                          onClick={saveScore}
                          disabled={scoreLoading}
                          className="w-full bg-red-600 p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                          {scoreLoading ? 'Salvataggio...' : 'Submit score'}
                        </button>

                        {scoreSavedMessage && (
                          <p className="text-center text-[11px] font-black uppercase text-green-400">
                            {scoreSavedMessage}
                          </p>
                        )}
                      </div>
                    )}

                    {workout.coach_notes &&
                      (() => {
                        try {
                          const coachNotes =
                            typeof workout.coach_notes === 'string'
                              ? JSON.parse(workout.coach_notes)
                              : workout.coach_notes
                          const sectionNote = coachNotes?.[section]

                          if (sectionNote) {
                            return (
                              <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
                                <p className="text-[10px] font-black text-yellow-500 uppercase mb-2">
                                  Nota del coach
                                </p>
                                <p className="text-sm text-yellow-100/80 italic">
                                  <LinkifiedText
                                    text={String(sectionNote)}
                                    prValues={prValues}
                                  />
                                </p>
                              </div>
                            )
                          }
                        } catch {}

                        return null
                      })()}

                    <textarea
                      value={logs[section]?.notes || ''}
                      onChange={(event) =>
                        setLogs({
                          ...logs,
                          [section]: {
                            ...logs[section],
                            notes: event.target.value,
                          },
                        })
                      }
                      onBlur={(event) => saveFeedback(section, event.target.value)}
                      placeholder="Feedback..."
                      className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 min-h-[80px]"
                    />

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="video/*"
                        id={`v-${section}`}
                        className="hidden"
                        onChange={(event) =>
                          event.target.files?.[0] &&
                          handleVideoUpload(section, event.target.files[0])
                        }
                      />
                      <label
                        htmlFor={`v-${section}`}
                        className={`flex-1 flex items-center justify-center p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase cursor-pointer ${
                          (logs[section]?.video_urls?.length || 0) > 0
                            ? 'bg-green-600/10 border-green-600 text-green-500'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {uploadingSection === section
                          ? 'Wait...'
                          : (logs[section]?.video_urls?.length || 0) > 0
                            ? `${logs[section]?.video_urls?.length || 0} video`
                            : 'Upload'}
                      </label>
                    </div>

                    {(logs[section]?.video_urls?.length || 0) > 0 && (
                      <div className="space-y-2 bg-black/30 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-black uppercase text-zinc-400">
                          Video caricati:
                        </p>
                        {logs[section]?.video_urls?.map((videoUrl: string, index: number) => (
                          <div key={index} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 underline truncate flex-1"
                              >
                                Video {index + 1}
                              </a>
                              <button
                                onClick={() => deleteVideo(section, videoUrl)}
                                className="bg-red-600/10 border border-red-600 text-red-500 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600/20"
                              >
                                Elimina
                              </button>
                            </div>
                            <video
                              src={videoUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full aspect-video rounded-lg bg-black object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
            })}
          </>
        ) : (
          <div className="text-center py-20 text-zinc-600 font-black uppercase italic border border-dashed border-zinc-800 rounded-3xl">
            Rest day
          </div>
        )}
      </div>
    </div>
  )
}
