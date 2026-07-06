import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const publicVideoPrefix = '/storage/v1/object/public/videos/'

type ClientLogRow = {
  id: string
  section: string
  notes: string | null
  video_url?: string | null
  video_urls?: string[] | null
}

function getVideoStoragePath(videoUrl: string) {
  const [, filePath] = videoUrl.split(publicVideoPrefix)
  return filePath || ''
}

async function fileExists(
  adminClient: SupabaseClient,
  videoUrl: string
) {
  const filePath = getVideoStoragePath(videoUrl)

  if (!filePath) {
    return false
  }

  const { error } = await adminClient.storage.from('videos').download(filePath)
  return !error
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

    const { data: trainerProfile, error: trainerError } = await adminClient
      .from('profiles')
      .select('role')
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
    const weekNumber = Number(body?.weekNumber)
    const day = String(body?.day || '')

    if (!clientId || !Number.isFinite(weekNumber) || !day) {
      return NextResponse.json(
        { error: 'clientId, weekNumber e day sono richiesti' },
        { status: 400 }
      )
    }

    const { data: logRows, error: logsError } = await adminClient
      .from('client_logs')
      .select('id, section, notes, video_url, video_urls')
      .eq('client_id', clientId)
      .eq('week_number', weekNumber)
      .eq('day', day)

    if (logsError) {
      throw logsError
    }

    const sanitizedLogs: ClientLogRow[] = []

    for (const log of (logRows || []) as ClientLogRow[]) {
      const candidateUrls =
        Array.isArray(log.video_urls) && log.video_urls.length > 0
          ? log.video_urls
          : log.video_url
            ? [log.video_url]
            : []

      const validUrls: string[] = []

      for (const videoUrl of candidateUrls) {
        if (await fileExists(adminClient, videoUrl)) {
          validUrls.push(videoUrl)
        }
      }

      const nextVideoUrls = validUrls.length > 0 ? validUrls : null
      const shouldUpdate =
        (log.video_url || null) !== null ||
        JSON.stringify(log.video_urls || null) !== JSON.stringify(nextVideoUrls)

      if (shouldUpdate) {
        const { error: updateError } = await adminClient
          .from('client_logs')
          .update({
            video_url: null,
            video_urls: nextVideoUrls,
          })
          .eq('id', log.id)

        if (updateError) {
          throw updateError
        }
      }

      sanitizedLogs.push({
        ...log,
        video_url: null,
        video_urls: nextVideoUrls,
      })
    }

    return NextResponse.json({ logs: sanitizedLogs })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore pulizia video atleta',
      },
      { status: 500 }
    )
  }
}
