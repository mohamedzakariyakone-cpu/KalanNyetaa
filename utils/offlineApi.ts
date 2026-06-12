import { supabase } from '@/utils/supabase'
import { getLocalCache, queueOfflineRequest, setLocalCache } from '@/utils/offlineStorage'

export type OfflineFetchResult<T = any> = {
  data: T | null
  error: any
}

export async function offlineFetch<T = any>(cacheKey: string, fetchFn: () => Promise<OfflineFetchResult<T>>, options?: { cacheOnOnline?: boolean }) {
  const online = typeof window !== 'undefined' ? navigator.onLine : true

  if (!online) {
    const cached = await getLocalCache<T>(cacheKey)
    return {
      data: cached ?? null,
      error: null,
    }
  }

  const result = await fetchFn()

  if (result.error == null && result.data != null && options?.cacheOnOnline !== false) {
    await setLocalCache(cacheKey, result.data)
  }

  return result
}

export type OfflineWriteAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'

export async function offlineWrite<T = any>(params: {
  table: string
  action: OfflineWriteAction
  payload: any
  options?: {
    keyColumn?: string
    keyValue?: string | number
    returning?: string[]
  }
  cacheKey?: string
  optimisticUpdate?: () => void
}) {
  const online = typeof window !== 'undefined' ? navigator.onLine : true

  if (!online) {
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
      data: params.payload,
      error: null,
      offline: true,
    }
  }

  let response: any
  if (params.action === 'INSERT') {
    response = await supabase.from(params.table).insert(Array.isArray(params.payload) ? params.payload : [params.payload])
  } else if (params.action === 'UPDATE') {
    const keyColumn = params.options?.keyColumn ?? 'id'
    const keyValue = params.options?.keyValue
    if (keyValue === undefined || keyValue === null) {
      throw new Error('Missing keyValue for offline update')
    }
    response = await supabase.from(params.table).update(params.payload).eq(keyColumn, keyValue)
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

  if (response?.error == null && params.cacheKey) {
    await setLocalCache(params.cacheKey, response.data)
  }

  return response
}
