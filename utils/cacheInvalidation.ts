/**
 * Système centralisé d'invalidation de cache
 * Permet à toutes les pages de se notifier mutuellement quand un cache change
 */

export type CacheInvalidationEvent = {
  type: 'INVALIDATE' | 'CLEAR_ALL'
  keys?: string[] // Clés à invalider
  pattern?: string // Pattern de clés invalidées (ex: '^students:')
  timestamp: number
  source?: string // Identifiant de la page qui a déclenché l'invalidation
}

type CacheInvalidationListener = (event: CacheInvalidationEvent) => void

class CacheInvalidationManager {
  private listeners: Set<CacheInvalidationListener> = new Set()
  private broadcastChannel: BroadcastChannel | null = null
  private isInitialized = false

  constructor() {
    this.initBroadcastChannel()
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined') return

    try {
      this.broadcastChannel = new BroadcastChannel('cache_invalidation')
      this.broadcastChannel.onmessage = (event) => {
        this.notifyListeners(event.data as CacheInvalidationEvent)
      }
      this.isInitialized = true
    } catch (error) {
      // BroadcastChannel non supporté, on continue sans
      console.warn('BroadcastChannel not supported, cache invalidation will be local only')
    }
  }

  /**
   * S'abonner aux changements de cache
   */
  subscribe(listener: CacheInvalidationListener): () => void {
    this.listeners.add(listener)

    // Retourner une fonction de désabonnement
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notifier tous les listeners locaux
   */
  private notifyListeners(event: CacheInvalidationEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in cache invalidation listener:', error)
      }
    })
  }

  /**
   * Invalider des clés de cache spécifiques
   * @param keys Clés à invalider
   * @param source Identifiant optionnel de la source (pour éviter les boucles)
   */
  invalidateKeys(keys: string[], source?: string) {
    const event: CacheInvalidationEvent = {
      type: 'INVALIDATE',
      keys,
      timestamp: Date.now(),
      source,
    }

    // Notifier localement
    this.notifyListeners(event)

    // Broadcaster à d'autres onglets
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event)
      } catch (error) {
        console.error('Error broadcasting cache invalidation:', error)
      }
    }
  }

  /**
   * Invalider un pattern de clés (ex: toutes les clés commençant par "students_")
   */
  invalidatePattern(pattern: string | RegExp, source?: string) {
    const event: CacheInvalidationEvent = {
      type: 'INVALIDATE',
      pattern: typeof pattern === 'string' ? pattern : pattern.source,
      timestamp: Date.now(),
      source,
    }

    // Notifier localement
    this.notifyListeners(event)

    // Broadcaster à d'autres onglets
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event)
      } catch (error) {
        console.error('Error broadcasting cache invalidation:', error)
      }
    }
  }

  /**
   * Effacer tout le cache
   */
  clearAll(source?: string) {
    const event: CacheInvalidationEvent = {
      type: 'CLEAR_ALL',
      timestamp: Date.now(),
      source,
    }

    // Notifier localement
    this.notifyListeners(event)

    // Broadcaster à d'autres onglets
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event)
      } catch (error) {
        console.error('Error broadcasting cache clear:', error)
      }
    }
  }

  /**
   * Nettoyer les ressources
   */
  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }
    this.listeners.clear()
  }
}

// Instance singleton
let instance: CacheInvalidationManager | null = null

export function getCacheInvalidationManager(): CacheInvalidationManager {
  if (!instance) {
    instance = new CacheInvalidationManager()
  }
  return instance
}

/**
 * Hook React pour utiliser l'invalidation de cache
 * Utile pour les pages qui doivent se rafraîchir quand un cache change
 */
export function useCacheInvalidation(
  onInvalidate: (event: CacheInvalidationEvent) => void,
  deps?: React.DependencyList
) {
  const manager = getCacheInvalidationManager()

  React.useEffect(() => {
    const unsubscribe = manager.subscribe(onInvalidate)
    return unsubscribe
  }, [manager, onInvalidate, ...(deps || [])])
}

// Importer React pour le hook
import React from 'react'
