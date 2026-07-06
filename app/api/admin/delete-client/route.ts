import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function isMissingTableError(error: PostgrestError | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST106' ||
    error?.code === 'PGRST205'
  )
}

async function runDelete(
  operation: PromiseLike<{ error: PostgrestError | null }>,
  options: { optional?: boolean } = {}
) {
  const { error } = await operation

  if (error && (!options.optional || !isMissingTableError(error))) {
    throw error
  }
}

function getStoragePath(videoUrl: string) {
  const publicVideoPrefix = '/storage/v1/object/public/videos/'
  const [, publicPath] = videoUrl.split(publicVideoPrefix)

  if (publicPath) {
    return publicPath
  }

  if (!videoUrl.startsWith('http') && !videoUrl.startsWith('/')) {
    return videoUrl
  }

  return ''
}

export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' },
        { status: 500 }
      )
    }

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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (trainerError) {
      throw trainerError
    }

    if (trainerProfile?.role !== 'trainer') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const body = await req.json()
    const clientId = String(body?.clientId || '')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 })
    }

    if (clientId === user.id) {
      return NextResponse.json(
        { error: 'Non puoi eliminare il tuo account trainer' },
        { status: 400 }
      )
    }

    const { data: clientProfile, error: clientProfileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', clientId)
      .maybeSingle()

    if (clientProfileError) {
      throw clientProfileError
    }

    if (!clientProfile) {
      return NextResponse.json({ error: 'Atleta non trovato' }, { status: 404 })
    }

    if (clientProfile.role === 'trainer') {
      return NextResponse.json(
        { error: 'Non è possibile eliminare un account trainer' },
        { status: 400 }
      )
    }

    const { data: clientLogs, error: logsError } = await adminClient
      .from('client_logs')
      .select('video_url, video_urls')
      .eq('client_id', clientId)

    if (logsError) {
      throw logsError
    }

    const filesToRemove = Array.from(
      new Set(
        (clientLogs || [])
          .flatMap((row) => [
            ...(row.video_urls || []),
            ...(row.video_url ? [row.video_url] : []),
          ])
          .map((url) => getStoragePath(url))
          .filter(Boolean)
      )
    )

    if (filesToRemove.length > 0) {
      const { error: storageError } = await adminClient.storage
        .from('videos')
        .remove(filesToRemove)

      if (storageError) {
        console.error('Errore rimozione video atleta:', storageError)
      }
    }

    await runDelete(adminClient.from('client_logs').delete().eq('client_id', clientId))
    await runDelete(adminClient.from('workouts').delete().eq('client_id', clientId))
    await runDelete(
      adminClient
        .from('notifications')
        .delete()
        .or(`client_id.eq.${clientId},trainer_id.eq.${clientId}`)
    )

    await runDelete(adminClient.from('client_maxes').delete().eq('client_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('user_pr').delete().eq('user_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('week_completion_status').delete().eq('client_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('score_reactions').delete().eq('user_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('score_comments').delete().eq('author_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('workout_scores').delete().eq('client_id', clientId), {
      optional: true,
    })
    await runDelete(adminClient.from('profiles').delete().eq('id', clientId))

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(clientId)

    if (deleteUserError) {
      throw deleteUserError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore eliminazione atleta',
      },
      { status: 500 }
    )
  }
}
