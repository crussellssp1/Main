type Entry<T> = { value: T; expires: number; storedAt: number };

const store = new Map<string, Entry<unknown>>();

/**
 * Fetch-through cache with stale fallback. Upstream sources here are free and
 * unauthenticated, so they rate-limit and occasionally 403. Serving the last
 * good payload beats blanking a panel.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<{ value: T; stale: boolean; storedAt: number }> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && hit.expires > now) {
    return { value: hit.value, stale: false, storedAt: hit.storedAt };
  }
  try {
    const value = await loader();
    store.set(key, { value, expires: now + ttlMs, storedAt: now });
    return { value, stale: false, storedAt: now };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true, storedAt: hit.storedAt };
    throw err;
  }
}

/** Store a value directly, for mirroring batch results per item. */
export function put<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  store.set(key, { value, expires: now + ttlMs, storedAt: now });
}

/** Last known value regardless of age. */
export function peek<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

/** True when a key holds a value that has not passed its TTL. */
export function isFresh(key: string): boolean {
  const hit = store.get(key);
  return hit !== undefined && hit.expires > Date.now();
}
