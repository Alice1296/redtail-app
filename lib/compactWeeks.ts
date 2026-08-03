import type { SupabaseClient } from '@supabase/supabase-js'

// Tabelle che referenziano una settimana tramite (client_id, week_number).
const WEEK_TABLES = ['workouts', 'client_logs', 'workout_scores', 'notifications'] as const

type WorkoutContentRow = {
  week_number: number
  mobility: string | null
  strength: string | null
  wod: string | null
}

export type CompactClientResult = {
  clientId: string
  movesApplied: number
  ghostsRemoved: number
  mapping: Array<{ oldWeek: number; newWeek: number }>
  warnings: string[]
}

function rowHasContent(row: WorkoutContentRow): boolean {
  return Boolean(
    (row.mobility && row.mobility.trim()) ||
      (row.strength && row.strength.trim()) ||
      (row.wod && row.wod.trim())
  )
}

/**
 * Compatta le settimane di un singolo atleta eliminando i buchi:
 * - rimuove le settimane "fantasma" (righe workout senza alcun contenuto),
 * - rinumera le settimane con contenuti in modo contiguo a partire da 1,
 *   spostando in modo coerente workouts, client_logs, workout_scores e
 *   notifications.
 *
 * La rinumerazione avviene in ordine crescente di settimana d'origine: dopo
 * aver rimosso le settimane fantasma questo garantisce l'assenza di collisioni,
 * perche' ogni nuova posizione e' sempre minore delle settimane ancora da
 * elaborare.
 */
export async function compactClientWeeks(
  admin: SupabaseClient,
  clientId: string
): Promise<CompactClientResult> {
  const { data: rows, error } = await admin
    .from('workouts')
    .select('week_number, mobility, strength, wod')
    .eq('client_id', clientId)

  if (error) {
    throw error
  }

  const present = new Set<number>()
  const occupied = new Set<number>()

  ;((rows || []) as WorkoutContentRow[]).forEach((row) => {
    present.add(row.week_number)
    if (rowHasContent(row)) {
      occupied.add(row.week_number)
    }
  })

  const warnings: string[] = []

  // Elimina le settimane fantasma (righe presenti ma senza contenuti).
  const ghostWeeks = Array.from(present).filter((week) => !occupied.has(week))

  for (const week of ghostWeeks) {
    const { error: deleteError } = await admin
      .from('workouts')
      .delete()
      .eq('client_id', clientId)
      .eq('week_number', week)

    if (deleteError) {
      warnings.push(`workouts: rimozione settimana vuota ${week}: ${deleteError.message}`)
    }
  }

  const occupiedSorted = Array.from(occupied).sort((a, b) => a - b)
  const mapping = occupiedSorted
    .map((oldWeek, index) => ({ oldWeek, newWeek: index + 1 }))
    .filter((entry) => entry.oldWeek !== entry.newWeek)

  for (const { oldWeek, newWeek } of mapping) {
    for (const table of WEEK_TABLES) {
      const { error: updateError } = await admin
        .from(table)
        .update({ week_number: newWeek })
        .eq('client_id', clientId)
        .eq('week_number', oldWeek)

      if (updateError) {
        warnings.push(`${table}: settimana ${oldWeek} -> ${newWeek}: ${updateError.message}`)
      }
    }
  }

  return {
    clientId,
    movesApplied: mapping.length,
    ghostsRemoved: ghostWeeks.length,
    mapping,
    warnings,
  }
}
