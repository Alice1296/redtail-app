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

  // Recuperiamo la sessione corrente
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const pathname = request.nextUrl.pathname

  // 1. 🟢 ECCEZIONE RESET PASSWORD
  // Permettiamo sempre l'accesso a questa pagina, altrimenti il link della mail fallisce
  if (pathname.startsWith('/reset-password')) {
    return supabaseResponse
  }

  // 2. 🔴 PROTEZIONE ROTTE PRIVATE
  // Se non sei loggato e provi a entrare in /client o /trainer, vai in Home (Login)
  if (!user && (pathname.startsWith('/client') || pathname.startsWith('/trainer'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. 🟡 REDIRECT INTELLIGENTE DALLA HOME
  // Se sei già loggato e ti trovi sulla Home (pagina di login), ti smistiamo subito
  if (user && pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Se il ruolo è trainer vai su /trainer, altrimenti (default) su /client
    const rolePath = profile?.role === 'trainer' ? '/trainer' : '/client'
    return NextResponse.redirect(new URL(rolePath, request.url))
  }

  return supabaseResponse
}

export const config = {
  // Il matcher esclude i file statici (immagini, icone, ecc.) per non rallentare il sito
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}