/**
 * Hook pour rafraîchir automatiquement les données quand un cache est invalidé
 * Cela permet aux pages de se mettre à jour instantanément sans actualiser
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { getCacheInvalidationManager, CacheInvalidationEvent } from '@/utils/cacheInvalidation'

interface UseCacheRefreshOptions {
  // Clés de cache à surveiller pour l'invalidation
  cacheKeys?: string[]
  // Pattern regex pour surveiller les clés (ex: /^students_/)
  cachePattern?: RegExp | string
  // Fonction à appeler quand une invalidation est détectée
  onInvalidate?: () => void | Promise<void>
  // Délai en ms avant de déclencher le refresh (pour regrouper les invalidations)
  debounceMs?: number
  // Si true, ignore les invalidations de la même source
  ignoreOwnSource?: boolean
  // Rafraîchir discrètement quand la page redevient visible
  refreshOnFocus?: boolean
  // Rafraîchir discrètement quand l'onglet devient visible
  refreshOnVisibilityChange?: boolean
  // Lancer un refresh une fois au montage du composant
  refreshOnMount?: boolean
  // Intervalle de rafraîchissement automatique en ms (fonctionne si la page est visible)
  refreshIntervalMs?: number
}

export function useCacheRefresh(options: UseCacheRefreshOptions = {}) {
  const {
    cacheKeys = [],
    cachePattern,
    onInvalidate,
    debounceMs = 100,
    ignoreOwnSource = true,
  } = options

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [sourceId] = useState(() => `page:${Math.random().toString(36).substring(2, 11)}`)

  const handleInvalidation = useCallback(
    async (event: CacheInvalidationEvent) => {
      // Ignorer les invalidations de la même source si demandé
      if (ignoreOwnSource && event.source === sourceId) {
        return
      }

      // Vérifier si l'invalidation concerne nos clés
      let shouldRefresh = false

      if (event.type === 'CLEAR_ALL') {
        shouldRefresh = true
      } else {
        if (event.keys) {
          // Vérifier si une des clés correspond
          if (cacheKeys.length > 0) {
            shouldRefresh = event.keys.some((key) => cacheKeys.includes(key))
          }

          // Vérifier si une des clés correspond au pattern
          if (!shouldRefresh && cachePattern) {
            const pattern = typeof cachePattern === 'string' ? new RegExp(cachePattern) : cachePattern
            shouldRefresh = event.keys.some((key) => pattern.test(key))
          }
        }

        if (!shouldRefresh && cachePattern && event.pattern) {
          const invalidationPattern = event.pattern
          const cachePatternRegex = typeof cachePattern === 'string' ? new RegExp(cachePattern) : cachePattern

          // Vérifier si la pattern d'invalidation correspond à notre pattern locale
          if (cachePatternRegex.test(invalidationPattern)) {
            shouldRefresh = true
          }

          if (!shouldRefresh && cacheKeys.length > 0) {
            try {
              const invalidationRegex = new RegExp(invalidationPattern)
              shouldRefresh = cacheKeys.some((key) => invalidationRegex.test(key))
            } catch (error) {
              console.warn('Invalid cache invalidation pattern:', invalidationPattern, error)
            }
          }

          if (!shouldRefresh) {
            const extractBase = (pattern: string) => {
              const cleaned = pattern.replace(/^\^/, '')
              const match = cleaned.match(/^[A-Za-z0-9_]+/)
              return match ? match[0] : ''
            }

            const invalidationBase = extractBase(invalidationPattern)
            const cachePatternBase = extractBase(cachePatternRegex.source)

            if (invalidationBase && cachePatternBase) {
              if (
                invalidationBase === cachePatternBase ||
                invalidationBase.startsWith(cachePatternBase) ||
                cachePatternBase.startsWith(invalidationBase)
              ) {
                shouldRefresh = true
              }
            }
          }
        }
      }

      if (!shouldRefresh) return

      // Débouncer le refresh pour éviter les appels multiples rapides
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          if (onInvalidate) {
            await onInvalidate()
          }
        } catch (error) {
          console.error('Error in cache refresh callback:', error)
        }
      }, debounceMs)
    },
    [cacheKeys, cachePattern, onInvalidate, debounceMs, ignoreOwnSource, sourceId]
  )

  useEffect(() => {
    const manager = getCacheInvalidationManager()
    const unsubscribe = manager.subscribe(handleInvalidation)

    return () => {
      unsubscribe()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [handleInvalidation])

  const refreshOnFocus = options.refreshOnFocus ?? true
  const refreshOnVisibilityChange = options.refreshOnVisibilityChange ?? true
  const refreshOnMount = options.refreshOnMount ?? false
  const refreshIntervalMs = options.refreshIntervalMs ?? 0

  const refreshCallback = useCallback(async () => {
    if (onInvalidate) {
      try {
        await onInvalidate()
      } catch (error) {
        console.error('Background refresh failed:', error)
      }
    }
  }, [onInvalidate])

  useEffect(() => {
    if (!refreshOnMount || !onInvalidate) return
    void refreshCallback()
  }, [refreshOnMount, refreshCallback, onInvalidate])

  useEffect(() => {
    if (typeof window === 'undefined' || refreshIntervalMs <= 0 || !onInvalidate) return

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshCallback()
      }
    }, refreshIntervalMs)

    return () => window.clearInterval(interval)
  }, [refreshIntervalMs, refreshCallback, onInvalidate])

  useEffect(() => {
    if (typeof window === 'undefined' || !onInvalidate) return

    const handleFocus = () => {
      if (refreshOnFocus && document.visibilityState === 'visible') {
        void refreshCallback()
      }
    }

    const handleVisibility = () => {
      if (refreshOnVisibilityChange && document.visibilityState === 'visible') {
        void refreshCallback()
      }
    }

    if (refreshOnFocus) {
      window.addEventListener('focus', handleFocus)
    }
    if (refreshOnVisibilityChange) {
      window.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      if (refreshOnFocus) {
        window.removeEventListener('focus', handleFocus)
      }
      if (refreshOnVisibilityChange) {
        window.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [refreshOnFocus, refreshOnVisibilityChange, refreshCallback, onInvalidate])

  // Retourner une fonction pour invalider manuellement depuis cette page
  const invalidate = useCallback(
    (keys: string[]) => {
      const manager = getCacheInvalidationManager()
      manager.invalidateKeys(keys, sourceId)
    },
    [sourceId]
  )

  return { invalidate, sourceId }
}
