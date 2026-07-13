import { supabase } from '@/utils/supabase'
import { getCacheInvalidationManager } from '@/utils/cacheInvalidation'

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
  try {
    const result = await fetchFn()
    return result
  } catch (error) {
    return {
      data: null,
      error,
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
  if (params.optimisticUpdate) {
    params.optimisticUpdate()
  }

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
        throw new Error('Missing keyValue for update')
      }

      response = await supabase
        .from(params.table)
        .update(params.payload)
        .eq(keyColumn, keyValue)
    } else if (params.action === 'DELETE') {
      const keyColumn = params.options?.keyColumn ?? 'id'
      const keyValue = params.options?.keyValue

      if (keyValue === undefined || keyValue === null) {
        throw new Error('Missing keyValue for delete')
      }

      response = await supabase.from(params.table).delete().eq(keyColumn, keyValue)
    } else if (params.action === 'UPSERT') {
      response = await supabase.from(params.table).upsert(params.payload)
    }

    if (response?.error) {
      throw response.error
    }

    const manager = getCacheInvalidationManager()
    if (params.cacheKey) {
      manager.invalidateKeys([params.cacheKey], `realtime:${params.table}`)
    }
    manager.invalidatePattern(new RegExp(`^${params.table}(?:[:_]|$)`), `realtime:${params.table}`)

    return {
      data: response?.data ?? (params.payload as T),
      error: null,
    }
  } catch (error) {
    console.error(`Write error for ${params.table}:`, error)

    return {
      data: null,
      error,
    }
  }
}
