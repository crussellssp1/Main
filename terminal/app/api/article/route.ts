import { NextRequest, NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { cached } from "@/lib/cache";
import { get } from "@/lib/http";
import { clean } from "@/lib/text";
import type { ApiEnvelope, Article } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_PARAGRAPHS = 120;

async function extract(url: string): Promise<Article> {
  const html = await get(url, {
    timeoutMs: 20_000,
    accept: "text/html,application/xhtml+xml",
  });

  // Publisher pages are full of broken CSS and scripts jsdom will complain
  // about; silence it rather than letting noise reach the server log.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole });
  const doc = dom.window.document;

  const meta = (name: string): string | null =>
    doc
      .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute("content") ?? null;

  const parsed = new Readability(doc, { charThreshold: 250 }).parse();

  const paragraphsFrom = (fragment: string): string[] =>
    fragment
      .split(/<\/(?:p|h1|h2|h3|h4|li|blockquote)>/i)
      .map((chunk) => clean(chunk, 4_000))
      .filter((t) => t.length > 40);

  let paragraphs = parsed?.content ? paragraphsFrom(parsed.content) : [];

  // Readability gives up on some app-shell pages; fall back to raw <p> tags.
  if (paragraphs.length < 2) {
    paragraphs = Array.from(doc.querySelectorAll("article p, main p, p"))
      .map((el) => clean(el.textContent ?? "", 4_000))
      .filter((t) => t.length > 60);
  }

  const seen = new Set<string>();
  paragraphs = paragraphs.filter((t) => {
    const key = t.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const truncated = paragraphs.length > MAX_PARAGRAPHS;
  paragraphs = paragraphs.slice(0, MAX_PARAGRAPHS);

  const words = paragraphs.reduce((n, p) => n + p.split(/\s+/).length, 0);

  return {
    url,
    title: parsed?.title ? clean(parsed.title, 300) : meta("og:title"),
    byline: parsed?.byline ? clean(parsed.byline, 160) : meta("author"),
    siteName: parsed?.siteName ?? meta("og:site_name") ?? new URL(url).host,
    publishedTime:
      meta("article:published_time") ??
      meta("datePublished") ??
      meta("og:updated_time"),
    excerpt: parsed?.excerpt ? clean(parsed.excerpt, 400) : meta("og:description"),
    readingTimeMin: words ? Math.max(1, Math.round(words / 230)) : null,
    paragraphs,
    truncated,
  };
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url") ?? "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(target);
  } catch {
    return NextResponse.json(
      { ok: false, data: null, fetchedAt: Date.now(), warnings: ["invalid url"] },
      { status: 400 }
    );
  }
  // Only fetch public web pages: no file://, no loopback, no LAN addresses.
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return NextResponse.json(
      { ok: false, data: null, fetchedAt: Date.now(), warnings: ["unsupported scheme"] },
      { status: 400 }
    );
  }
  if (
    /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|\[?::1)/i.test(parsedUrl.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(parsedUrl.hostname)
  ) {
    return NextResponse.json(
      { ok: false, data: null, fetchedAt: Date.now(), warnings: ["blocked host"] },
      { status: 400 }
    );
  }

  try {
    const { value } = await cached(`article:${parsedUrl.toString()}`, 1_800_000, () =>
      extract(parsedUrl.toString())
    );
    const body: ApiEnvelope<Article> = { ok: true, data: value, fetchedAt: Date.now() };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        data: {
          url: parsedUrl.toString(),
          title: null,
          byline: null,
          siteName: parsedUrl.host,
          publishedTime: null,
          excerpt: null,
          readingTimeMin: null,
          paragraphs: [],
          truncated: false,
          error: message,
        },
        fetchedAt: Date.now(),
        warnings: [message],
      },
      { status: 200 }
    );
  }
}
