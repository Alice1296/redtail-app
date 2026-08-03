import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { DAYS, type DayKey, type ScoreType } from '@/lib/community'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type SectionKey = 'mobility' | 'strength' | 'wod'

const VALID_SECTIONS: SectionKey[] = ['mobility', 'strength', 'wod']
const VALID_DAYS = DAYS.map((day) => day.key)

type SectionInput = {
  section: SectionKey
  content: string
  coachNote: string
}

type WorkoutRow = {
  week_number: number
  mobility: string | null
  strength: string | null
  wod: string | null
  coach_notes: string | null
}

function createAuthedClients(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader
      ? {
          headers: {
            Authorization: authHeader,
          },
        }
      : undefined,
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll() {},
    },
  })

  const adminClient = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

  return { authClient, adminClient: adminClient ?? authClient }
}

/**
 * Trova la prima settimana (>=1) in cui la sezione richiesta e' ancora vuota
 * per quel giorno, riusando righe gia' parzialmente compilate da altre sezioni.
 */
function findFirstFreeWeek(
  rowsByWeek: Map<number, WorkoutRow>,
  section: SectionKey
): number {
  const maxWeek = rowsByWeek.size > 0 ? Math.max(...rowsByWeek.keys()) : 0

  for (let week = 1; week <= maxWeek + 1; week += 1) {
    const row = rowsByWeek.get(week)

    if (!row) {
      return week
    }

    if (!row[section]) {
      return week
    }
  }

  return maxWeek + 1
}

export async function POST(req: NextRequest) {
  try {
    const { authClient, adminClient } = createAuthedClients(req)

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (trainerError) {
      throw trainerError
    }

    if (trainerProfile?.role !== 'trainer') {
      return NextResponse.json(
        { error: 'Solo il trainer puo creare una scheda' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const day = String(body?.day || '') as DayKey
    const scoreType = (body?.scoreType || '') as ScoreType | ''
    const scoreLabel =
      typeof body?.scoreLabel === 'string' ? body.scoreLabel.trim() : ''
    const clientIds: string[] = Array.isArray(body?.clientIds)
      ? body.clientIds.filter((value: unknown): value is string => typeof value === 'string')
      : []

    const rawSections: unknown[] = Array.isArray(body?.sections) ? body.sections : []
    const sections: SectionInput[] = rawSections
      .map((raw) => {
        const item = raw as Record<string, unknown>
        return {
          section: String(item?.section || '') as SectionKey,
          content: typeof item?.content === 'string' ? item.content.trim() : '',
          coachNote: typeof item?.coachNote === 'string' ? item.coachNote.trim() : '',
        }
      })
      .filter((item) => VALID_SECTIONS.includes(item.section) && item.content)

    if (!VALID_DAYS.includes(day)) {
      return NextResponse.json({ error: 'Giorno non valido' }, { status: 400 })
    }

    if (sections.length === 0) {
      return NextResponse.json(
        { error: 'Compila almeno una sezione (mobility, strength o wod)' },
        { status: 400 }
      )
    }

    if (clientIds.length === 0) {
      return NextResponse.json({ error: 'Seleziona almeno un cliente' }, { status: 400 })
    }

    const { data: clientProfiles, error: clientProfilesError } = await adminClient
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', clientIds)

    if (clientProfilesError) {
      throw clientProfilesError
    }

    const nameById = new Map(
      (clientProfiles || []).map((profile) => [
        profile.id,
        profile.first_name && profile.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : profile.email || 'Atleta',
      ])
    )

    const results: Array<{
      clientId: string
      clientName: string
      assignments: Array<{ section: SectionKey; week: number }>
      error?: string
    }> = []

    for (const clientId of clientIds) {
      const clientName = nameById.get(clientId) || 'Atleta'

      try {
        const { data: existingRows, error: fetchError } = await adminClient
          .from('workouts')
          .select('week_number, mobility, strength, wod, coach_notes')
          .eq('client_id', clientId)
          .eq('day', day)
          .order('week_number', { ascending: true })

        if (fetchError) {
          throw fetchError
        }

        // Mappa in-memory dello stato del giorno: la aggiorniamo mano a mano che
        // assegniamo le sezioni, cosi la sezione successiva "vede" quelle gia'
        // piazzate e puo' riusare la stessa settimana quando e' libera.
        const rowsByWeek = new Map<number, WorkoutRow>(
          ((existingRows || []) as WorkoutRow[]).map((row) => [
            row.week_number,
            { ...row },
          ])
        )

        const touchedWeeks = new Set<number>()
        const assignments: Array<{ section: SectionKey; week: number }> = []

        for (const sectionInput of sections) {
          const targetWeek = findFirstFreeWeek(rowsByWeek, sectionInput.section)

          let row = rowsByWeek.get(targetWeek)
          if (!row) {
            row = {
              week_number: targetWeek,
              mobility: null,
              strength: null,
              wod: null,
              coach_notes: '{}',
            }
            rowsByWeek.set(targetWeek, row)
          }

          row[sectionInput.section] = sectionInput.content

          let parsedNotes: Record<string, unknown> = {}
          try {
            parsedNotes =
              typeof row.coach_notes === 'string'
                ? JSON.parse(row.coach_notes || '{}')
                : {}
          } catch {
            parsedNotes = {}
          }

          parsedNotes[sectionInput.section] = sectionInput.coachNote

          if (sectionInput.section === 'wod') {
            parsedNotes.wod_score_type = scoreType || parsedNotes.wod_score_type || null
            parsedNotes.wod_score_label =
              scoreLabel || parsedNotes.wod_score_label || null
          }

          row.coach_notes = JSON.stringify(parsedNotes)

          touchedWeeks.add(targetWeek)
          assignments.push({ section: sectionInput.section, week: targetWeek })
        }

        for (const week of touchedWeeks) {
          const row = rowsByWeek.get(week)!

          const { error: upsertError } = await adminClient.from('workouts').upsert(
            {
              client_id: clientId,
              week_number: week,
              day,
              mobility: row.mobility,
              strength: row.strength,
              wod: row.wod,
              coach_notes: row.coach_notes,
            },
            { onConflict: 'client_id,week_number,day' }
          )

          if (upsertError) {
            throw upsertError
          }
        }

        results.push({ clientId, clientName, assignments })
      } catch (err: unknown) {
        results.push({
          clientId,
          clientName,
          assignments: [],
          error: err instanceof Error ? err.message : 'Errore assegnazione scheda',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Errore creazione scheda',
      },
      { status: 500 }
    )
  }
}
