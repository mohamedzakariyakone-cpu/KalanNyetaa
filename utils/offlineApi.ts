import { supabase } from '@/utils/supabase'
import {
  getLocalCache,
  queueOfflineRequest,
  setLocalCache,
  getCacheMetadata,
} from '@/utils/offlineStorage'

export type OfflineFetchResult<T = any> = {
  data: T | null
  error: any
  isFromCache?: boolean
  isOffline?: boolean
}

export type OfflineFetchOptions = {
  cacheOnOnline?: boolean
  cacheDuration?: number // en secondes
  forceRefresh?: boolean
}

/**
 * Récupère les données avec fallback offline automatique
 * @param cacheKey Clé unique pour le cache
 * @param fetchFn Fonction qui récupère les données
 * @param options Options de cache
 */
export async function offlineFetch<T = any>(
  cacheKey: string,
  fetchFn: () => Promise<OfflineFetchResult<T>>,
  options?: OfflineFetchOptions
): Promise<OfflineFetchResult<T>> {
  const online = typeof window !== 'undefined' ? navigator.onLine : true

  // Si forceRefresh, ignorer le cache
  if (options?.forceRefresh && online) {
    try {
      const result = await fetchFn()

      if (result.error == null && result.data != null && options?.cacheOnOnline !== false) {
        await setLocalCache(cacheKey, result.data, {
          expiresIn: options?.cacheDuration,
        })
      }

      return result
    } catch (error) {
      // En cas d'erreur, essayer le cache
      const cached = await getLocalCache<T>(cacheKey)
      return {
        data: cached ?? null,
        error: error,
        isFromCache: !!cached,
      }
    }
  }

  // Si offline, retourner le cache
  if (!online) {
    const cached = await getLocalCache<T>(cacheKey)
    return {
      data: cached ?? null,
      error: null,
      isFromCache: !!cached,
      isOffline: true,
    }
  }

  // Online - Essayer de récupérer les données fraîches
  try {
    const result = await fetchFn()

    if (result.error == null && result.data != null && options?.cacheOnOnline !== false) {
      await setLocalCache(cacheKey, result.data, {
        expiresIn: options?.cacheDuration,
      })
    }

    return result
  } catch (error) {
    // En cas d'erreur réseau, essayer le cache
    const cached = await getLocalCache<T>(cacheKey)
    if (cached) {
      return {
        data: cached,
        error: error,
        isFromCache: true,
      }
    }

    return {
      data: null,
      error: error,
    }
  }
}

export type OfflineWriteAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'

export type OfflineWriteParams<T = any> = {
  table: string
  action: OfflineWriteAction
  payload: T
  options?: {
    keyColumn?: string
    keyValue?: string | number
    returning?: string[]
  }
  cacheKey?: string
  optimisticUpdate?: () => void
}

export type OfflineWriteResult<T = any> = {
  data: T | null
  error: any
  offline?: boolean
}

/**
 * Écrit les données avec queue offline automatique
 * @param params Paramètres de l'opération
 */
export async function offlineWrite<T = any>(
  params: OfflineWriteParams<T>
): Promise<OfflineWriteResult<T>> {
  const online = typeof window !== 'undefined' ? navigator.onLine : true

  if (!online) {
    // Offline - Mettre à jour l'UI de manière optimiste et mettre en queue
    if (params.optimisticUpdate) {
      params.optimisticUpdate()
    }

    await queueOfflineRequest({
      table: params.table,
      action: params.action,
      payload: params.payload,
      options: params.options,
    })

    return {
      data: params.payload as T,
      error: null,
      offline: true,
    }
  }

  // Online - Exécuter l'opération
  try {
    let response: any

    if (params.action === 'INSERT') {
      response = await supabase
        .from(params.table)
        .insert(Array.isArray(params.payload) ? params.payload : [params.payload])
    } else if (params.action === 'UPDATE') {
      const keyColumn = params.options?.keyColumn ?? 'id'
      const keyValue = params.options?.keyValue

      if (keyValue === undefined || keyValue === null) {
        throw new Error('Missing keyValue for offline update')
      }

      response = await supabase
        .from(params.table)
        .update(params.payload)
        .eq(keyColumn, keyValue)
    } else if (params.action === 'DELETE') {
      const keyColumn = params.options?.keyColumn ?? 'id'
      const keyValue = params.options?.keyValue

      if (keyValue === undefined || keyValue === null) {
        throw new Error('Missing keyValue for offline delete')
      }

      response = await supabase.from(params.table).delete().eq(keyColumn, keyValue)
    } else if (params.action === 'UPSERT') {
      response = await supabase.from(params.table).upsert(params.payload)
    }

    if (response?.error) {
      throw response.error
    }

    // Mettre à jour le cache si nécessaire
    if (params.cacheKey && response?.data) {
      await setLocalCache(params.cacheKey, response.data)
    }

    // Appel optimiste si succès
    if (params.optimisticUpdate) {
      params.optimisticUpdate()
    }

    return {
      data: response?.data ?? (params.payload as T),
      error: null,
    }
  } catch (error) {
    console.error(`Offline write error for ${params.table}:`, error)

    // En cas d'erreur, mettre en queue pour retry
    if (params.optimisticUpdate) {
      params.optimisticUpdate()
    }

    await queueOfflineRequest({
      table: params.table,
      action: params.action,
      payload: params.payload,
      options: params.options,
    })

    return {
      data: params.payload as T,
      error: error,
      offline: true,
    }
  }
}

/**
 * Précharge les données critiques pour une utilisation offline
 */
export async function preloadCriticalData(
  dataToPreload: Array<{
    key: string
    fetchFn: () => Promise<OfflineFetchResult<any>>
    cacheDuration?: number
  }>
) {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return
  }

  const results = await Promise.allSettled(
    dataToPreload.map(async (item) => {
      try {
        const result = await item.fetchFn()
        if (result.data && !result.error) {
          await setLocalCache(item.key, result.data, {
            expiresIn: item.cacheDuration,
          })
          return { key: item.key, success: true }
        }
      } catch (error) {
        console.error(`Failed to preload ${item.key}:`, error)
      }
      return { key: item.key, success: false }
    })
  )

  return results
}

/**
 * Obtient le statut du cache pour une clé
 */
export async function getCacheStatus(key: string) {
  const metadata = await getCacheMetadata(key)
  const data = await getLocalCache(key)

  return {
    exists: !!data,
    metadata,
    isExpired: metadata?.expiresAt ? metadata.expiresAt < Date.now() : false,
  }
}
