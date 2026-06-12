import { openDB } from 'idb'

export const DB_NAME = 'KalanNyetaaOfflineDB'
export const DB_VERSION = 1
export const CACHE_STORE = 'cache_store'
export const SYNC_QUEUE = 'sync_queue'

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
}

let dbPromise: Promise<any | null> | null = null

function getDbPromise() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
          db.createObjectStore(SYNC_QUEUE, { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }

  return dbPromise
}

export async function setLocalCache(key: string, value: unknown) {
  const db = await getDbPromise()
  if (!db) return
  await db.put(CACHE_STORE, {
    key,
    value,
    updatedAt: Date.now(),
  })
}

export async function getLocalCache<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDbPromise()
  if (!db) return undefined
  const entry = (await db.get(CACHE_STORE, key as IDBValidKey)) as { key: string; value: T } | undefined
  return entry?.value
}

export async function queueOfflineRequest(item: Omit<OfflineQueueItem, 'createdAt'>) {
  const db = await getDbPromise()
  if (!db) return
  await db.add(SYNC_QUEUE, {
    ...item,
    createdAt: Date.now(),
  })
}

export async function getQueuedRequests(): Promise<OfflineQueueItem[]> {
  const db = await getDbPromise()
  if (!db) return []
  return db.getAll(SYNC_QUEUE) as Promise<OfflineQueueItem[]>
}

export async function removeQueuedRequest(id: number) {
  const db = await getDbPromise()
  if (!db) return
  await db.delete(SYNC_QUEUE, id)
}
