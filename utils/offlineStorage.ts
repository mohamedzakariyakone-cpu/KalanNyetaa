import { openDB } from 'idb'

export const DB_NAME = 'KalanNyetaaOfflineDB'
export const DB_VERSION = 2 // Augmenté pour la migration
export const CACHE_STORE = 'cache_store'
export const SYNC_QUEUE = 'sync_queue'
export const METADATA_STORE = 'metadata_store'

export type OfflineQueueAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'

export type OfflineQueueItem = {
  id?: number
  table: string
  action: OfflineQueueAction
  payload: any
  options?: {
    keyColumn?: string
    keyValue?: string | number
  }
  createdAt: number
  retryCount?: number
  lastError?: string
}

export type CacheMetadata = {
  key: string
  expiresAt?: number
  lastUpdated: number
  source: 'online' | 'offline'
}

let dbPromise: Promise<any | null> | null = null

function getDbPromise() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Créer les object stores
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
          db.createObjectStore(SYNC_QUEUE, { keyPath: 'id', autoIncrement: true })
        }

        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' })
        }

        // Migration depuis v1
        if (oldVersion < 2) {
          // Les données existantes sont conservées
          console.log('Database migrated from v1 to v2')
        }
      },
    })
  }

  return dbPromise
}

export async function setLocalCache(
  key: string,
  value: unknown,
  options?: { expiresIn?: number }
) {
  const db = await getDbPromise()
  if (!db) return

  const expiresAt = options?.expiresIn
    ? Date.now() + options.expiresIn * 1000
    : undefined

  await db.put(CACHE_STORE, {
    key,
    value,
    updatedAt: Date.now(),
  })

  // Stocker les métadonnées
  await db.put(METADATA_STORE, {
    key,
    expiresAt,
    lastUpdated: Date.now(),
    source: navigator.onLine ? 'online' : 'offline',
  })
}

export async function getLocalCache<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDbPromise()
  if (!db) return undefined

  const entry = (await db.get(CACHE_STORE, key as IDBValidKey)) as
    | { key: string; value: T; updatedAt: number }
    | undefined

  if (!entry) return undefined

  // Vérifier l'expiration
  const metadata = (await db.get(METADATA_STORE, key as IDBValidKey)) as CacheMetadata | undefined
  if (metadata?.expiresAt && metadata.expiresAt < Date.now()) {
    // Cache expiré, le supprimer
    await removeLocalCache(key)
    return undefined
  }

  return entry.value
}

export async function removeLocalCache(key: string) {
  const db = await getDbPromise()
  if (!db) return
  await db.delete(CACHE_STORE, key)
  await db.delete(METADATA_STORE, key)
}

export async function clearAllCache() {
  const db = await getDbPromise()
  if (!db) return
  await db.clear(CACHE_STORE)
  await db.clear(METADATA_STORE)
}

export async function getCacheMetadata(key: string): Promise<CacheMetadata | undefined> {
  const db = await getDbPromise()
  if (!db) return undefined
  return (await db.get(METADATA_STORE, key as IDBValidKey)) as CacheMetadata | undefined
}

export async function queueOfflineRequest(
  item: Omit<OfflineQueueItem, 'createdAt' | 'retryCount' | 'lastError'>
) {
  const db = await getDbPromise()
  if (!db) return

  await db.add(SYNC_QUEUE, {
    ...item,
    createdAt: Date.now(),
    retryCount: 0,
    lastError: undefined,
  })
}

export async function getQueuedRequests(): Promise<OfflineQueueItem[]> {
  const db = await getDbPromise()
  if (!db) return []
  return (await db.getAll(SYNC_QUEUE)) as Promise<OfflineQueueItem[]>
}

export async function removeQueuedRequest(id: number) {
  const db = await getDbPromise()
  if (!db) return
  await db.delete(SYNC_QUEUE, id)
}

export async function updateQueuedRequest(
  id: number,
  updates: Partial<OfflineQueueItem>
) {
  const db = await getDbPromise()
  if (!db) return

  const item = (await db.get(SYNC_QUEUE, id)) as OfflineQueueItem | undefined
  if (!item) return

  await db.put(SYNC_QUEUE, {
    ...item,
    ...updates,
    id, // Garder l'ID original
  })
}

export async function clearSyncQueue() {
  const db = await getDbPromise()
  if (!db) return
  await db.clear(SYNC_QUEUE)
}

export async function getQueueStats() {
  const db = await getDbPromise()
  if (!db) return { total: 0, pending: 0, failed: 0 }

  // Correction du typage ici : Ajout explicite du type sur le retour de getAll
  const queue: OfflineQueueItem[] = await db.getAll(SYNC_QUEUE)
  const total = queue.length
  const failed = queue.filter(item => (item.retryCount ?? 0) > 0).length

  return {
    total,
    pending: total - failed,
    failed,
  }
}