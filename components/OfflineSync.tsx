"use client"

import { useEffect } from 'react'
import { initSyncListeners } from '@/utils/syncManager'

export default function OfflineSync() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initSyncListeners()

      if ('serviceWorker' in navigator && window.serwist !== undefined) {
        window.serwist.register()
      }
    }
  }, [])

  return null
}
