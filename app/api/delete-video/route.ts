import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const publicVideoPrefix = '/storage/v1/object/public/videos/'

function getStoragePath(videoUrl: string, explicitPath?: string) {
  if (explicitPath) {
    return explicitPath
  }

  const [, filePath] = videoUrl.split(publicVideoPrefix)
  return filePath || ''
}

export async function POST(req: NextRequest) {
  try {
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
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

    const body = await req.json()
    const videoUrl = String(body?.videoUrl || '')
    const filePath = getStoragePath(videoUrl, String(body?.filePath || ''))
    const clientId = String(body?.clientId || user.id)
    const section = String(body?.section || '')
    const weekNumber = Number(body?.weekNumber)
    const day = String(body?.day || '')

    if (!filePath) {
      return NextResponse.json({ error: 'Percorso video richiesto' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const isTrainer = profile?.role === 'trainer'
    const isOwner = clientId === user.id && filePath.startsWith(`${user.id}/`)

    if (!isTrainer && !isOwner) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const { error: storageError } = await adminClient.storage
      .from('videos')
      .remove([filePath])

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 400 })
    }

    if (videoUrl && section && Number.isFinite(weekNumber) && day) {
      const { data: logRow, error: logError } = await adminClient
        .from('client_logs')
        .select('id, video_url, video_urls')
        .eq('client_id', clientId)
        .eq('week_number', weekNumber)
        .eq('day', day)
        .eq('section', section)
        .maybeSingle()

      if (logError) {
        throw logError
      }

      if (logRow) {
        const currentUrls = Array.isArray(logRow.video_urls)
          ? logRow.video_urls
          : logRow.video_url
            ? [logRow.video_url]
            : []
        const nextUrls = currentUrls.filter((value: string) => value !== videoUrl)

        const { error: updateError } = await adminClient
          .from('client_logs')
          .update({
            video_url: null,
            video_urls: nextUrls.length > 0 ? nextUrls : null,
          })
          .eq('id', logRow.id)

        if (updateError) {
          throw updateError
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore eliminazione video',
      },
      { status: 500 }
    )
  }
}
