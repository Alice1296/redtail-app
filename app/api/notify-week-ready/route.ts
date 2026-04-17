import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role?: string | null
}

type NotificationRow = {
  client_id: string
}

async function sendWeekReadyEmail(to: string, weekNumber: number) {
  if (!resendApiKey || !emailFrom) {
    return { sent: false, skipped: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject: `Settimana ${weekNumber} pronta`,
      text: `La settimana di allenamento ${weekNumber} e pronta, vola come una farfalla!`,
      html: `<p>La settimana di allenamento <strong>${weekNumber}</strong> e pronta, vola come una farfalla!</p>`,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Invio email non riuscito')
  }

  return { sent: true, skipped: false }
}

export async function POST(req: NextRequest) {
  try {
    const { weekNumber } = await req.json()

    if (!weekNumber || Number.isNaN(Number(weekNumber))) {
      return NextResponse.json(
        { error: 'weekNumber richiesto' },
        { status: 400 }
      )
    }

    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null
    const dataClient = adminClient ?? authClient

    const { data: trainerProfile, error: trainerError } = await dataClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (trainerError) {
      throw trainerError
    }

    if (trainerProfile?.role !== 'trainer') {
      return NextResponse.json(
        { error: 'Solo il trainer puo inviare notifiche massime' },
        { status: 403 }
      )
    }

    const { data: profileRows, error: profileError } = await dataClient
      .from('profiles')
      .select('id, email, first_name, last_name, role')

    if (profileError) {
      throw profileError
    }

    const clients = ((profileRows || []) as ProfileRow[]).filter((profile) => {
      if (profile.id === user.id) {
        return false
      }

      if (!profile.email) {
        return false
      }

      return profile.role !== 'trainer'
    })

    if (clients.length === 0) {
      return NextResponse.json({
        success: true,
        notificationsCreated: 0,
        emailsSent: 0,
        emailsSkipped: 0,
        message: 'Nessun cliente trovato',
      })
    }

    const notificationMessage = `La settimana di allenamento ${Number(weekNumber)} e pronta, vola come una farfalla!`

    const { data: existingNotifications, error: existingError } =
      await dataClient
        .from('notifications')
        .select('client_id')
        .eq('week_number', Number(weekNumber))
        .eq('message', notificationMessage)

    if (existingError) {
      throw existingError
    }

    const alreadyNotified = new Set(
      ((existingNotifications || []) as NotificationRow[]).map(
        (notification) => notification.client_id
      )
    )

    const clientsToNotify = clients.filter(
      (client) => !alreadyNotified.has(client.id)
    )

    const notificationClient = adminClient ?? authClient

    if (clientsToNotify.length > 0) {
      const { error: insertError } = await notificationClient
        .from('notifications')
        .insert(
          clientsToNotify.map((client) => ({
            client_id: client.id,
            trainer_id: user.id,
            week_number: Number(weekNumber),
            message: notificationMessage,
            read: false,
          }))
        )

      if (insertError) {
        throw insertError
      }
    }

    let emailsSent = 0
    let emailsSkipped = 0

    for (const client of clientsToNotify) {
      try {
        const emailResult = await sendWeekReadyEmail(
          client.email as string,
          Number(weekNumber)
        )

        if (emailResult.sent) {
          emailsSent += 1
        }

        if (emailResult.skipped) {
          emailsSkipped += 1
        }
      } catch {
        emailsSkipped += 1
      }
    }

    return NextResponse.json({
      success: true,
      notificationsCreated: clientsToNotify.length,
      notificationsSkipped: clients.length - clientsToNotify.length,
      emailsSent,
      emailsSkipped,
      emailConfigured: Boolean(resendApiKey && emailFrom),
      message:
        clientsToNotify.length > 0
          ? 'Notifiche inviate con successo'
          : 'Questa settimana era gia stata notificata a tutti',
    })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Errore durante l invio delle notifiche',
      },
      { status: 500 }
    )
  }
}
