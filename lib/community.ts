export const DAYS = [
  { key: 'monday', label: 'LUN' },
  { key: 'tuesday', label: 'MAR' },
  { key: 'wednesday', label: 'MER' },
  { key: 'thursday', label: 'GIO' },
  { key: 'friday', label: 'VEN' },
  { key: 'saturday', label: 'SAB' },
  { key: 'sunday', label: 'DOM' },
] as const

export type DayKey = (typeof DAYS)[number]['key']

export const SCORE_TYPE_OPTIONS = [
  { value: 'time', label: 'Time' },
  { value: 'reps', label: 'Reps' },
  { value: 'load', label: 'Load' },
] as const

export type ScoreType = (typeof SCORE_TYPE_OPTIONS)[number]['value']

export const DEFAULT_MAX_LIFTS = [
  'Deadlift',
  'Bench Press',
  'Back Squat',
  'Front Squat',
  'Power Snatch',
  'Squat Snatch',
  'Clean and Jerk',
  'Strict Press',
  'Jerk',
  'Power Clean',
  'Hang Clean',
  'Hang Snatch',
  'Push Press',
  'Thruster',
]

export type WodMode = 'AMRAP' | 'EMOM' | 'For Time' | 'TABATA' | 'Free'

export type WodTimerPhase = 'work' | 'rest'

export type WodTimerSegment = {
  id: string
  phase: WodTimerPhase
  durationSeconds: number
  label?: string
}

export type WodConfig = {
  mode: WodMode
  duration?: number
  workSeconds?: number
  restSeconds?: number
  description?: string
  segments?: WodTimerSegment[]
}

export type TimerTimelineState = {
  type: 'stopwatch' | 'countdown'
  totalSeconds: number | null
  elapsedSeconds: number
  remainingSeconds: number | null
  currentSegment: WodTimerSegment | null
  currentSegmentIndex: number
  elapsedSegmentSeconds: number
  remainingSegmentSeconds: number | null
  isComplete: boolean
}

export const WOD_MODE_OPTIONS: Array<{ value: WodMode; label: string }> = [
  { value: 'AMRAP', label: 'AMRAP' },
  { value: 'For Time', label: 'For Time' },
  { value: 'EMOM', label: 'EMOM' },
  { value: 'TABATA', label: 'Tabata' },
  { value: 'Free', label: 'Libero' },
]

export const TIMER_PHASE_OPTIONS: Array<{
  value: WodTimerPhase
  label: string
}> = [
  { value: 'work', label: 'Lavoro' },
  { value: 'rest', label: 'Recupero' },
]

export const TIMER_DURATION_OPTIONS = Array.from({ length: 720 }, (_, index) => {
  const value = (index + 1) * 5
  return {
    value,
    label: formatTimerDuration(value),
  }
})

export function normalizeExerciseName(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  return (
    DEFAULT_MAX_LIFTS.find(
      (lift) => lift.toLowerCase() === normalizedValue
    ) || value.trim()
  )
}

export function getScorePlaceholder(scoreType: ScoreType) {
  if (scoreType === 'time') {
    return 'Es. 12:34'
  }

  if (scoreType === 'load') {
    return 'Es. 85'
  }

  return 'Es. 210'
}

export function parseScoreValue(
  scoreType: ScoreType,
  rawValue: string
): number | null {
  const value = rawValue.trim()

  if (!value) {
    return null
  }

  if (scoreType === 'time') {
    const parts = value.split(':').map((part) => Number(part))

    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some((part) => Number.isNaN(part) || part < 0)
    ) {
      return null
    }

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }

    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const parsed = Number(value.replace(',', '.'))

  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}

export function formatTimerDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  if (mins === 0) {
    return `${secs}"`
  }

  if (secs === 0) {
    return `${mins}'`
  }

  return `${mins}' ${secs}"`
}

