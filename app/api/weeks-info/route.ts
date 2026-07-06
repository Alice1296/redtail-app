import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type WeekInfo = {
  week: number
  hasWorkouts: boolean
  lastModified: string | null
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

export async function GET(req: NextRequest) {
  try {
    const { authClient, adminClient } = createAuthedClients(req)

    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const clientId = req.nextUrl.searchParams.get('clientId') || user.id

    if (clientId !== user.id) {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (profile?.role !== 'trainer') {
        return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
      }
    }

    // Query per ottenere tutte le settimane con dati e l'ultima modifica
    const { data: workoutData, error: workoutError } = await adminClient
      .from('workouts')
      .select('week_number, updated_at, created_at')
      .eq('client_id', clientId)
      .order('week_number', { ascending: true })

    if (workoutError) {
      console.error('Errore query workouts:', workoutError)
      return NextResponse.json(
        { error: 'Errore nel recupero settimane' },
        { status: 500 }
      )
    }

    // Raggruppa per settimana e trova l'ultima modifica
    const weekMap: Record<number, { hasWorkouts: boolean; lastModified: string | null }> = {}

    ;((workoutData || []) as Array<{
      week_number: number
      updated_at?: string | null
      created_at?: string | null
    }>).forEach((row) => {
      if (!weekMap[row.week_number]) {
        weekMap[row.week_number] = { hasWorkouts: true, lastModified: null }
      }

      // Usa updated_at se disponibile, altrimenti created_at
      const timestamp = row.updated_at || row.created_at
      if (timestamp) {
        if (
          !weekMap[row.week_number].lastModified ||
          new Date(timestamp) > new Date(weekMap[row.week_number].lastModified!)
        ) {
          weekMap[row.week_number].lastModified = timestamp
        }
      }
    })

    // Converti in array
    const weeks: WeekInfo[] = Object.entries(weekMap)
      .map(([week, info]) => ({
        week: Number(week),
        hasWorkouts: info.hasWorkouts,
        lastModified: info.lastModified,
      }))
      .sort((a, b) => a.week - b.week)

    // Trova l'ultima settimana modificata
    const lastModifiedWeek = weeks
      .filter((w) => w.lastModified)
      .sort((a, b) => {
        const dateA = new Date(a.lastModified || 0).getTime()
        const dateB = new Date(b.lastModified || 0).getTime()
        return dateB - dateA
      })[0]

    return NextResponse.json({
      weeks,
      lastModifiedWeek: lastModifiedWeek?.week || null,
      lastModifiedDate: lastModifiedWeek?.lastModified || null,
    })
  } catch (error) {
    console.error('Errore API weeks-info:', error)
    return NextResponse.json(
      { error: 'Errore nel server' },
      { status: 500 }
    )
  }
}
