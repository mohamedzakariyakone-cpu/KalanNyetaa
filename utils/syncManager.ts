import { supabase } from '@/utils/supabase'
import { getQueuedRequests, removeQueuedRequest } from '@/utils/offlineStorage'

export async function synchronizeOfflineData() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return
  }

  const queue = await getQueuedRequests()

  for (const item of queue) {
    try {
      if (item.action === 'INSERT') {
        await supabase.from(item.table).insert(item.payload)
      } else if (item.action === 'UPDATE') {
        const keyColumn = item.options?.keyColumn ?? 'id'
        const keyValue = item.options?.keyValue

        if (!keyValue) {
          throw new Error('Missing keyValue for offline UPDATE')
        }

        await supabase.from(item.table).update(item.payload).eq(keyColumn, keyValue)
      } else if (item.action === 'DELETE') {
        const keyColumn = item.options?.keyColumn ?? 'id'
        const keyValue = item.options?.keyValue

        if (!keyValue) {
          throw new Error('Missing keyValue for offline DELETE')
        }

        await supabase.from(item.table).delete().eq(keyColumn, keyValue)
      }

      if (item.id !== undefined) {
        await removeQueuedRequest(item.id)
      }
    } catch (error) {
      console.error('Offline sync failed for item', item, error)
      // On garde l'item en file si la requête échoue, pour une prochaine tentative.
    }
  }
}

export function initSyncListeners() {
  if (typeof window === 'undefined') {
    return
  }

  const syncNow = () => {
    void synchronizeOfflineData()
  }

  window.addEventListener('online', syncNow)

  if (navigator.onLine) {
    syncNow()
  }
}
