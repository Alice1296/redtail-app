import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js ora richiede che il file si chiami proxy.ts e che 
 * la funzione esportata si chiami esattamente proxy.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Recupera l'utente
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // 1. PROTEZIONE: Se NON sei loggato e provi a entrare in /client o /trainer -> Vai alla Home
  if (!user && (url.pathname.startsWith('/client') || url.pathname.startsWith('/trainer'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 2. SMISTAMENTO: Se SEI loggato, controlliamo il ruolo nel DB
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Se un trainer prova a sbirciare in /client
    if (role === 'trainer' && url.pathname.startsWith('/client')) {
      return NextResponse.redirect(new URL('/trainer', request.url))
    }
    
    // Se un client prova a entrare in /trainer
    if (role === 'client' && url.pathname.startsWith('/trainer')) {
      return NextResponse.redirect(new URL('/client', request.url))
    }

    // Se sei loggato e ti trovi sulla Home (o login), vai alla tua dashboard
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL(role === 'trainer' ? '/trainer' : '/client', request.url))
    }
  }

  return supabaseResponse
}

// Fondamentale: Next.js vuole anche l'export default per il proxy
export default proxy

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}