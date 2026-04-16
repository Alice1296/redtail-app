import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 1. Recupero sessione (usiamo getUser per sicurezza extra lato server)
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 2. ECCEZIONE RESET PASSWORD E LOGIN (Sempre accessibili)
  if (pathname.startsWith('/reset-password') || pathname === '/') {
    // Se l'utente è già loggato e prova ad andare in '/', lo mandiamo via
    if (user && pathname === '/') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const rolePath = profile?.role === 'trainer' ? '/trainer' : '/client'
      return NextResponse.redirect(new URL(rolePath, request.url))
    }
    return supabaseResponse
  }

  // 3. PROTEZIONE ROTTE PRIVATE (/client, /trainer)
  if (!user && (pathname.startsWith('/client') || pathname.startsWith('/trainer'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 4. CONTROLLO RUOLO CROSS-ROUTING (Opzionale ma sicuro)
  // Impedisce a un 'client' di digitare manualmente '/trainer' nell'URL
  if (user && (pathname.startsWith('/client') || pathname.startsWith('/trainer'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role // 'trainer' o 'client'
    
    // Se un client prova a entrare in /trainer, lo rispediamo a /client
    if (role === 'client' && pathname.startsWith('/trainer')) {
      return NextResponse.redirect(new URL('/client', request.url))
    }
    // Se un trainer prova a entrare in /client, lo rispediamo a /trainer
    if (role === 'trainer' && pathname.startsWith('/client')) {
      return NextResponse.redirect(new URL('/trainer', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}