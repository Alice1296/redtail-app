import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { compactClientWeeks } from '@/lib/compactWeeks'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

    const { data: profileRows, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')

    if (profileError) {
      throw profileError
    }

    const clientIds = (profileRows || [])
      .filter((profile) => profile.id !== user.id && profile.role !== 'trainer')
      .map((profile) => profile.id as string)

    let clientsCompacted = 0
    let totalMoves = 0
    let totalGhostsRemoved = 0
    const warnings: string[] = []

    for (const clientId of clientIds) {
      try {
        const result = await compactClientWeeks(adminClient, clientId)

        if (result.movesApplied > 0 || result.ghostsRemoved > 0) {
          clientsCompacted += 1
        }

        totalMoves += result.movesApplied
        totalGhostsRemoved += result.ghostsRemoved
        result.warnings.forEach((warning) => warnings.push(`${clientId}: ${warning}`))
      } catch (err: unknown) {
        warnings.push(
          `${clientId}: ${err instanceof Error ? err.message : 'errore compressione'}`
        )
      }
    }

    return NextResponse.json({
      clientsProcessed: clientIds.length,
      clientsCompacted,
      totalMoves,
      totalGhostsRemoved,
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
