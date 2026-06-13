import { supabase } from '@/utils/supabase'
import { setLocalCache, getLocalCache } from '@/utils/offlineStorage'

export type PreloadConfig = {
  key: string
  query: () => Promise<any>
  cacheDuration?: number // en secondes
  priority?: 'high' | 'medium' | 'low' // high = immédiat, medium = après 1s, low = après 3s
}

class DataPreloader {
  private preloadQueue: PreloadConfig[] = []
  private isPreloading = false
  private preloadedKeys = new Set<string>()

  /**
   * Enregistre les données à précharger
   */
  registerPreload(configs: PreloadConfig[]) {
    this.preloadQueue.push(...configs)
  }

  /**
   * Démarre le préchargement en arrière-plan
   */
  async startPreloading() {
    if (this.isPreloading || typeof window === 'undefined') {
      return
    }

    if (!navigator.onLine) {
      console.log('[DataPreloader] Offline - skipping preload')
      return
    }

    this.isPreloading = true

    try {
      // Trier par priorité
      const highPriority = this.preloadQueue.filter((c) => c.priority === 'high' || !c.priority)
      const mediumPriority = this.preloadQueue.filter((c) => c.priority === 'medium')
      const lowPriority = this.preloadQueue.filter((c) => c.priority === 'low')

      // Précharger les données haute priorité immédiatement
      await this.preloadBatch(highPriority, 0)

      // Précharger les données moyenne priorité après 1s
      setTimeout(() => this.preloadBatch(mediumPriority, 1000), 1000)

      // Précharger les données basse priorité après 3s
      setTimeout(() => this.preloadBatch(lowPriority, 3000), 3000)

      console.log('[DataPreloader] Preloading started')
    } catch (error) {
      console.error('[DataPreloader] Error:', error)
    } finally {
      this.isPreloading = false
    }
  }

  /**
   * Précharge un lot de données
   */
  private async preloadBatch(configs: PreloadConfig[], delay: number) {
    if (configs.length === 0) return

    // Attendre le délai
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    // Précharger en parallèle (max 3 requêtes simultanées)
    const batchSize = 3
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize)

      await Promise.allSettled(
        batch.map(async (config) => {
          if (this.preloadedKeys.has(config.key)) {
            return // Déjà préchargé
          }

          try {
            // Vérifier si le cache est encore valide
            const cached = await getLocalCache(config.key)
            if (cached) {
              console.log(`[DataPreloader] Cache hit: ${config.key}`)
              this.preloadedKeys.add(config.key)
              return
            }

            // Récupérer les données
            const data = await config.query()

            // Mettre en cache
            await setLocalCache(config.key, data, {
              expiresIn: config.cacheDuration || 3600,
            })

            this.preloadedKeys.add(config.key)
            console.log(`[DataPreloader] Preloaded: ${config.key}`)
          } catch (error) {
            console.error(`[DataPreloader] Failed to preload ${config.key}:`, error)
          }
        })
      )
    }
  }

  /**
   * Réinitialise le préchargeur
   */
  reset() {
    this.preloadQueue = []
    this.preloadedKeys.clear()
    this.isPreloading = false
  }

  /**
   * Retourne les clés préchargées
   */
  getPreloadedKeys(): string[] {
    return Array.from(this.preloadedKeys)
  }
}

export const dataPreloader = new DataPreloader()

/**
 * Hook pour utiliser le préchargeur dans un composant
 */
export function useDataPreloader(configs: PreloadConfig[]) {
  if (typeof window === 'undefined') return

  // Enregistrer les configs
  dataPreloader.registerPreload(configs)

  // Démarrer le préchargement
  dataPreloader.startPreloading()
}

/**
 * Fonction pour précharger les données critiques de l'application
 */
export async function preloadCriticalAppData(selectedYearId?: string) {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return
  }

  const configs: PreloadConfig[] = [
    // Données haute priorité (chargées immédiatement)
    {
      key: `dashboard_stats:${selectedYearId}`,
      query: async () => {
        const [students, classes, teachers, payments, expenses] = await Promise.all([
          supabase
            .from('students')
            .select('id, first_name, last_name, scolarite_totale, scolarite_payee, class_id')
            .eq('academic_year_id', selectedYearId),
          supabase.from('classes').select('id, name').eq('academic_year_id', selectedYearId),
          supabase.from('teachers').select('id').eq('academic_year_id', selectedYearId),
          supabase
            .from('payments')
            .select('id, amount, created_at, student_id')
            .eq('academic_year_id', selectedYearId)
            .order('created_at', { ascending: false }),
          supabase.from('expenses').select('amount').eq('academic_year_id', selectedYearId),
        ])

        return { students, classes, teachers, payments, expenses }
      },
      cacheDuration: 3600,
      priority: 'high',
    },

    // Données moyenne priorité (chargées après 1s)
    {
      key: `students_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 3600,
      priority: 'medium',
    },

    {
      key: `classes_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('classes')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 3600,
      priority: 'medium',
    },

    {
      key: `teachers_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('teachers')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 3600,
      priority: 'medium',
    },

    // Données basse priorité (chargées après 3s)
    {
      key: `discipline_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('discipline')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 1800,
      priority: 'low',
    },

    {
      key: `payments_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 1800,
      priority: 'low',
    },

    {
      key: `grades_list:${selectedYearId}`,
      query: async () => {
        const { data } = await supabase
          .from('grades')
          .select('*')
          .eq('academic_year_id', selectedYearId)
        return data
      },
      cacheDuration: 3600,
      priority: 'low',
    },
  ]

  dataPreloader.registerPreload(configs)
  dataPreloader.startPreloading()
}
