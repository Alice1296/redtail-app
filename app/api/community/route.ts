import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

type ScoreRow = {
  id: string
  client_id: string
  week_number: number
  day: string
  score_type: string
  score_value: number
  score_display: string
  note: string | null
  created_at: string
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

function normalizeDay(day: string | null) {
  return (day || '').trim().toLowerCase()
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
    const week = Number(url.searchParams.get('week') || '1')
    const day = normalizeDay(url.searchParams.get('day'))

    const { data: scoreRows, error: scoresError } = await adminClient
      .from('workout_scores')
      .select(
        'id, client_id, week_number, day, score_type, score_value, score_display, note, created_at'
      )
      .eq('week_number', week)
      .eq('day', day)

    if (scoresError) {
      throw scoresError
    }

    const scores = (scoreRows || []) as ScoreRow[]
    const scoreIds = scores.map((score) => score.id)

    const [reactionsResult, commentsResult] = await Promise.all([
      scoreIds.length > 0
        ? adminClient
            .from('score_reactions')
            .select('id, score_id, user_id')
            .in('score_id', scoreIds)
        : Promise.resolve({ data: [], error: null }),
      scoreIds.length > 0
        ? adminClient
            .from('score_comments')
            .select('id, score_id, author_id, comment, created_at')
            .in('score_id', scoreIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ])

    if (reactionsResult.error) {
      throw reactionsResult.error
    }

    if (commentsResult.error) {
      throw commentsResult.error
    }

    const reactions = reactionsResult.data || []
    const comments = commentsResult.data || []

    const profileIds = Array.from(
      new Set([
        ...scores.map((score) => score.client_id),
        ...reactions.map((reaction) => reaction.user_id as string),
        ...comments.map((comment) => comment.author_id as string),
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
    console.error('Errore GET community:', error)
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

    if (action === 'toggle-reaction') {
      const scoreId = String(body.scoreId || '')

      if (!scoreId) {
        return NextResponse.json({ error: 'scoreId richiesto' }, { status: 400 })
      }

      const { data: existingReaction, error: findError } = await adminClient
        .from('score_reactions')
        .select('id')
        .eq('score_id', scoreId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (findError) {
        throw findError
      }

      if (existingReaction) {
        const { error: deleteError } = await adminClient
          .from('score_reactions')
          .delete()
          .eq('id', existingReaction.id)

        if (deleteError) {
          throw deleteError
        }
      } else {
        const { error: insertError } = await adminClient
          .from('score_reactions')
          .insert({ score_id: scoreId, user_id: user.id })

        if (insertError) {
          throw insertError
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'add-comment') {
      const scoreId = String(body.scoreId || '')
      const comment = String(body.comment || '').trim()

      if (!scoreId || !comment) {
        return NextResponse.json(
          { error: 'scoreId e commento richiesti' },
          { status: 400 }
        )
      }

      const { error: insertError } = await adminClient.from('score_comments').insert({
        score_id: scoreId,
        author_id: user.id,
        comment,
      })

      if (insertError) {
        throw insertError
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
