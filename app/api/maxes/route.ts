import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_MAX_LIFTS, normalizeExerciseName } from '@/lib/community'
import {
  parseCommunityPayload,
  serializeCommunityPayload,
  type NotificationRow,
} from '@/lib/communityNotifications'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type MaxValue = {
  value: number
  unit: string
  updatedAt: string | null
}

type MaxEntryInput = {
  liftName?: unknown
  value?: unknown
  unit?: unknown
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

function emptyMaxMap() {
  return {} as Record<string, MaxValue>
}

async function loadLegacyNotificationMaxes(
  adminClient: ReturnType<typeof createAuthedClients>['adminClient'],
  targetClientId: string
) {
  const { data, error } = await adminClient
    .from('notifications')
    .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
    .eq('client_id', targetClientId)
    .eq('week_number', 0)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const values = emptyMaxMap()

  ;((data || []) as NotificationRow[]).forEach((row) => {
    const payload = parseCommunityPayload(row.message)

    if (payload?.kind !== 'client_max') {
      return
    }

    const liftName = normalizeExerciseName(payload.liftName)

    if (!values[liftName]) {
      values[liftName] = {
        value: payload.value,
        unit: payload.unit,
        updatedAt: row.updated_at || row.created_at || null,
      }
    }
  })

  return values
}

export async function GET(req: NextRequest) {
  try {
    const { authClient, adminClient } = createAuthedClients(req)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const url = new URL(req.url)
    const targetClientId = url.searchParams.get('clientId') || user.id

    if (targetClientId !== user.id) {
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

    let values = emptyMaxMap()

    const { data: prRows, error: prError } = await adminClient
      .from('user_pr')
      .select('exercise_name, weight, updated_at')
      .eq('user_id', targetClientId)

    if (!prError) {
      ;((prRows || []) as Array<{
        exercise_name: string
        weight: number
        updated_at: string | null
      }>).forEach((row) => {
        const liftName = normalizeExerciseName(row.exercise_name)
        values[liftName] = {
          value: Number(row.weight),
          unit: 'kg',
          updatedAt: row.updated_at,
        }
      })
    } else if (prError.code !== '42P01') {
      throw prError
    }

    if (Object.keys(values).length === 0) {
      values = await loadLegacyNotificationMaxes(adminClient, targetClientId)
    }

    return NextResponse.json({ values })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore caricamento massimali',
      },
      { status: 500 }
    )
  }
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

    const body = await req.json()
    const entries: MaxEntryInput[] = Array.isArray(body?.entries)
      ? body.entries
      : []

    const normalizedEntries = entries
      .map((entry) => {
        const liftName = normalizeExerciseName(String(entry?.liftName || ''))
        const value = Number(entry?.value)
        const unit = String(entry?.unit || 'kg').trim() || 'kg'

        if (
          !liftName ||
          !DEFAULT_MAX_LIFTS.includes(liftName) ||
          Number.isNaN(value) ||
          value <= 0
        ) {
          return null
        }

        return { liftName, value, unit }
      })
      .filter(
        (entry): entry is { liftName: string; value: number; unit: string } =>
          Boolean(entry)
      )

    if (normalizedEntries.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const prPayload = normalizedEntries.map((entry) => ({
      user_id: user.id,
      exercise_name: entry.liftName,
      weight: entry.value,
      updated_at: new Date().toISOString(),
    }))

    const { error: prUpsertError } = await adminClient
      .from('user_pr')
      .upsert(prPayload, { onConflict: 'user_id,exercise_name' })

    if (!prUpsertError) {
      return NextResponse.json({ ok: true, storage: 'user_pr' })
    }

    if (prUpsertError.code !== '42P01') {
      throw prUpsertError
    }

    const { data: existingRows, error: existingError } = await adminClient
      .from('notifications')
      .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
      .eq('client_id', user.id)
      .eq('week_number', 0)
      .order('created_at', { ascending: false })

    if (existingError) {
      throw existingError
    }

    const currentRows = (existingRows || []) as NotificationRow[]

    for (const entry of normalizedEntries) {
      const existing = currentRows.find((row) => {
        const payload = parseCommunityPayload(row.message)
        return (
          payload?.kind === 'client_max' &&
          normalizeExerciseName(payload.liftName) === entry.liftName
        )
      })

      const message = serializeCommunityPayload({
        kind: 'client_max',
        liftName: entry.liftName,
        value: entry.value,
        unit: entry.unit,
      })

      if (existing) {
        const { error: updateError } = await adminClient
          .from('notifications')
          .update({
            message,
            read: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          throw updateError
        }
      } else {
        const { error: insertError } = await adminClient.from('notifications').insert({
          client_id: user.id,
          trainer_id: user.id,
          week_number: 0,
          message,
          read: true,
        })

        if (insertError) {
          throw insertError
        }
      }
    }

    return NextResponse.json({ ok: true, storage: 'notifications-fallback' })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore salvataggio massimali',
      },
      { status: 500 }
    )
  }
}
