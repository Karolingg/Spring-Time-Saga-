import { supabase } from '@/src/config/supabase'

interface CacheEntry<T> {
  expiresAt: number
  hasValue?: boolean
  value?: T
  promise?: Promise<T>
}

export const READ_CACHE_TTL_MS = 60_000

export class ReadThroughCache {
  private entries = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string, loader: () => Promise<T>, ttlMs = READ_CACHE_TTL_MS): Promise<T> {
    const now = Date.now()
    const cached = this.entries.get(key) as CacheEntry<T> | undefined

    if (cached && cached.expiresAt > now) {
      if (cached.hasValue) return Promise.resolve(cached.value as T)
      if (cached.promise) return cached.promise
    }

    const promise = loader()
      .then((value) => {
        this.entries.set(key, {
          expiresAt: Date.now() + ttlMs,
          hasValue: true,
          value,
        })
        return value
      })
      .catch((error) => {
        this.entries.delete(key)
        throw error
      })

    this.entries.set(key, { expiresAt: now + ttlMs, promise })
    return promise
  }

  clear(key?: string) {
    if (key === undefined) {
      this.entries.clear()
      return
    }
    this.entries.delete(key)
  }

  clearPrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }
}

export async function getCurrentUserCacheKey(scope: string): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return `${scope}:user:${data.session?.user.id ?? 'anon'}`
}
