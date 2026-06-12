// Configuration Supabase pour le Service Worker
// À mettre à jour avec vos URLs réelles

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Domaines à mettre en cache
export const CACHEABLE_DOMAINS = [
  SUPABASE_URL,
  'https://ui-avatars.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

// Endpoints API à mettre en cache avec durée longue
export const LONG_CACHE_ENDPOINTS = [
  '/students',
  '/classes',
  '/teachers',
  '/academic_years',
  '/schools',
]

// Endpoints API à mettre en cache avec durée courte
export const SHORT_CACHE_ENDPOINTS = [
  '/payments',
  '/expenses',
  '/discipline',
  '/grades',
]

// Endpoints à ne pas mettre en cache
export const NO_CACHE_ENDPOINTS = [
  '/auth',
  '/login',
  '/logout',
]
