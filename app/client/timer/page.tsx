'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkoutParser } from '@/app/components/WorkoutParser'
import {
  buildGuidedWodConfig,
  formatTimerDuration,
  getTimerTimelineState,
  isEnteringLastWorkSegment,
  normalizeWodConfig,
  workoutTextToWodConfig,
  type WodConfig,
  type WodMode,
} from '@/lib/community'

const PREP_SECONDS = 10
const FINAL_BEEP_SECONDS = 5
const TIMER_WOD_STORAGE_KEY = 'redtail-timer-wod'

type Status = 'idle' | 'prep' | 'running' | 'paused' | 'done'

type GuidedMode = 'AMRAP' | 'For Time' | 'EMOM' | 'TABATA'

const MODE_TABS: Array<{ value: GuidedMode; label: string }> = [
  { value: 'AMRAP', label: 'AMRAP' },
  { value: 'For Time', label: 'For Time' },
  { value: 'EMOM', label: 'EMOM' },
  { value: 'TABATA', label: 'Tabata' },
]

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

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function TimerPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-zinc-400">Caricamento...</div>
        </div>
      }
    >
      <TimerPage />
    </Suspense>
  )
}

function TimerPage() {
  const router = useRouter()

  const [mode, setMode] = useState<GuidedMode>('AMRAP')
  const [configSource, setConfigSource] = useState<'guided' | 'recognized'>('guided')
  const [recognizedConfig, setRecognizedConfig] = useState<WodConfig | null>(null)
  const [recognizedNote, setRecognizedNote] = useState<string | null>(null)
  const [wodText, setWodText] = useState('')

  // Setup guidato per modalita'
  const [amrapMinutes, setAmrapMinutes] = useState(20)
  const [forTimeMinutes, setForTimeMinutes] = useState(12)
  const [emomIntervalSeconds, setEmomIntervalSeconds] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)
  const [tabataWork, setTabataWork] = useState(20)
  const [tabataRest, setTabataRest] = useState(10)
  const [tabataRounds, setTabataRounds] = useState(8)

  const [status, setStatus] = useState<Status>('idle')
  const [prepRemaining, setPrepRemaining] = useState(PREP_SECONDS)
  const [elapsed, setElapsed] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(muted)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runStartRef = useRef<number | null>(null)
  const prevSecondRef = useRef(0)
  const prevPrepSecondRef = useRef(PREP_SECONDS)
  const lastSegmentIdRef = useRef<string | null>(null)
  const halfwayDoneRef = useRef(false)
  const lastMinuteDoneRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Config attiva (da setup guidato oppure dal riconoscimento del testo).
  const guidedConfig = useMemo(() => {
    if (mode === 'AMRAP') {
      return buildGuidedWodConfig('AMRAP', { totalMinutes: amrapMinutes })
    }
    if (mode === 'For Time') {
      return buildGuidedWodConfig('For Time', { totalMinutes: forTimeMinutes })
    }
    if (mode === 'EMOM') {
      return buildGuidedWodConfig('EMOM', {
        intervalSeconds: emomIntervalSeconds,
        rounds: emomRounds,
      })
    }
    return buildGuidedWodConfig('TABATA', {
      workSeconds: tabataWork,
      restSeconds: tabataRest,
      rounds: tabataRounds,
    })
  }, [
    mode,
    amrapMinutes,
    forTimeMinutes,
    emomIntervalSeconds,
    emomRounds,
    tabataWork,
    tabataRest,
    tabataRounds,
  ])

  const config =
    configSource === 'recognized' && recognizedConfig ? recognizedConfig : guidedConfig

  const activeMode: WodMode = config.mode || mode
  const segments = useMemo(() => normalizeWodConfig(config)?.segments || [], [config])
  const totalSeconds = useMemo(
    () => segments.reduce((total, segment) => total + segment.durationSeconds, 0),
    [segments]
  )
  const isCountUp = activeMode === 'For Time'

  // Prefill dal WOD (se si arriva dal pulsante di riconoscimento).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(TIMER_WOD_STORAGE_KEY)
      if (stored && stored.trim()) {
        setWodText(stored)
        const parsed = normalizeWodConfig(workoutTextToWodConfig(stored))
        if (parsed && parsed.segments && parsed.segments.length > 0) {
          setRecognizedConfig(parsed)
          setConfigSource('recognized')
          setRecognizedNote('Timer riconosciuto automaticamente dal WOD.')
        }
      }
      sessionStorage.removeItem(TIMER_WOD_STORAGE_KEY)
    } catch {}
  }, [])

  // ---- Audio -------------------------------------------------------------
  function ensureAudioContext() {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as BrowserWindowWithWebkitAudio).webkitAudioContext
      if (!AudioContextClass) return null
      audioCtxRef.current = new AudioContextClass()
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  function playBeep(frequency = 660, duration = 0.15) {
    if (mutedRef.current || volumeRef.current <= 0) return
    try {
      const audioCtx = ensureAudioContext()
      if (!audioCtx) return
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      const peak = 0.001 + 0.28 * volumeRef.current

      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(peak, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + duration)
    } catch {}
  }

  function speak(text: string) {
    if (mutedRef.current || volumeRef.current <= 0) return
    try {
      window.speechSynthesis?.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = Math.min(1, Math.max(0, volumeRef.current))
      window.speechSynthesis?.speak(utterance)
    } catch {}
  }

  // ---- Wake lock ---------------------------------------------------------
  async function requestWakeLock() {
    try {
      if (!('wakeLock' in navigator)) return
      wakeLockRef.current =
        (await (navigator as NavigatorWithWakeLock).wakeLock?.request('screen')) || null
      wakeLockRef.current?.addEventListener('release', () => {
        wakeLockRef.current = null
      })
    } catch {}
  }

  async function releaseWakeLock() {
    try {
      await wakeLockRef.current?.release()
    } catch {
    } finally {
      wakeLockRef.current = null
    }
  }

  function clearTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearTick()
      void releaseWakeLock()
    }
  }, [])

  // ---- Motore annunci (per secondo di lavoro) ----------------------------
  function handleSecond(second: number) {
    const timeline = getTimerTimelineState(config, second)

    if (timeline.isComplete) {
      finishTimer()
      return
    }

    const segment = timeline.currentSegment
    if (!segment) return

    // Cambio di blocco
    if (lastSegmentIdRef.current !== segment.id) {
      lastSegmentIdRef.current = segment.id
      playBeep(760, 0.18)

      if (segments.length > 1) {
        if (isEnteringLastWorkSegment(config, second)) {
          speak('Last round')
        } else if (segment.phase === 'rest') {
          speak('Rest')
        } else {
          speak('Work')
        }
      }
    }

    const remaining = timeline.remainingSegmentSeconds ?? 0
    const duration = segment.durationSeconds

    // Blocco singolo (AMRAP / For Time): half way + last minute
    if (segments.length === 1) {
      if (
        !halfwayDoneRef.current &&
        duration > 30 &&
        remaining === Math.ceil(duration / 2)
      ) {
        halfwayDoneRef.current = true
        speak('Half way')
      }

      if (!lastMinuteDoneRef.current && duration > 60 && remaining === 60) {
        lastMinuteDoneRef.current = true
        speak('Last minute')
      }
    }

    // Conto alla rovescia finale di ogni blocco
    if (remaining > 0 && remaining <= FINAL_BEEP_SECONDS) {
      playBeep(remaining <= 3 ? 990 : 700, remaining <= 3 ? 0.2 : 0.12)
    }
  }

  function finishTimer() {
    clearTick()
    runStartRef.current = null
    setStatus('done')
    setElapsed(totalSeconds)
    playBeep(1180, 0.5)
    speak('Time')
    void releaseWakeLock()
  }

  // ---- Controlli ---------------------------------------------------------
  function startRunning(fromElapsed: number) {
    setStatus('running')
    runStartRef.current = Date.now() - fromElapsed * 1000
    prevSecondRef.current = fromElapsed

    if (fromElapsed === 0) {
      lastSegmentIdRef.current = segments[0]?.id || null
      halfwayDoneRef.current = false
      lastMinuteDoneRef.current = false
    }

    clearTick()
    tickRef.current = setInterval(() => {
      if (runStartRef.current === null) return
      const current = Math.floor((Date.now() - runStartRef.current) / 1000)
      if (current <= prevSecondRef.current) return

      for (let second = prevSecondRef.current + 1; second <= current; second += 1) {
        handleSecond(second)
        if (runStartRef.current === null) break
      }

      prevSecondRef.current = current
      setElapsed(Math.min(current, totalSeconds))
    }, 200)
  }

  function handleStart() {
    if (segments.length === 0) return
    ensureAudioContext()
    void requestWakeLock()

    setElapsed(0)
    setStatus('prep')
    setPrepRemaining(PREP_SECONDS)
    prevPrepSecondRef.current = PREP_SECONDS
    speak('Get ready')

    const prepStart = Date.now()
    clearTick()
    tickRef.current = setInterval(() => {
      const passed = Math.floor((Date.now() - prepStart) / 1000)
      const remaining = Math.max(0, PREP_SECONDS - passed)
      setPrepRemaining(remaining)

      // I beep scattano una sola volta per secondo (l'intervallo gira a 200ms).
      if (remaining !== prevPrepSecondRef.current) {
        prevPrepSecondRef.current = remaining
        if (remaining <= 3 && remaining >= 1) {
          playBeep(700, 0.14)
        }
      }

      if (remaining <= 0) {
        clearTick()
        playBeep(1050, 0.25)
        startRunning(0)
      }
    }, 200)
  }

  function handlePause() {
    clearTick()
    runStartRef.current = null
    setStatus('paused')
    void releaseWakeLock()
  }

  function handleResume() {
    void requestWakeLock()
    startRunning(elapsed)
  }

  function handleReset() {
    clearTick()
    runStartRef.current = null
    prevSecondRef.current = 0
    lastSegmentIdRef.current = null
    halfwayDoneRef.current = false
    lastMinuteDoneRef.current = false
    setStatus('idle')
    setElapsed(0)
    setPrepRemaining(PREP_SECONDS)
    void releaseWakeLock()
  }

  function handleModeChange(nextMode: GuidedMode) {
    if (status !== 'idle' && status !== 'done') return
    setConfigSource('guided')
    setRecognizedConfig(null)
    setRecognizedNote(null)
    setMode(nextMode)
    handleReset()
  }

  function applyRecognizedConfig(nextConfig: WodConfig) {
    const normalized = normalizeWodConfig(nextConfig)
    if (!normalized || !normalized.segments || normalized.segments.length === 0) {
      return
    }
    setRecognizedConfig(normalized)
    setConfigSource('recognized')
    setRecognizedNote('Timer riconosciuto dal testo.')
    handleReset()
  }

  // ---- Display -----------------------------------------------------------
  const timeline = getTimerTimelineState(config, elapsed)
  const currentPhase = timeline.currentSegment?.phase || 'work'

  const mainDisplay = (() => {
    if (status === 'prep') return formatClock(prepRemaining)
    if (isCountUp) return formatClock(elapsed)
    if (segments.length === 1) return formatClock(timeline.remainingSeconds ?? totalSeconds)
    return formatClock(timeline.remainingSegmentSeconds ?? 0)
  })()

  const phaseLabel = (() => {
    if (status === 'prep') return 'Get ready'
    if (status === 'done') return 'Done'
    if (status === 'idle') return 'Pronto'
    return currentPhase === 'rest' ? 'Rest' : 'Work'
  })()

  const backgroundClass = (() => {
    if (status === 'prep') return 'bg-amber-600'
    if (status === 'done') return 'bg-green-600'
    if (status === 'running' || status === 'paused') {
      return currentPhase === 'rest' ? 'bg-sky-700' : 'bg-red-600'
    }
    return 'bg-zinc-900'
  })()

  const roundLabel =
    segments.length > 1 && (status === 'running' || status === 'paused')
      ? `Blocco ${timeline.currentSegmentIndex + 1} / ${segments.length}`
      : null

  const isConfigured = status === 'idle' || status === 'done'

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.back()}
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
            Indietro
          </span>
        </button>

        <div className="text-center flex-1 font-black italic uppercase text-lg">
          Timer WOD
        </div>

        <button
          onClick={() => setMuted((current) => !current)}
          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all active:scale-95 ${
            muted
              ? 'bg-red-600/10 border-red-600 text-red-500'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
          }`}
        >
          {muted ? 'Muto' : 'Audio'}
        </button>
      </div>

      <div className="p-4 space-y-6 max-w-xl mx-auto">
        {/* Display principale */}
        <div
          className={`rounded-3xl border border-white/10 p-8 text-center shadow-2xl transition-colors duration-300 ${backgroundClass}`}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/80">
            {phaseLabel}
          </p>
          <div className="mt-2 text-7xl font-black italic tracking-tighter tabular-nums text-white">
            {mainDisplay}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
              {activeMode}
            </span>
            {roundLabel && (
              <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                {roundLabel}
              </span>
            )}
            <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
              Totale {formatTimerDuration(totalSeconds)}
            </span>
          </div>
        </div>

        {/* Controlli principali */}
        <div className="flex gap-2">
          {status === 'idle' || status === 'done' ? (
            <button
              onClick={handleStart}
              disabled={segments.length === 0}
              className="flex-1 rounded-2xl bg-red-600 p-4 font-black uppercase italic tracking-widest text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              Avvia
            </button>
          ) : status === 'running' || status === 'prep' ? (
            <button
              onClick={handlePause}
              className="flex-1 rounded-2xl border border-zinc-600 bg-zinc-700 p-4 font-black uppercase italic tracking-widest text-white active:scale-95 transition-all"
            >
              Pausa
            </button>
          ) : (
            <button
              onClick={handleResume}
              className="flex-1 rounded-2xl bg-red-600 p-4 font-black uppercase italic tracking-widest text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all"
            >
              Riprendi
            </button>
          )}

          <button
            onClick={handleReset}
            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-6 font-black uppercase text-[10px] text-zinc-400 active:scale-95 transition-all"
          >
            Reset
          </button>
        </div>

        {/* Volume */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Volume
            </span>
            <span className="text-[10px] font-black text-zinc-400">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            className="w-full accent-red-600"
          />
        </div>

        {recognizedNote && (
          <div className="rounded-2xl border border-blue-600/40 bg-blue-600/10 p-3 text-center text-[11px] font-black uppercase tracking-wide text-blue-300">
            {recognizedNote}
          </div>
        )}

        {/* Setup (solo quando fermo) */}
        {isConfigured && (
          <div className="space-y-5">
            <WorkoutParser initialText={wodText} onApply={applyRecognizedConfig} />

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Modalita
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MODE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleModeChange(tab.value)}
                    className={`rounded-xl border px-2 py-3 text-[10px] font-black uppercase tracking-wide transition-all ${
                      configSource === 'guided' && mode === tab.value
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {configSource === 'guided' && mode === 'AMRAP' && (
                <NumberField
                  label="Durata totale (minuti)"
                  value={amrapMinutes}
                  min={1}
                  max={90}
                  onChange={setAmrapMinutes}
                />
              )}

              {configSource === 'guided' && mode === 'For Time' && (
                <NumberField
                  label="Time cap (minuti)"
                  value={forTimeMinutes}
                  min={1}
                  max={90}
                  onChange={setForTimeMinutes}
                />
              )}

              {configSource === 'guided' && mode === 'EMOM' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Intervallo (secondi)"
                    value={emomIntervalSeconds}
                    min={5}
                    max={600}
                    step={5}
                    onChange={setEmomIntervalSeconds}
                  />
                  <NumberField
                    label="Round"
                    value={emomRounds}
                    min={1}
                    max={60}
                    onChange={setEmomRounds}
                  />
                </div>
              )}

              {configSource === 'guided' && mode === 'TABATA' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <NumberField
                    label="Lavoro (s)"
                    value={tabataWork}
                    min={5}
                    max={300}
                    step={5}
                    onChange={setTabataWork}
                  />
                  <NumberField
                    label="Recupero (s)"
                    value={tabataRest}
                    min={0}
                    max={300}
                    step={5}
                    onChange={setTabataRest}
                  />
                  <NumberField
                    label="Round"
                    value={tabataRounds}
                    min={1}
                    max={30}
                    onChange={setTabataRounds}
                  />
                </div>
              )}

              {configSource === 'recognized' && (
                <button
                  type="button"
                  onClick={() => {
                    setConfigSource('guided')
                    setRecognizedConfig(null)
                    setRecognizedNote(null)
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-red-600 hover:text-red-400 transition-all"
                >
                  Torna al setup manuale
                </button>
              )}

              <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                {segments.length} blocchi · {formatTimerDuration(totalSeconds)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="w-10 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-lg font-black text-zinc-300 active:scale-95"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className="w-full rounded-lg border border-zinc-800 bg-black p-2 text-center text-sm font-black text-zinc-100 outline-none focus:border-red-600"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="w-10 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-lg font-black text-zinc-300 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  )
}
