"use client"

import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

export default function ConnectionStatus() {
  const { isOnline, isSyncing, queuedItems, failedItems, error, manualSync } = useOfflineStatus()

  if (isOnline && !queuedItems && !failedItems) {
    return null
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 border-b px-4 py-3 flex items-center justify-between gap-4 ${
        isOnline
          ? queuedItems > 0
            ? 'bg-blue-50 border-blue-200'
            : 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {!isOnline ? (
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
        ) : failedItems > 0 ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
        ) : (
          <Wifi className="w-5 h-5 text-emerald-600 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold ${
              !isOnline
                ? 'text-amber-900'
                : failedItems > 0
                  ? 'text-rose-900'
                  : 'text-blue-900'
            }`}
          >
            {!isOnline
              ? 'Mode hors-ligne'
              : isSyncing
                ? 'Synchronisation en cours...'
                : failedItems > 0
                  ? `${failedItems} élément(s) échoué(s)`
                  : queuedItems > 0
                    ? `${queuedItems} élément(s) en attente`
                    : 'Connecté'}
          </p>
          {!isOnline && (
            <p className="text-xs text-amber-700">
              Les modifications seront synchronisées dès le retour de la connexion
            </p>
          )}
          {failedItems > 0 && (
            <p className="text-xs text-rose-700">
              Cliquez sur Réessayer pour synchroniser les éléments échoués
            </p>
          )}
        </div>
      </div>

      {failedItems > 0 && (
        <button
          onClick={manualSync}
          disabled={isSyncing}
          className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg active:scale-95 transition-all"
        >
          {isSyncing ? 'Sync...' : 'Réessayer'}
        </button>
      )}
    </div>
  )
}
