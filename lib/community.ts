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

const DEFAULT_MAX_LIFTS_SORTED_BY_LENGTH = [...DEFAULT_MAX_LIFTS].sort(
  (a, b) => b.length - a.length
)

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findExerciseNameInText(value: string) {
  const normalizedValue = value.trim().toLowerCase()
  if (!normalizedValue) {
    return null
  }

  for (const lift of DEFAULT_MAX_LIFTS_SORTED_BY_LENGTH) {
    const pattern = new RegExp(`\\b${escapeRegExp(lift.toLowerCase())}\\b`, 'i')
    if (pattern.test(normalizedValue)) {
      return lift
    }
  }

  return null
}

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
  const trimmed = value.trim()
  const normalizedValue = trimmed.toLowerCase()

  if (!normalizedValue) {
    return trimmed
  }

  const exactMatch = DEFAULT_MAX_LIFTS.find(
    (lift) => lift.toLowerCase() === normalizedValue
  )

  if (exactMatch) {
    return exactMatch
  }

  const foundLift = findExerciseNameInText(trimmed)
  return foundLift || trimmed
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

// ============================================================================
// WORKOUT PARSER - Intelligent Text-to-Timer Recognition
// ============================================================================

export type ParsedWorkoutBlock = {
  type: 'amrap' | 'emom' | 'rest' | 'exercise' | 'unknown'
  duration?: number // in seconds
  sets?: number
  interval?: number // for EMOM (minutes)
  label: string
  rawText: string
}

export type WorkoutParseResult = {
  blocks: ParsedWorkoutBlock[]
  isValid: boolean
  detectedMode: WodMode
  totalDurationSeconds: number | null
  confidence: number // 0-1 score indicating parsing confidence
  warnings: string[]
}

/**
 * Extracts time duration from text patterns like "6'", "2' Rest", "Every 2'"
 * Returns duration in seconds, or null if not found
 */
function extractDuration(text: string): number | null {
  // Match patterns: 6', 6 ', 2min, 2 min, 120s, 120 sec, etc.
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*['′']/,      // 6' or 6′
    /(\d+(?:[.,]\d+)?)\s*min/i,       // 6 min
    /(\d+(?:[.,]\d+)?)\s*(?:sec|s)/i, // 6 sec or 6s
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'))
      // If matched with ' or min, it's in minutes; if sec/s, it's in seconds
      if (pattern === patterns[0] || pattern === patterns[1]) {
        return Math.round(value * 60)
      }
      return Math.round(value)
    }
  }

  return null
}

/**
 * Extracts sets/rounds from text patterns like "x 6 Sets", "6 Rounds"
 */
