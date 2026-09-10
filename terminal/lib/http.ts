const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} from ${new URL(url).host}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Plain-text/JSON GET with a browser UA and timeout.
 *
 * Retries on 5xx and on 429. The free quote upstream rate-limits by IP, so a
 * 429 is backed off (honouring Retry-After when present) rather than treated
 * as fatal: the caller's cache would otherwise go empty for a whole cycle.
 */
export async function get(
  url: string,
  opts: { timeoutMs?: number; accept?: string; retries?: number } = {}
): Promise<string> {
  const { timeoutMs = 12_000, accept = "*/*", retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        redirect: "follow",
        cache: "no-store",
        headers: {
          "user-agent": UA,
          accept,
          "accept-language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        if (!retryable || attempt === retries) throw new HttpError(res.status, url);
        lastErr = new HttpError(res.status, url);
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8_000)
          : 700 * (attempt + 1);
        await sleep(waitMs);
        continue;
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Run tasks with bounded concurrency. Firing 30-plus symbol lookups at once is
 * the fastest way to earn a 429 from a keyless endpoint.
 */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await worker(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export async function getJson<T>(url: string, opts?: Parameters<typeof get>[1]): Promise<T> {
  return JSON.parse(await get(url, { accept: "application/json", ...opts })) as T;
}

/** Resolve many loaders without letting one bad source fail the panel. */
export async function settle<T>(
  tasks: { key: string; run: () => Promise<T> }[]
): Promise<{ key: string; value?: T; error?: string }[]> {
  const results = await Promise.allSettled(tasks.map((t) => t.run()));
  return results.map((r, i) => ({
    key: tasks[i].key,
    value: r.status === "fulfilled" ? r.value : undefined,
    error: r.status === "rejected" ? String(r.reason?.message ?? r.reason) : undefined,
  }));
}
