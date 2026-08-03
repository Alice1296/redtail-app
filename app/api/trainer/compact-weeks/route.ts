import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const TABLES_WITH_WEEK_NUMBER = ['workouts', 'client_logs', 'workout_scores', 'notifications'] as const

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
        { error: 'Solo il trainer puo comprimere le settimane' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const clientId = String(body?.clientId || '')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 })
    }

    const { data: workoutRows, error: workoutsError } = await adminClient
      .from('workouts')
      .select('week_number')
      .eq('client_id', clientId)

    if (workoutsError) {
      throw workoutsError
    }

    const distinctWeeks = Array.from(
      new Set((workoutRows || []).map((row) => row.week_number as number))
    ).sort((a, b) => a - b)

    const mapping = distinctWeeks
      .map((oldWeek, index) => ({ oldWeek, newWeek: index + 1 }))
      .filter((entry) => entry.oldWeek !== entry.newWeek)

    const warnings: string[] = []

    for (const { oldWeek, newWeek } of mapping) {
      for (const table of TABLES_WITH_WEEK_NUMBER) {
        const { error } = await adminClient
          .from(table)
          .update({ week_number: newWeek })
          .eq('client_id', clientId)
          .eq('week_number', oldWeek)

        if (error) {
          warnings.push(`${table}: settimana ${oldWeek} -> ${newWeek}: ${error.message}`)
        }
      }
    }

    return NextResponse.json({
      movesApplied: mapping.length,
      mapping,
      warnings,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Errore compressione settimane',
      },
      { status: 500 }
    )
  }
}
