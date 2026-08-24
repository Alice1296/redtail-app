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
  day: string
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

function hasContent(row: WorkoutRow): boolean {
  return Boolean(
    (row.mobility && row.mobility.trim()) ||
      (row.strength && row.strength.trim()) ||
      (row.wod && row.wod.trim())
  )
}

/**
 * Determina la settimana in cui inserire la scheda.
 *
 * Il calcolo e' GLOBALE su tutti i giorni dell'atleta, non sul singolo giorno:
 * si prende la "frontiera", cioe' la settimana piu' alta che ha davvero dei
 * contenuti (qualsiasi giorno). Se in quella settimana il giorno richiesto e'
 * ancora libero ci si scrive dentro (cosi i vari giorni caricati uno dopo
 * l'altro compongono la stessa, unica, settimana nuova); se invece quel giorno
 * e' gia' occupato si apre la settimana successiva.
 *
 * Questo evita il bug per cui un giorno (es. giovedi/venerdi) con dei "buchi"
 * nelle settimane recenti finiva a riempire quei buchi in una settimana
 * precedente, spalmando la settimana nuova su piu' settimane.
 */
function findTargetWeek(rows: WorkoutRow[], day: string): number {
  let frontierWeek = 0

  for (const row of rows) {
    if (hasContent(row) && row.week_number > frontierWeek) {
      frontierWeek = row.week_number
    }
  }

  if (frontierWeek === 0) {
    return 1
  }

  const dayAlreadyFilledOnFrontier = rows.some(
    (row) => row.week_number === frontierWeek && row.day === day && hasContent(row)
  )

  return dayAlreadyFilledOnFrontier ? frontierWeek + 1 : frontierWeek
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
          .select('week_number, day, mobility, strength, wod, coach_notes')
          .eq('client_id', clientId)
          .order('week_number', { ascending: true })

        if (fetchError) {
          throw fetchError
        }

        // Tutte le sezioni compilate vanno nella stessa settimana: quella
        // calcolata sulla frontiera globale dell'atleta (vedi findTargetWeek).
        const targetWeek = findTargetWeek((existingRows || []) as WorkoutRow[], day)

        const rowContent: Pick<WorkoutRow, 'mobility' | 'strength' | 'wod'> = {
          mobility: null,
          strength: null,
          wod: null,
        }
        const parsedNotes: Record<string, unknown> = {}
        const assignments: Array<{ section: SectionKey; week: number }> = []

        for (const sectionInput of sections) {
          rowContent[sectionInput.section] = sectionInput.content
          parsedNotes[sectionInput.section] = sectionInput.coachNote

          if (sectionInput.section === 'wod') {
            parsedNotes.wod_score_type = scoreType || null
            parsedNotes.wod_score_label = scoreLabel || null
          }

          assignments.push({ section: sectionInput.section, week: targetWeek })
        }

        const { error: upsertError } = await adminClient.from('workouts').upsert(
          {
            client_id: clientId,
            week_number: targetWeek,
            day,
            mobility: rowContent.mobility,
            strength: rowContent.strength,
            wod: rowContent.wod,
            coach_notes: JSON.stringify(parsedNotes),
          },
          { onConflict: 'client_id,week_number,day' }
        )

        if (upsertError) {
          throw upsertError
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
