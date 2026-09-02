import { DAYS, findExerciseNameInText, normalizeExerciseName } from './community'

// ============================================================================
// DIARIO CARICHI (Strength / Gym)
// Log strutturato dei carichi usati dagli atleti nella parte di forza. Il WOD
// NON entra qui: quello si registra come risultato unico (vedi score WOD).
// Per non richiedere una nuova tabella, ogni voce vive in `client_logs` con
// section namespaced ("diario:<slug>") e il payload in `notes` (JSON). L'accesso
// e' isolato qui, cosi in futuro si sposta su una tabella dedicata senza
// toccare la UI.
// ============================================================================

export const DIARIO_SECTION_PREFIX = 'diario:'

export type ExerciseSource = 'strength' | 'wod' | 'custom'

export type TrainingLogEntry = {
  exercise: string
  prescribed?: string | null
  suggestedLoad?: number | null // kg calcolato dal massimale (%)
  load?: number | null // kg effettivo
  sets?: number | null
  reps?: number | null
  rpe?: number | null
  notes?: string | null // es. TUT "2\" in buca 3\" in salita"
  source?: ExerciseSource
}

export type MaxMap = Record<string, { value: number; unit?: string }>

// ---- section key -----------------------------------------------------------
export function exerciseSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
  return slug || 'esercizio'
}

export function sectionForExercise(name: string): string {
  return DIARIO_SECTION_PREFIX + exerciseSlug(name)
}

export function isDiarioSection(section: string | null | undefined): boolean {
  return typeof section === 'string' && section.startsWith(DIARIO_SECTION_PREFIX)
}

// ---- payload (JSON in notes) ----------------------------------------------
type Payload = {
  v: 1
  exercise: string
  prescribed?: string | null
  load?: number | null
  sets?: number | null
  reps?: number | null
  rpe?: number | null
  notes?: string | null
  source?: ExerciseSource
}

export function encodeEntry(entry: TrainingLogEntry): string {
  const payload: Payload = {
    v: 1,
    exercise: entry.exercise.trim(),
    prescribed: entry.prescribed || null,
    load: entry.load ?? null,
    sets: entry.sets ?? null,
    reps: entry.reps ?? null,
    rpe: entry.rpe ?? null,
    notes: entry.notes?.trim() || null,
    source: entry.source || 'strength',
  }
  return JSON.stringify(payload)
}

export function decodeEntry(notes: string | null | undefined): Payload | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes) as Payload
    if (parsed && parsed.v === 1 && typeof parsed.exercise === 'string') {
      return parsed
    }
  } catch {
    // non e' una voce diario (es. testo libero): ignora
  }
  return null
}

// ---- parsing carico / schema ----------------------------------------------
const KG_PATTERN = /@\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*kg/i
const PERCENT_PATTERN = /(\d{1,3}(?:[.,]\d+)?)\s*%/

function toNumber(value: string): number {
  return Number.parseFloat(value.replace(',', '.'))
}

function suggestedFromPercent(name: string, block: string, maxes: MaxMap): number | null {
  const percentMatch = block.match(PERCENT_PATTERN)
  if (!percentMatch) return null
  const known = findExerciseNameInText(name) || findExerciseNameInText(block)
  if (!known) return null
  const max = maxes[normalizeExerciseName(known)]
  if (!max || !Number.isFinite(max.value)) return null
  const pct = toNumber(percentMatch[1])
  if (!Number.isFinite(pct) || pct <= 0) return null
  return Math.round(max.value * (pct / 100) * 10) / 10
}

/**
 * Serie e reps dallo schema. Gestisce:
 *  - "5r x 3s" -> 5 reps x 3 serie (marcatori espliciti r/s)
 *  - "3 x 5" / "3×5" -> 3 serie x 5 reps (convenzione serie×reps)
 *  - "4 x 10-12" -> 4 serie, 10 reps (primo del range)
 *  - "6 Sets" / "12 reps" da soli
 * Evita di scambiare "Every 2' x 6" (intervallo a tempo) per uno schema.
 */
