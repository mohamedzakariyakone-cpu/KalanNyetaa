"use client"

import { useEffect, useState } from 'react'
import { initSyncListeners, registerBackgroundSync, setSyncStatusCallback, forceSyncNow } from '@/utils/syncManager'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export default function OfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState<string>('')
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialiser le statut online
    setIsOnline(navigator.onLine)

    // La Background Sync sera enregistrée quand le Service Worker sera prêt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        registerBackgroundSync()
      })
    }

    // Initialiser les listeners de sync
    initSyncListeners()

    // Configurer le callback de statut de sync
    setSyncStatusCallback((status, message) => {
      setSyncStatus(status)
      setSyncMessage(message || '')
      setShowIndicator(true)

      // Masquer l'indicateur après 3 secondes si succès
      if (status === 'success') {
        setTimeout(() => setShowIndicator(false), 3000)
      }
    })

    // Écouter les changements de connectivité
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('syncing')
      setSyncMessage('Reconnecté, synchronisation en cours...')
      setShowIndicator(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('idle')
      setSyncMessage('Mode hors-ligne')
      setShowIndicator(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleManualSync = async () => {
    setSyncStatus('syncing')
    setSyncMessage('Synchronisation manuelle...')
    setShowIndicator(true)

    const result = await forceSyncNow()
    if (result.success) {
      setSyncStatus('success')
      setSyncMessage(`${result.synced} élément(s) synchronisé(s)`)
    } else if (result.failed > 0) {
      setSyncStatus('error')
      setSyncMessage(`${result.failed} élément(s) échoué(s)`)
    }
  }

  return (
    <>
      {/* Indicateur de connectivité en haut de la page */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Mode hors-ligne</p>
            <p className="text-xs text-amber-700">
              Les modifications seront synchronisées dès le retour de la connexion
            </p>
          </div>
        </div>
      )}

      {/* Indicateur de synchronisation */}
      {showIndicator && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl shadow-lg border px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            syncStatus === 'syncing'
              ? 'bg-blue-50 border-blue-200'
              : syncStatus === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : syncStatus === 'error'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
          }`}
        >
          {syncStatus === 'syncing' ? (
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          ) : syncStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : syncStatus === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Wifi className="w-5 h-5 text-slate-600 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-bold truncate ${
                syncStatus === 'syncing'
                  ? 'text-blue-900'
                  : syncStatus === 'success'
                    ? 'text-emerald-900'
                    : syncStatus === 'error'
                      ? 'text-rose-900'
                      : 'text-slate-900'
              }`}
            >
              {syncStatus === 'syncing'
                ? 'Synchronisation...'
                : syncStatus === 'success'
                  ? 'Synchronisé'
                  : syncStatus === 'error'
                    ? 'Erreur de sync'
                    : syncMessage || 'Connecté'}
            </p>
            {syncMessage && syncStatus !== 'idle' && (
              <p
                className={`text-xs truncate ${
                  syncStatus === 'syncing'
                    ? 'text-blue-700'
                    : syncStatus === 'success'
                      ? 'text-emerald-700'
                      : syncStatus === 'error'
                        ? 'text-rose-700'
                        : 'text-slate-600'
                }`}
              >
                {syncMessage}
              </p>
            )}
          </div>

          {syncStatus === 'error' && (
            <button
              onClick={handleManualSync}
              className="shrink-0 ml-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg active:scale-95 transition-all"
            >
              Réessayer
            </button>
          )}
        </div>
      )}
    </>
  )
}
