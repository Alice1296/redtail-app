import { DAYS, findExerciseNameInText, normalizeExerciseName } from './community'

// ============================================================================
// DIARIO CARICHI
// Log strutturato dei carichi usati dagli atleti. Per non richiedere una nuova
// tabella, ogni voce vive in `client_logs` con section namespaced ("diario:<slug>")
// e il payload strutturato serializzato in `notes` (JSON). L'accesso e' isolato
// qui, cosi in futuro si puo' spostare su una tabella dedicata senza toccare la UI.
// ============================================================================

export const DIARIO_SECTION_PREFIX = 'diario:'

export type ExerciseSource = 'strength' | 'wod' | 'custom'

export type TrainingLogEntry = {
  exercise: string
  prescribed?: string | null
  suggestedLoad?: number | null // kg calcolato dal massimale (%)
  load?: number | null // kg effettivo
  reps?: number | null
  rpe?: number | null
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
  reps?: number | null
  rpe?: number | null
  source?: ExerciseSource
}

export function encodeEntry(entry: TrainingLogEntry): string {
  const payload: Payload = {
    v: 1,
    exercise: entry.exercise.trim(),
    prescribed: entry.prescribed || null,
    load: entry.load ?? null,
    reps: entry.reps ?? null,
    rpe: entry.rpe ?? null,
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

// ---- parsing carico/schema -------------------------------------------------
const KG_PATTERN = /@\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*kg/i
const PERCENT_PATTERN = /(\d{1,3}(?:[.,]\d+)?)\s*%/
const SCHEME_PATTERN = /(\d+\s*(?:r\b)?\s*[x×]\s*\d+\s*(?:s\b|sets?|serie)?|\d+\s*[x×]\s*\d+|\d+\s*(?:sets?|serie|rounds?|reps?)\b)/i

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

function buildPrescribed(block: string): string | null {
  const parts: string[] = []
  const scheme = block.match(SCHEME_PATTERN)
  if (scheme) parts.push(scheme[1].replace(/\s+/g, ' ').trim())
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
  if (/^(then|amrap|emom|every|for time|rest|riposo|max|note|nota)\b/i.test(t)) return false
  return true
}

/** Esercizi dalla parte Strength: un esercizio per "blocco" (separato da "- - -"). */
function extractStrengthExercises(text: string, maxes: MaxMap): TrainingLogEntry[] {
  const lines = text.split('\n')
  const blocks: string[][] = [[]]
  for (const line of lines) {
    if (SECTION_BREAK.test(line)) {
      blocks.push([])
    } else {
      blocks[blocks.length - 1].push(line)
    }
  }

  const out: TrainingLogEntry[] = []
  for (const block of blocks) {
    const blockText = block.join('\n')
    const titleLine = block.find((l) => looksLikeExerciseTitle(l))
    if (!titleLine) continue
    const name = cleanExerciseName(titleLine)
    if (!name) continue
    out.push({
      exercise: name,
      prescribed: buildPrescribed(blockText),
      suggestedLoad: suggestedFromPercent(name, blockText, maxes),
      source: 'strength',
    })
  }
  return out
}

/** Movimenti caricati nel WOD: righe con "@ ... kg" (es. "3 Thruster @ 40/60 Kg"). */
function extractWodExercises(text: string, maxes: MaxMap): TrainingLogEntry[] {
  const out: TrainingLogEntry[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const kg = line.match(KG_PATTERN)
    if (!kg) continue
    // nome = testo prima della "@", senza il conteggio reps iniziale
    const before = line.slice(0, line.indexOf('@')).replace(/^[\d\s./x×+-]+/i, '')
    const name = cleanExerciseName(before)
    if (!name || name.length < 2) continue
    out.push({
      exercise: name,
      prescribed: `@ ${kg[1].replace('.', ',')} kg`,
      suggestedLoad: null,
      load: toNumber(kg[1]),
      source: 'wod',
    })
  }
  return out
}

/** Lista di esercizi loggabili dedotti dall'allenamento del giorno. */
export function extractDayExercises(
  strengthText: string | null | undefined,
  wodText: string | null | undefined,
  maxes: MaxMap
): TrainingLogEntry[] {
  const merged: TrainingLogEntry[] = [
    ...(strengthText ? extractStrengthExercises(strengthText, maxes) : []),
    ...(wodText ? extractWodExercises(wodText, maxes) : []),
  ]

  // dedup per nome (case-insensitive), tenendo la prima occorrenza
  const seen = new Set<string>()
  const result: TrainingLogEntry[] = []
  for (const entry of merged) {
    const key = entry.exercise.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(entry)
  }
  return result
}

// ---- storico / progressione ------------------------------------------------
export type HistoryPoint = {
  week: number
  day: string
  load: number
  reps?: number | null
  rpe?: number | null
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
      reps: payload.reps ?? null,
      rpe: payload.rpe ?? null,
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
      prev != null && prev !== 0 ? Math.round((last - prev) / prev * 100) : null
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

  // esercizi con piu' rilevazioni prima, poi alfabetico
  histories.sort((a, b) => b.points.length - a.points.length || a.exercise.localeCompare(b.exercise))
  return histories
}

export function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)).replace('.', ',')
}
