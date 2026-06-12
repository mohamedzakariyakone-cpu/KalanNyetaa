import { supabase } from '@/utils/supabase'
import {
  getQueuedRequests,
  removeQueuedRequest,
  OfflineQueueItem,
} from '@/utils/offlineStorage'

// Callback pour les mises à jour de sync
let syncStatusCallback:
  | ((status: 'syncing' | 'success' | 'error', message?: string) => void)
  | null = null

export function setSyncStatusCallback(
  callback: (
    status: 'syncing' | 'success' | 'error',
    message?: string
  ) => void
) {
  syncStatusCallback = callback
}

export async function synchronizeOfflineData() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      message: 'Application hors-ligne',
    }
  }

  syncStatusCallback?.('syncing', 'Synchronisation en cours...')

  const queue = await getQueuedRequests()

  if (queue.length === 0) {
    syncStatusCallback?.('success', 'Aucune donnée à synchroniser')

    return {
      success: true,
      synced: 0,
      failed: 0,
      message: 'Aucune donnée à synchroniser',
    }
  }

  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      await executeOfflineAction(item)

      if (item.id !== undefined) {
        await removeQueuedRequest(item.id)
      }

      synced++
    } catch (error) {
      console.error('Offline sync failed for item', item, error)
      failed++
    }
  }

  const message = `${synced} synchronisé(s), ${failed} échoué(s)`

  syncStatusCallback?.(
    failed === 0 ? 'success' : 'error',
    message
  )

  return {
    success: failed === 0,
    synced,
    failed,
    message,
  }
}

async function executeOfflineAction(item: OfflineQueueItem) {
  if (item.action === 'INSERT') {
    const response = await supabase
      .from(item.table)
      .insert(item.payload)

    if (response.error) throw response.error
  }

  else if (item.action === 'UPDATE') {
    const keyColumn = item.options?.keyColumn ?? 'id'
    const keyValue = item.options?.keyValue

    if (!keyValue) {
      throw new Error('Missing keyValue for offline UPDATE')
    }

    const response = await supabase
      .from(item.table)
      .update(item.payload)
      .eq(keyColumn, keyValue)

    if (response.error) throw response.error
  }

  else if (item.action === 'DELETE') {
    const keyColumn = item.options?.keyColumn ?? 'id'
    const keyValue = item.options?.keyValue

    if (!keyValue) {
      throw new Error('Missing keyValue for offline DELETE')
    }

    const response = await supabase
      .from(item.table)
      .delete()
      .eq(keyColumn, keyValue)

    if (response.error) throw response.error
  }

  else if (item.action === 'UPSERT') {
    const response = await supabase
      .from(item.table)
      .upsert(item.payload)

    if (response.error) throw response.error
  }
}

export function initSyncListeners() {
  if (typeof window === 'undefined') {
    return
  }

  const syncNow = () => {
    void synchronizeOfflineData()
  }

  // Écouter l'événement online
  window.addEventListener('online', syncNow)

  // Écouter les messages du Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_OFFLINE_DATA_REQUEST') {
        syncNow()
      }
    })
  }

  // Synchroniser immédiatement si online
  if (navigator.onLine) {
    setTimeout(syncNow, 1000)
  }
}

// Enregistrer la Background Sync API si disponible
export async function registerBackgroundSync() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready

    if ('sync' in registration) {
      await (registration as any).sync.register(
        'sync-offline-data'
      )

      console.log('Background Sync registered')
    }
  } catch (error) {
    console.error(
      'Failed to register Background Sync:',
      error
    )
  }
}

// Fonction pour forcer une synchronisation manuelle
export async function forceSyncNow() {
  return synchronizeOfflineData()
}