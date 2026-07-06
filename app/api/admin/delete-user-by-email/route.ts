import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: NextRequest) {
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

    // 1. Verifica che il richiedente sia un trainer autenticato
    const { data: { user: requester }, error: authError } = await authClient.auth.getUser()

    if (authError || !requester) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: requesterProfile, error: requesterError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .maybeSingle()

    if (requesterError) {
      throw requesterError
    }

    if (requesterProfile?.role !== 'trainer') {
      return NextResponse.json(
        { error: 'Solo i trainer possono eliminare utenti' },
        { status: 403 }
      )
    }

    // 2. Leggi l'email da eliminare
    const body = await req.json()
    const targetEmail = String(body?.email || '').trim().toLowerCase()

    if (!targetEmail) {
      return NextResponse.json({ error: 'Email mancante' }, { status: 400 })
    }

    // 3. Trova l'utente per email da Supabase Auth
    console.log(`[DELETE USER] Ricerca utente con email ${targetEmail}...`)
    const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers()

    if (listError) {
      throw listError
    }

    // Trova l'utente per email (controllando sia il database che Auth)
    const targetUser = authUsers.users.find(
      (u) => u.email?.toLowerCase() === targetEmail
    )

    if (!targetUser) {
      console.log(
        `[DELETE USER] Utente ${targetEmail} non trovato in Supabase Auth`
      )
      return NextResponse.json(
        { error: `Utente con email ${targetEmail} non trovato`, status: 'not_found' },
        { status: 404 }
      )
    }

    console.log(
      `[DELETE USER] Utente trovato: ${targetUser.id}`
    )

    // 4. Elimina i dati associati in ordine logico (da figli a padre)
    const deletions = [
      { table: 'client_logs', column: 'client_id' },
      { table: 'score_comments', column: 'client_id' },
      { table: 'score_reactions', column: 'client_id' },
      { table: 'workout_scores', column: 'client_id' },
      { table: 'workouts', column: 'client_id' },
      { table: 'client_maxes', column: 'client_id' },
      { table: 'notifications', column: 'client_id' },
      { table: 'profiles', column: 'id' },
    ]

    const deletedTables: string[] = []

    for (const { table, column } of deletions) {
      try {
        const { error: deleteError } = await adminClient
          .from(table)
          .delete()
          .eq(column, targetUser.id)

        if (deleteError) {
          if (deleteError.code === '42P01') {
            console.warn(`[DELETE USER] Tabella ${table} non esiste`)
          } else {
            console.warn(
              `[DELETE USER] Errore eliminazione da ${table}: ${deleteError.message}`
            )
          }
        } else {
          deletedTables.push(table)
          console.log(`[DELETE USER] ✓ ${table}`)
        }
      } catch (err) {
        console.error(`[DELETE USER] Errore durante eliminazione da ${table}:`, err)
      }
    }

    // 5. Attesa per assicurarsi che le eliminazioni siano completate
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 6. Elimina l'utente da Supabase Auth
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      targetUser.id
    )

    if (deleteUserError) {
      console.error(
        `[DELETE USER] Errore eliminazione da Auth:`,
        deleteUserError.message
      )
      return NextResponse.json(
        {
          error: `Errore eliminazione account: ${deleteUserError.message}`,
          deletedTables,
        },
        { status: 500 }
      )
    }

    console.log(`[DELETE USER] ✓ Utente ${targetEmail} eliminato completamente`)

    return NextResponse.json({
      success: true,
      email: targetEmail,
      userId: targetUser.id,
      deletedTables,
      message: `Utente ${targetEmail} e tutti i dati associati eliminati con successo`,
    })
  } catch (error) {
    console.error('[DELETE USER] Errore:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Errore durante eliminazione utente',
      },
      { status: 500 }
    )
  }
}