function parseSetsReps(block: string): { sets: number | null; reps: number | null } {
  const repsThenSets = block.match(/(\d+)\s*r\b[^\n]{0,8}?[x×][^\n]{0,8}?(\d+)\s*s\b/i)
  if (repsThenSets) {
    return { reps: Number(repsThenSets[1]), sets: Number(repsThenSets[2]) }
  }
  const setsThenReps = block.match(/(\d+)\s*s\b[^\n]{0,8}?[x×][^\n]{0,8}?(\d+)\s*r\b/i)
  if (setsThenReps) {
    return { sets: Number(setsThenReps[1]), reps: Number(setsThenReps[2]) }
  }
  // "N x M" (serie × reps), ma NON dopo un apostrofo minuti ("2' x 6")
  const plain = block.match(/(\d+)(?!\s*['′])\s*[x×]\s*(\d+)(?:\s*[-–]\s*\d+)?/)
  if (plain) {
    return { sets: Number(plain[1]), reps: Number(plain[2]) }
  }
  const setsOnly = block.match(/(\d+)\s*(?:sets?|serie)\b/i)
  const repsOnly =
    block.match(/(\d+)\s*(?:reps?|rip(?:etizioni)?)\b/i) || block.match(/(\d+)r\b/i)
  return {
    sets: setsOnly ? Number(setsOnly[1]) : null,
    reps: repsOnly ? Number(repsOnly[1]) : null,
  }
}

function buildPrescribed(block: string, sets: number | null, reps: number | null): string | null {
  const parts: string[] = []
  if (sets != null && reps != null) parts.push(`${sets}×${reps}`)
  else if (sets != null) parts.push(`${sets} serie`)
  else if (reps != null) parts.push(`${reps} reps`)
  const pct = block.match(PERCENT_PATTERN)
  const kg = block.match(KG_PATTERN)
  if (kg) parts.push(`@ ${kg[1].replace('.', ',')} kg`)
  else if (pct) parts.push(`@ ${pct[1].replace('.', ',')}%`)
  return parts.length ? parts.join(' · ') : null
}

function cleanExerciseName(line: string): string {
  return line
    .replace(/\([^)]*\)/g, '') // note tra parentesi
    .replace(/^[\s\-*•·]+/, '')
    .replace(/[*:]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const SECTION_BREAK = /^[ \t]*-(?:[ \t]*-)+[ \t]*$/

// Una riga sembra un "titolo esercizio": ha lettere, non inizia con un numero
// (che di solito e' uno schema/movimento), non e' troppo lunga.
function looksLikeExerciseTitle(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60) return false
  if (/^[\d(]/.test(t)) return false
  if (!/[a-zA-Zà-ù]/.test(t)) return false
  if (/^(then|amrap|emom|for time|rest|riposo|max|note|nota|varianti|oppure)\b/i.test(t)) {
    return false
  }
  return true
}

/** Esercizi dalla parte Strength: un esercizio per "blocco" (separato da "- - -"). */
export function extractDayExercises(
  strengthText: string | null | undefined,
  maxes: MaxMap
): TrainingLogEntry[] {
  if (!strengthText) return []

  const lines = strengthText.split('\n')
  const blocks: string[][] = [[]]
  for (const line of lines) {
    if (SECTION_BREAK.test(line)) {
      blocks.push([])
    } else {
      blocks[blocks.length - 1].push(line)
    }
  }

  const seen = new Set<string>()
  const out: TrainingLogEntry[] = []
  for (const block of blocks) {
    const blockText = block.join('\n')
    const titleLine = block.find((l) => looksLikeExerciseTitle(l))
    if (!titleLine) continue
    const name = cleanExerciseName(titleLine)
    if (!name || name.length < 2) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const { sets, reps } = parseSetsReps(blockText)
    out.push({
      exercise: name,
      prescribed: buildPrescribed(blockText, sets, reps),
      suggestedLoad: suggestedFromPercent(name, blockText, maxes),
      sets,
      reps,
      source: 'strength',
    })
  }
  return out
}

// ---- storico / progressione ------------------------------------------------
export type HistoryPoint = {
  week: number
  day: string
  load: number
  sets?: number | null
  reps?: number | null
  rpe?: number | null
  notes?: string | null
  createdAt?: string | null
}

export type ExerciseHistory = {
  exercise: string
  points: HistoryPoint[]
  last: number
  prev: number | null
  delta: number | null
  deltaPct: number | null
  best: number
}

type DiarioRow = {
  section: string
  notes: string | null
  week_number: number
  day: string
  created_at?: string | null
}

const DAY_ORDER = new Map(DAYS.map((d, index) => [d.key as string, index]))

export function buildHistories(rows: DiarioRow[]): ExerciseHistory[] {
  const byExercise = new Map<string, { display: string; points: HistoryPoint[] }>()

  for (const row of rows) {
    if (!isDiarioSection(row.section)) continue
    const payload = decodeEntry(row.notes)
    if (!payload) continue
    const load = payload.load
    if (load == null || !Number.isFinite(load) || load <= 0) continue

    const key = payload.exercise.trim().toLowerCase()
    if (!byExercise.has(key)) {
      byExercise.set(key, { display: payload.exercise.trim(), points: [] })
    }
    byExercise.get(key)!.points.push({
      week: row.week_number,
      day: row.day,
      load,
      sets: payload.sets ?? null,
      reps: payload.reps ?? null,
      rpe: payload.rpe ?? null,
      notes: payload.notes ?? null,
      createdAt: row.created_at ?? null,
    })
  }

  const histories: ExerciseHistory[] = []
  for (const { display, points } of byExercise.values()) {
    points.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week
      return (DAY_ORDER.get(a.day) ?? 0) - (DAY_ORDER.get(b.day) ?? 0)
    })
    const loads = points.map((p) => p.load)
    const last = loads[loads.length - 1]
    const prev = loads.length > 1 ? loads[loads.length - 2] : null
    const delta = prev != null ? Math.round((last - prev) * 10) / 10 : null
    const deltaPct =
      prev != null && prev !== 0 ? Math.round(((last - prev) / prev) * 100) : null
    histories.push({
      exercise: display,
      points,
      last,
      prev,
      delta,
      deltaPct,
      best: Math.max(...loads),
    })
  }

  histories.sort(
    (a, b) => b.points.length - a.points.length || a.exercise.localeCompare(b.exercise)
  )
  return histories
}

export function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)).replace('.', ',')
}
