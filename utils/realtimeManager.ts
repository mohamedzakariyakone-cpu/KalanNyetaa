import { supabase } from '@/utils/supabase'
import { getCacheInvalidationManager } from '@/utils/cacheInvalidation'

const tableInvalidationPatterns: Record<string, string[]> = {
  students: ['^students', '^student:'],
  classes: ['^classes', '^class:'],
  teachers: ['^teachers', '^teacher:'],
  payments: ['^payments', '^payment:'],
  extra_payments: ['^extra_payments', '^extra_payment:'],
  discipline_incidents: ['^discipline', '^discipline:'],
  student_grades: ['^student_grades', '^student_grade:'],
  class_subjects: ['^class_subjects', '^class_subject:'],
  student_payments: ['^student_payments', '^student_payment:'],
  expenses: ['^expenses', '^expense:'],
  profiles: ['^profiles', '^profile:'],
  schools: ['^schools', '^school:'],
  academic_years: ['^academic_years', '^academic_year:'],
  school_settings: ['^school_settings', '^school_setting:'],
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
let initialized = false

export function initRealtimeSync() {
  if (typeof window === 'undefined') return
  if (initialized) return
  if (!supabase?.channel) return

  const manager = getCacheInvalidationManager()
  const channel = supabase.channel('realtime-sync-channel')

  Object.keys(tableInvalidationPatterns).forEach((table) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: unknown) => {
        const patterns = tableInvalidationPatterns[table]
        if (patterns) {
          patterns.forEach((pattern) => {
            manager.invalidatePattern(pattern, `realtime:${table}`)
          })
        } else {
          manager.invalidatePattern(`^${table}(?:[:_]|$)`, `realtime:${table}`)
        }
      }
    )
  })

  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.debug('[RealtimeSync] Supabase realtime channel subscribed')
    }
    if (status === 'CHANNEL_ERROR') {
      console.error('[RealtimeSync] Supabase realtime channel error')
    }
  })

  realtimeChannel = channel
  initialized = true
}
