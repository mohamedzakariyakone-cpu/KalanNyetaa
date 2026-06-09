import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // 🔒 CAS 1 : L'UTILISATEUR N'EST PAS CONNECTÉ
  if (!user) {
    if (pathname !== '/login') {
      url.pathname = '/login'
      if (pathname !== '/') {
        url.searchParams.set('redirect', pathname)
      }
      
      const redirectResponse = NextResponse.redirect(url)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
  }

  // ✅ CAS 2 : L'UTILISATEUR EST CONNECTÉ
  if (user) {
    // 🎯 PROTECTION STRICTE : On ne redirige vers /dashboard QUE si l'utilisateur tape EXACTEMENT '/' ou '/login'
    if (pathname === '/login' || pathname === '/') {
      const redirectTo = url.searchParams.get('redirect') || '/dashboard'
      
      const redirectResponse = NextResponse.redirect(new URL(redirectTo, request.url))
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    // 🔐 PROTECTION SUPER ADMIN
    if (pathname.startsWith('/super-admin')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'super_admin') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}