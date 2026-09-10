import { NextResponse } from "next/server";
import type { ApiEnvelope } from "./types";

/**
 * Wrap an API envelope with CDN cache headers.
 *
 * Locally the in-memory TTL cache in lib/cache.ts does the work. Deployed to a
 * serverless host it cannot: each request may land on a cold instance with an
 * empty map, so a busy terminal would hammer the keyless upstreams and earn a
 * rate limit. `s-maxage` moves that caching to the CDN, where one upstream
 * fetch fans out to every viewer and every open tab.
 *
 * `stale-while-revalidate` lets the CDN serve the previous payload while it
 * refreshes in the background, so a slow upstream never blocks a panel.
 */
export function envelope<T>(
  body: ApiEnvelope<T>,
  opts: { sMaxAge: number; swr?: number; status?: number }
): NextResponse {
  const { sMaxAge, swr = Math.max(sMaxAge * 4, 60), status = 200 } = opts;
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
      // Panels read these to explain a degraded footer without parsing JSON.
      "x-terminal-fetched-at": String(body.fetchedAt),
    },
  });
}

/** Cache windows per feed, in seconds. */
export const TTL = {
  quote: 15,
  chart: 60,
  news: 60,
  rates: 300,
  calendar: 600,
  article: 3600,
} as const;
