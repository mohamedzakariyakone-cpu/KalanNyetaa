'use client'

import { useEffect } from 'react'
import { initRealtimeSync } from '@/utils/realtimeManager'

export default function RealtimeSyncInit() {
  useEffect(() => {
    initRealtimeSync()
  }, [])

  return null
}