export function createTimerSegment(
  phase: WodTimerPhase = 'work',
  durationSeconds = 60
): WodTimerSegment {
  return {
    id: `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phase,
    durationSeconds,
    label: phase === 'work' ? 'Lavoro' : 'Recupero',
  }
}

export function normalizeWodConfig(
  config?: WodConfig | null
): WodConfig | null {
  if (!config) {
    return null
  }

  const normalizedMode = config.mode || 'Free'
  const rawSegments =
    Array.isArray(config.segments) && config.segments.length > 0
      ? config.segments
      : buildLegacySegments(config)

  const segments = rawSegments
    .filter((segment) => Number(segment.durationSeconds) > 0)
    .map((segment) => ({
      id: segment.id || createTimerSegment(segment.phase, segment.durationSeconds).id,
      phase: (segment.phase === 'rest' ? 'rest' : 'work') as WodTimerPhase,
      durationSeconds: Math.max(5, Math.round(segment.durationSeconds / 5) * 5),
      label:
        segment.label ||
        (segment.phase === 'rest' ? 'Recupero' : 'Lavoro'),
    }))

  return {
    mode: normalizedMode,
    description: config.description || '',
    duration: config.duration,
    workSeconds: config.workSeconds,
    restSeconds: config.restSeconds,
    segments,
  }
}

function buildLegacySegments(config: WodConfig): WodTimerSegment[] {
  if (config.mode === 'TABATA') {
    const workSeconds = config.workSeconds || 20
    const restSeconds = config.restSeconds || 10
    const rounds = Math.max(1, config.duration || 8)

    return Array.from({ length: rounds }).flatMap((_, index) => [
      {
        id: `tabata-work-${index + 1}`,
        phase: 'work' as const,
        durationSeconds: workSeconds,
        label: `Work ${index + 1}`,
      },
      {
        id: `tabata-rest-${index + 1}`,
        phase: 'rest' as const,
        durationSeconds: restSeconds,
        label: `Rest ${index + 1}`,
      },
    ])
  }

  if (config.mode === 'EMOM') {
    const minutes = Math.max(1, config.duration || 1)
    return Array.from({ length: minutes }, (_, index) => ({
      id: `emom-${index + 1}`,
      phase: 'work' as const,
      durationSeconds: 60,
      label: `Minuto ${index + 1}`,
    }))
  }

  if ((config.mode === 'AMRAP' || config.mode === 'For Time') && config.duration) {
    return [
      {
        id: `${config.mode.toLowerCase()}-1`,
        phase: 'work',
        durationSeconds: config.duration * 60,
        label: config.mode,
      },
    ]
  }

  return []
}

export function getWodTimerSegments(config?: WodConfig | null): WodTimerSegment[] {
  return normalizeWodConfig(config)?.segments || []
}

export function getTimerTimelineState(
  config: WodConfig | null,
  elapsedSeconds: number
): TimerTimelineState {
  const segments = getWodTimerSegments(config)

  if (segments.length === 0) {
    return {
      type: 'stopwatch',
      totalSeconds: null,
      elapsedSeconds,
      remainingSeconds: null,
      currentSegment: null,
      currentSegmentIndex: -1,
      elapsedSegmentSeconds: elapsedSeconds,
      remainingSegmentSeconds: null,
      isComplete: false,
    }
  }

  const totalSeconds = segments.reduce(
    (total, segment) => total + segment.durationSeconds,
    0
  )

  if (elapsedSeconds >= totalSeconds) {
    return {
      type: 'countdown',
      totalSeconds,
      elapsedSeconds: totalSeconds,
      remainingSeconds: 0,
      currentSegment: segments[segments.length - 1],
      currentSegmentIndex: segments.length - 1,
      elapsedSegmentSeconds: segments[segments.length - 1].durationSeconds,
      remainingSegmentSeconds: 0,
      isComplete: true,
    }
  }

  let cursor = 0

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const nextCursor = cursor + segment.durationSeconds

    if (elapsedSeconds < nextCursor) {
      return {
        type: 'countdown',
        totalSeconds,
        elapsedSeconds,
        remainingSeconds: totalSeconds - elapsedSeconds,
        currentSegment: segment,
        currentSegmentIndex: index,
        elapsedSegmentSeconds: elapsedSeconds - cursor,
        remainingSegmentSeconds: nextCursor - elapsedSeconds,
        isComplete: false,
      }
    }

    cursor = nextCursor
  }

  return {
    type: 'countdown',
    totalSeconds,
    elapsedSeconds: totalSeconds,
    remainingSeconds: 0,
    currentSegment: segments[segments.length - 1],
    currentSegmentIndex: segments.length - 1,
    elapsedSegmentSeconds: segments[segments.length - 1].durationSeconds,
    remainingSegmentSeconds: 0,
    isComplete: true,
  }
}

export function formatAthleteName(profile?: {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}) {
  if (profile?.first_name && profile?.last_name) {
    return `${profile.first_name} ${profile.last_name}`
  }

  return profile?.email?.split('@')[0] || 'Atleta anonimo'
}