function extractSets(text: string): number | null {
  const pattern = /x\s*(\d+)\s*(?:sets?|rounds?)/i
  const match = text.match(pattern)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Parses a single line to detect workout blocks
 */
function parseWorkoutLine(line: string): ParsedWorkoutBlock | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length === 0) return null

  // AMRAP pattern: "AMRAP 6'" or "AMRAP 6 min"
  const amrapMatch = trimmed.match(/^amrap\s+(\d+(?:[.,]\d+)?)\s*['′']?/i)
  if (amrapMatch) {
    const minutes = parseFloat(amrapMatch[1].replace(',', '.'))
    return {
      type: 'amrap',
      duration: Math.round(minutes * 60),
      label: `AMRAP ${amrapMatch[1]}'`,
      rawText: trimmed,
    }
  }

  // REST pattern: "Rest 2'" or "2' Rest" or "REST X'"
  const restMatch = trimmed.match(/^(?:rest|pause)?\s*(\d+(?:[.,]\d+)?)\s*['′']?\s*(?:rest|pause)?/i)
  if (restMatch && (trimmed.toLowerCase().includes('rest') || trimmed.toLowerCase().includes('pause'))) {
    const minutes = parseFloat(restMatch[1].replace(',', '.'))
    return {
      type: 'rest',
      duration: Math.round(minutes * 60),
      label: `Rest ${restMatch[1]}'`,
      rawText: trimmed,
    }
  }

  // EMOM/E2MOM pattern: "Every 2' x 6 Sets" or "EMOM x 10"
  const emomMatch = trimmed.match(/^(?:emom|every)\s+(\d+(?:[.,]\d+)?)\s*['′']?\s*(?:x|for)?\s*(\d+)?/i)
  if (emomMatch) {
    const interval = parseFloat(emomMatch[1].replace(',', '.'))
    const sets = emomMatch[2] ? parseInt(emomMatch[2], 10) : undefined
    const totalDuration = sets ? Math.round(sets * interval * 60) : undefined
    return {
      type: 'emom',
      interval: interval,
      sets: sets,
      duration: totalDuration,
      label: sets ? `EMOM ${interval}' x ${sets}` : `EMOM ${interval}'`,
      rawText: trimmed,
    }
  }

  // Generic time duration (could be work blocks)
  const durationOnly = extractDuration(trimmed)
  if (durationOnly && trimmed.match(/^\d+(?:[.,]\d+)?(?:\s*['′]|\s*min)/i)) {
    return {
      type: 'exercise',
      duration: durationOnly,
      label: trimmed,
      rawText: trimmed,
    }
  }

  // If we see exercise names or typical WOD content, classify as exercise
  return {
    type: 'unknown',
    label: trimmed,
    rawText: trimmed,
  }
}

/**
 * Main workout text parser
 * Converts freeform workout text into structured blocks
 */
function parseWorkoutTextLegacy(workoutText: string): WorkoutParseResult {
  if (!workoutText || workoutText.trim().length === 0) {
    return {
      blocks: [],
      isValid: false,
      detectedMode: 'Free',
      totalDurationSeconds: null,
      confidence: 0,
      warnings: ['Testo vuoto'],
    }
  }

  const lines = workoutText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const blocks: ParsedWorkoutBlock[] = []
  const warnings: string[] = []
  let amrapCount = 0
  let emomCount = 0
  let restCount = 0
  let totalSeconds = 0

  for (const line of lines) {
    const parsed = parseWorkoutLine(line)
    if (parsed && parsed.type !== 'unknown') {
      blocks.push(parsed)

      if (parsed.type === 'amrap') amrapCount++
      if (parsed.type === 'emom') emomCount++
      if (parsed.type === 'rest') restCount++

      if (parsed.duration) {
        totalSeconds += parsed.duration
      }
    }
  }

  // Detect workout mode based on detected blocks
  let detectedMode: WodMode = 'Free'
  let confidence = 0

  if (emomCount > 0 && amrapCount === 0) {
    detectedMode = 'EMOM'
    confidence = emomCount / lines.length
  } else if (amrapCount > 0) {
    detectedMode = 'AMRAP'
    confidence = amrapCount / lines.length
  } else if (blocks.length > 0) {
    detectedMode = 'For Time'
    confidence = 0.5
  }

  if (blocks.length === 0) {
    warnings.push('Nessun pattern riconosciuto. Verrà usato timer libero.')
    confidence = 0
  }

  return {
    blocks,
    isValid: blocks.length > 0,
    detectedMode,
    totalDurationSeconds: totalSeconds > 0 ? totalSeconds : null,
    confidence,
    warnings: warnings.length > 0 ? warnings : [],
  }
}

/**
 * Converts parsed workout blocks into a WodConfig
 */
function workoutTextToWodConfigLegacy(workoutText: string): WodConfig {
  const parseResult = parseWorkoutTextLegacy(workoutText)

  if (!parseResult.isValid) {
    // Return a Free mode config if parsing failed
    return {
      mode: 'Free',
      description: workoutText,
      segments: [],
    }
  }

  // Build segments from parsed blocks
  const segments: WodTimerSegment[] = []
  let segmentIndex = 1

  for (const block of parseResult.blocks) {
    if (block.type === 'amrap' && block.duration) {
      segments.push({
        id: `amrap-${segmentIndex}`,
        phase: 'work',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    } else if (block.type === 'rest' && block.duration) {
      segments.push({
        id: `rest-${segmentIndex}`,
        phase: 'rest',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    } else if (block.type === 'emom' && block.sets && block.interval) {
      // For EMOM, create one segment per minute
      for (let i = 1; i <= block.sets; i++) {
        segments.push({
          id: `emom-${i}`,
          phase: 'work',
          durationSeconds: Math.round(block.interval * 60),
          label: `${block.label} - Min ${i}`,
        })
      }
      segmentIndex++
    } else if (block.type === 'exercise' && block.duration) {
      segments.push({
        id: `work-${segmentIndex}`,
        phase: 'work',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    }
  }

  return {
    mode: parseResult.detectedMode,
    description: workoutText,
    segments: segments.length > 0 ? segments : [],
  }
}

const WORKOUT_NUMBER_PATTERN = String.raw`(\d+(?:[.,]\d+)?)`
const WORKOUT_MINUTE_UNIT_PATTERN = String.raw`(?:[?'\u2018\u2019\u2032]|min(?:ute)?s?|mins?)`
const WORKOUT_SECOND_UNIT_PATTERN = String.raw`(?:secondi?|seconds?|secs?|sec|s)`
const WORKOUT_TIME_UNIT_PATTERN = String.raw`(?:${WORKOUT_MINUTE_UNIT_PATTERN}|${WORKOUT_SECOND_UNIT_PATTERN})`

function parseWorkoutDecimal(value: string) {
  return Number.parseFloat(value.replace(',', '.'))
}

function workoutSecondsFromNumber(value: string, unit = 'min') {
  const parsed = parseWorkoutDecimal(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  const isSeconds = /^(?:s|sec|secs|second|seconds|secondi?)$/i.test(unit)
  return Math.round(isSeconds ? parsed : parsed * 60)
}

function extractWorkoutDuration(text: string): number | null {
  const match = text.match(
    new RegExp(`${WORKOUT_NUMBER_PATTERN}\\s*(${WORKOUT_TIME_UNIT_PATTERN})`, 'i')
  )

  return match ? workoutSecondsFromNumber(match[1], match[2]) : null
}

function extractWorkoutSets(text: string): number | null {
  const match =
    text.match(/\b(?:x|for)\s*(\d+)\s*(?:sets?|rounds?)?\b/i) ||
    text.match(/\b(\d+)\s*(?:sets?|rounds?)\b/i)

  return match ? Number.parseInt(match[1], 10) : null
}

function parseWorkoutLineV2(line: string): ParsedWorkoutBlock | null {
  const trimmed = line.trim()

  if (!trimmed) {
    return null
  }

  const minuteDurationPattern = `${WORKOUT_NUMBER_PATTERN}\\s*(${WORKOUT_MINUTE_UNIT_PATTERN})?`
  const amrapMatch = trimmed.match(
    new RegExp(`^amrap\\s+${minuteDurationPattern}`, 'i')
  )

  if (amrapMatch) {
    const duration = workoutSecondsFromNumber(amrapMatch[1], amrapMatch[2] || 'min')

    if (!duration) {
      return null
    }

    return {
      type: 'amrap',
      duration,
      label: `AMRAP ${formatTimerDuration(duration)}`,
      rawText: trimmed,
    }
  }

  if (/\b(?:rest|pause|recupero|riposo)\b/i.test(trimmed)) {
    const duration = extractWorkoutDuration(trimmed)

    if (duration) {
      return {
        type: 'rest',
        duration,
        label: `Rest ${formatTimerDuration(duration)}`,
        rawText: trimmed,
      }
    }
  }

  const shorthandEmomMatch = trimmed.match(
    /^e(\d+(?:[.,]\d+)?)mom\b(?:.*?\b(?:x|for)\s*(\d+))?/i
  )

  if (shorthandEmomMatch) {
    const intervalSeconds = workoutSecondsFromNumber(
      shorthandEmomMatch[1],
      'min'
    )
    const sets = shorthandEmomMatch[2]
      ? Number.parseInt(shorthandEmomMatch[2], 10)
      : extractWorkoutSets(trimmed) || undefined

    if (!intervalSeconds) {
      return null
    }

    return {
      type: 'emom',
      interval: intervalSeconds / 60,
      sets,
      duration: sets ? intervalSeconds * sets : undefined,
      label: sets
        ? `Every ${formatTimerDuration(intervalSeconds)} x ${sets}`
        : `Every ${formatTimerDuration(intervalSeconds)}`,
      rawText: trimmed,
    }
  }

  const everyMatch = trimmed.match(
    new RegExp(
      `^every\\s+${WORKOUT_NUMBER_PATTERN}\\s*(${WORKOUT_TIME_UNIT_PATTERN})?(?:.*?\\b(?:x|for)\\s*(\\d+))?`,
      'i'
    )
  )

  if (everyMatch) {
    const intervalSeconds = workoutSecondsFromNumber(
      everyMatch[1],
      everyMatch[2] || 'min'
    )
    const sets = everyMatch[3]
      ? Number.parseInt(everyMatch[3], 10)
      : extractWorkoutSets(trimmed) || undefined

    if (!intervalSeconds) {
      return null
    }

    return {
      type: 'emom',
      interval: intervalSeconds / 60,
      sets,
      duration: sets ? intervalSeconds * sets : undefined,
      label: sets
        ? `Every ${formatTimerDuration(intervalSeconds)} x ${sets}`
        : `Every ${formatTimerDuration(intervalSeconds)}`,
      rawText: trimmed,
    }
  }

  const emomMatch = trimmed.match(
    new RegExp(
      `^emom(?:\\s+${WORKOUT_NUMBER_PATTERN}\\s*(${WORKOUT_MINUTE_UNIT_PATTERN})|\\s*(?:x|for)\\s*(\\d+))?`,
      'i'
    )
  )

  if (emomMatch) {
    const intervalSeconds = emomMatch[1]
      ? workoutSecondsFromNumber(emomMatch[1], emomMatch[2] || 'min')
      : 60
    const sets = emomMatch[3]
      ? Number.parseInt(emomMatch[3], 10)
      : extractWorkoutSets(trimmed) || undefined

    if (!intervalSeconds) {
      return null
    }

    return {
      type: 'emom',
      interval: intervalSeconds / 60,
      sets,
      duration: sets ? intervalSeconds * sets : undefined,
      label: sets
        ? `EMOM ${formatTimerDuration(intervalSeconds)} x ${sets}`
        : `EMOM ${formatTimerDuration(intervalSeconds)}`,
      rawText: trimmed,
    }
  }

  const durationOnly = extractWorkoutDuration(trimmed)
  if (
    durationOnly &&
    trimmed.match(
      new RegExp(`^${WORKOUT_NUMBER_PATTERN}\\s*${WORKOUT_MINUTE_UNIT_PATTERN}`, 'i')
    )
  ) {
    return {
      type: 'exercise',
      duration: durationOnly,
      label: trimmed,
      rawText: trimmed,
    }
  }

  return {
    type: 'unknown',
    label: trimmed,
    rawText: trimmed,
  }
}

export function parseWorkoutText(workoutText: string): WorkoutParseResult {
  if (!workoutText || workoutText.trim().length === 0) {
    return {
      blocks: [],
      isValid: false,
      detectedMode: 'Free',
      totalDurationSeconds: null,
      confidence: 0,
      warnings: ['Testo vuoto'],
    }
  }

  const lines = workoutText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const blocks: ParsedWorkoutBlock[] = []
  const warnings: string[] = []
  let amrapCount = 0
  let emomCount = 0
  let restCount = 0
  let totalSeconds = 0
  let emomWithoutSets = false

  for (const line of lines) {
    const parsed = parseWorkoutLineV2(line)

    if (parsed && parsed.type !== 'unknown') {
      blocks.push(parsed)

      if (parsed.type === 'amrap') amrapCount++
      if (parsed.type === 'emom') emomCount++
      if (parsed.type === 'rest') restCount++
      if (parsed.type === 'emom' && !parsed.sets) emomWithoutSets = true

      if (parsed.duration) {
        totalSeconds += parsed.duration
      }
    }
  }

  let detectedMode: WodMode = 'Free'
  let confidence = 0

  if (emomCount > 0 && amrapCount === 0) {
    detectedMode = 'EMOM'
    confidence = emomWithoutSets ? 0.55 : 0.92
  } else if (amrapCount > 0) {
    detectedMode = 'AMRAP'
    confidence = Math.min(0.95, 0.72 + amrapCount * 0.08 + restCount * 0.05)
  } else if (blocks.length > 0) {
    detectedMode = 'For Time'
    confidence = 0.45
  }

  if (blocks.length === 0) {
    warnings.push('Nessun pattern riconosciuto. Verra usato timer libero.')
    confidence = 0
  }

  if (emomWithoutSets) {
    warnings.push('EMOM riconosciuto senza numero di set: verifica la durata.')
  }

  return {
    blocks,
    isValid: blocks.length > 0,
    detectedMode,
    totalDurationSeconds: totalSeconds > 0 ? totalSeconds : null,
    confidence,
    warnings,
  }
}

export function workoutTextToWodConfig(workoutText: string): WodConfig {
  const parseResult = parseWorkoutText(workoutText)

  if (!parseResult.isValid) {
    return {
      mode: 'Free',
      description: workoutText,
      segments: [],
    }
  }

  const segments: WodTimerSegment[] = []
  let segmentIndex = 1

  for (const block of parseResult.blocks) {
    if (block.type === 'amrap' && block.duration) {
      segments.push({
        id: `amrap-${segmentIndex}`,
        phase: 'work',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    } else if (block.type === 'rest' && block.duration) {
      segments.push({
        id: `rest-${segmentIndex}`,
        phase: 'rest',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    } else if (block.type === 'emom' && block.sets && block.interval) {
      for (let setNumber = 1; setNumber <= block.sets; setNumber++) {
        segments.push({
          id: `emom-${segmentIndex}-${setNumber}`,
          phase: 'work',
          durationSeconds: Math.round(block.interval * 60),
          label: `${block.label} - Set ${setNumber}`,
        })
      }
      segmentIndex++
    } else if (block.type === 'emom' && block.interval) {
      segments.push({
        id: `emom-${segmentIndex}`,
        phase: 'work',
        durationSeconds: Math.round(block.interval * 60),
        label: block.label,
      })
      segmentIndex++
    } else if (block.type === 'exercise' && block.duration) {
      segments.push({
        id: `work-${segmentIndex}`,
        phase: 'work',
        durationSeconds: block.duration,
        label: block.label,
      })
      segmentIndex++
    }
  }

  return {
    mode: parseResult.detectedMode,
    description: workoutText,
    segments,
  }
}
