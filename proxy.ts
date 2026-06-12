import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROLES_CONFIG, type RoleType } from './app/config/roles'

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
        cookies: ({
          // Retourne la valeur du cookie côté serveur
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          // Définit un cookie sur la réponse (ne pas toucher request.cookies)
          set(name: string, value: string, options?: any) {
            try {
              ;(response as any).cookies.set(name, value, options)
            } catch (err) {
              // Fallback : tenter de définir via la forme objet
              ;(response as any).cookies.set({ name, value, ...options })
            }
          },
          // Supprime un cookie côté réponse
          delete(name: string, options?: any) {
            try {
              ;(response as any).cookies.delete(name)
            } catch (err) {
              // Fallback : définir une date d'expiration passée
              ;(response as any).cookies.set(name, '', { ...(options || {}), expires: new Date(0) })
            }
          },
        } as unknown) as any,
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // 🔒 CAS 1 : L'UTILISATEUR N'EST PAS CONNECTÉ À SUPABASE
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

  // ✅ CAS 2 : L'UTILISATEUR EST BIEN CONNECTÉ À SUPABASE
  if (user) {
    // Si l'utilisateur est connecté et va sur /login, on le ramène au choix du rôle (/)
    if (pathname === '/login') {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    // 🔐 SÉCURITÉ DES RÔLES LOCAUX (PROTECTION ANTI-FORÇAGE D'URL)
    // On extrait le rôle depuis les cookies pour la sécurité côté serveur
    const userRoleCookie = request.cookies.get('userRole')?.value as RoleType | undefined

    // Si l'utilisateur essaie d'accéder à une page de l'application (ex: /dashboard, /finance, /academic...)
    // mais qu'il n'a pas encore choisi de rôle, on le force à rester sur l'écran de sélection (/)
    if (pathname !== '/' && !userRoleCookie) {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    // Si un rôle est sélectionné, on vérifie s'il a le droit d'accéder à l'URL demandée
    if (userRoleCookie && pathname !== '/') {
      const roleConfig = ROLES_CONFIG[userRoleCookie]
      
      if (roleConfig) {
        // On vérifie si le chemin actuel commence par une des pages autorisées du rôle
        const isPageAllowed = roleConfig.allowedPages.some(allowedPath => 
          pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
        )

        // Si le Caissier ou le Directeur tente de forcer une URL non autorisée (ex: /finance)
        if (!isPageAllowed) {
          const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
          response.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie)
          })
          return redirectResponse
        }
      }
    }

    // 🔐 PROTECTION SUPER ADMIN (CONSERVÉE)
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