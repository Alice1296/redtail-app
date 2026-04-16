import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Creiamo la risposta base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Inizializziamo Supabase con una gestione cookie ultra-precisa
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 3. Recuperiamo l'utente (usiamo getUser che è più sicuro di getSession)
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // --- LOGICA DI REINDIRIZZAMENTO ---

  // A. Escludi la pagina di reset password dai controlli
  if (pathname.startsWith('/reset-password')) {
    return response
  }

  // B. Se non sei loggato e provi a entrare nelle aree private -> Vai alla Home
  if (!user && (pathname.startsWith('/client') || pathname.startsWith('/trainer'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // C. Se sei loggato e ti trovi sulla Home -> Smistamento basato sul ruolo
  if (user && pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const rolePath = profile?.role === 'trainer' ? '/trainer' : '/client'
    return NextResponse.redirect(new URL(rolePath, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}