import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { ScoreType } from '@/lib/community'
import {
  parseCommunityPayload,
  serializeCommunityPayload,
  type NotificationRow,
} from '@/lib/communityNotifications'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role?: string | null
}

function createAuthedClients(req: NextRequest) {
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
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

function normalizeDay(day: string | null) {
  return (day || '').trim().toLowerCase()
}

function buildScoreRecord(row: NotificationRow) {
  const payload = parseCommunityPayload(row.message)

  if (!payload || payload.kind !== 'community_score') {
    return null
  }

  return {
    id: row.id,
    client_id: row.client_id,
    week_number: row.week_number,
    day: payload.day,
    score_type: payload.scoreType,
    score_value: payload.scoreValue,
    score_display: payload.scoreDisplay,
    note: payload.note,
    created_at: row.created_at,
  }
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
    const mode = url.searchParams.get('mode') || 'leaderboard'
    const week = Number(url.searchParams.get('week') || '1')
    const day = normalizeDay(url.searchParams.get('day'))

    if (mode === 'my-score') {
      const { data } = await adminClient
        .from('notifications')
        .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
        .eq('client_id', user.id)
        .eq('week_number', week)
        .order('created_at', { ascending: false })

      const ownScore = ((data || []) as NotificationRow[])
        .map(buildScoreRecord)
        .find((row) => row && row.day === day)

      return NextResponse.json({ score: ownScore || null })
    }

    const { data: notificationRows, error: notificationError } = await adminClient
      .from('notifications')
      .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
      .eq('week_number', week)
      .order('created_at', { ascending: true })

    if (notificationError) {
      throw notificationError
    }

    const rows = (notificationRows || []) as NotificationRow[]
    const scores = rows
      .map(buildScoreRecord)
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => row.day === day)

    const scoreIds = new Set(scores.map((score) => score.id))

    const reactions = rows
      .map((row) => {
        const payload = parseCommunityPayload(row.message)
        if (!payload || payload.kind !== 'community_reaction' || payload.day !== day) {
          return null
        }

        if (!scoreIds.has(payload.scoreId)) {
          return null
        }

        return {
          id: row.id,
          score_id: payload.scoreId,
          user_id: row.trainer_id || row.client_id,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    const comments = rows
      .map((row) => {
        const payload = parseCommunityPayload(row.message)
        if (!payload || payload.kind !== 'community_comment' || payload.day !== day) {
          return null
        }

        if (!scoreIds.has(payload.scoreId)) {
          return null
        }

        return {
          id: row.id,
          score_id: payload.scoreId,
          author_id: row.trainer_id || row.client_id,
          comment: payload.comment,
          created_at: row.created_at,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    const profileIds = Array.from(
      new Set([
        ...scores.map((score) => score.client_id),
        ...reactions.map((reaction) => reaction.user_id),
        ...comments.map((comment) => comment.author_id),
      ])
    )

    let profiles: ProfileRow[] = []

    if (profileIds.length > 0) {
      const { data: profileRows, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .in('id', profileIds)

      if (profileError) {
        throw profileError
      }

      profiles = (profileRows || []) as ProfileRow[]
    }

    const { data: workoutData } = await adminClient
      .from('workouts')
      .select('coach_notes')
      .eq('week_number', week)
      .eq('day', day)
      .limit(1)
      .maybeSingle()

    let workoutScoreLabel = ''

    try {
      const coachNotes =
        typeof workoutData?.coach_notes === 'string'
          ? JSON.parse(workoutData.coach_notes || '{}')
          : workoutData?.coach_notes || {}

      workoutScoreLabel = coachNotes.wod_score_label || ''
    } catch {}

    scores.sort((left, right) => {
      const activeScoreType = left.score_type || right.score_type

      if (activeScoreType === 'time') {
        return Number(left.score_value) - Number(right.score_value)
      }

      return Number(right.score_value) - Number(left.score_value)
    })

    return NextResponse.json({
      scores,
      reactions,
      comments,
      profiles,
      workoutScoreLabel,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore caricamento community',
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
    const action = body?.action as string | undefined

    if (action === 'submit-score') {
      const week = Number(body.week)
      const day = normalizeDay(body.day)
      const scoreType = body.scoreType as ScoreType
      const scoreValue = Number(body.scoreValue)
      const scoreDisplay = String(body.scoreDisplay || '').trim()
      const note = String(body.note || '').trim() || null

      const { data: rows, error } = await adminClient
        .from('notifications')
        .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
        .eq('client_id', user.id)
        .eq('week_number', week)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const existingScore = ((rows || []) as NotificationRow[]).find((row) => {
        const payload = parseCommunityPayload(row.message)
        return payload?.kind === 'community_score' && payload.day === day
      })

      const message = serializeCommunityPayload({
        kind: 'community_score',
        day,
        scoreType,
        scoreValue,
        scoreDisplay,
        note,
      })

      if (existingScore) {
        const { error: updateError } = await adminClient
          .from('notifications')
          .update({
            message,
            read: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingScore.id)

        if (updateError) {
          throw updateError
        }
      } else {
        const { error: insertError } = await adminClient.from('notifications').insert({
          client_id: user.id,
          trainer_id: user.id,
          week_number: week,
          message,
          read: true,
        })

        if (insertError) {
          throw insertError
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'toggle-reaction') {
      const week = Number(body.week)
      const day = normalizeDay(body.day)
      const scoreId = String(body.scoreId || '')
      const scoreOwnerId = String(body.scoreOwnerId || '')

      const { data: rows, error } = await adminClient
        .from('notifications')
        .select('id, client_id, trainer_id, week_number, message, created_at, updated_at, read')
        .eq('week_number', week)
        .eq('client_id', scoreOwnerId)
        .eq('trainer_id', user.id)

      if (error) {
        throw error
      }

      const existingReaction = ((rows || []) as NotificationRow[]).find((row) => {
        const payload = parseCommunityPayload(row.message)
        return (
          payload?.kind === 'community_reaction' &&
          payload.day === day &&
          payload.scoreId === scoreId
        )
      })

      if (existingReaction) {
        const { error: deleteError } = await adminClient
          .from('notifications')
          .delete()
          .eq('id', existingReaction.id)

        if (deleteError) {
          throw deleteError
        }
      } else {
        const { error: insertError } = await adminClient.from('notifications').insert({
          client_id: scoreOwnerId,
          trainer_id: user.id,
          week_number: week,
          message: serializeCommunityPayload({
            kind: 'community_reaction',
            day,
            scoreId,
          }),
          read: true,
        })

        if (insertError) {
          throw insertError
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'add-comment') {
      const week = Number(body.week)
      const day = normalizeDay(body.day)
      const scoreId = String(body.scoreId || '')
      const scoreOwnerId = String(body.scoreOwnerId || '')
      const comment = String(body.comment || '').trim()

      if (!comment) {
        return NextResponse.json({ error: 'Commento richiesto' }, { status: 400 })
      }

      const { error } = await adminClient.from('notifications').insert({
        client_id: scoreOwnerId,
        trainer_id: user.id,
        week_number: week,
        message: serializeCommunityPayload({
          kind: 'community_comment',
          day,
          scoreId,
          comment,
        }),
        read: true,
      })

      if (error) {
        throw error
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore aggiornamento community',
      },
      { status: 500 }
    )
  }
}
