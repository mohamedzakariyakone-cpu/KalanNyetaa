import { useEffect, useState, useCallback } from 'react'
import { getQueueStats } from '@/utils/offlineStorage'
import { forceSyncNow } from '@/utils/syncManager'

export type OfflineStatus = {
  isOnline: boolean
  isSyncing: boolean
  queuedItems: number
  failedItems: number
  lastSyncTime?: number
  error?: string
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: true,
    isSyncing: false,
    queuedItems: 0,
    failedItems: 0,
  })

  const updateQueueStats = useCallback(async () => {
    const stats = await getQueueStats()
    setStatus((prev) => ({
      ...prev,
      queuedItems: stats.pending,
      failedItems: stats.failed,
    }))
  }, [])

  const manualSync = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isSyncing: true }))
    try {
      const result = await forceSyncNow()
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        error: result.success ? undefined : result.message,
      }))
      await updateQueueStats()
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }))
    }
  }, [updateQueueStats])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialiser le statut
    setStatus((prev) => ({
      ...prev,
      isOnline: navigator.onLine,
    }))
    updateQueueStats()

    // Écouter les changements de connectivité
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        isSyncing: true,
      }))
      // Synchroniser après 500ms
      setTimeout(manualSync, 500)
    }

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isSyncing: false,
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Mettre à jour les stats toutes les 5 secondes
    const interval = setInterval(updateQueueStats, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [updateQueueStats, manualSync])

  return { ...status, manualSync }
}
