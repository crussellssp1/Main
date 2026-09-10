import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { cached } from "@/lib/cache";
import { get, settle } from "@/lib/http";
import { NEWS_SOURCES } from "@/lib/sources";
import { clean } from "@/lib/text";
import type { ApiEnvelope, NewsItem, NewsSource } from "@/lib/types";

export const dynamic = "force-dynamic";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  removeNSPrefix: true,
  textNodeName: "#text",
});

const asArray = <T,>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/** Feed containers hold either one entry object or an array of them. */
const asRows = (v: unknown): Record<string, unknown>[] => {
  if (Array.isArray(v)) return v.filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null);
  return typeof v === "object" && v !== null ? [v as Record<string, unknown>] : [];
};

/** RSS/Atom nodes are string | {#text} | {@href} depending on publisher. */
function text(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o["#text"] === "string") return o["#text"];
    if (typeof o["#text"] === "number") return String(o["#text"]);
    if (typeof o["@href"] === "string") return o["@href"];
  }
  return "";
}

function link(entry: Record<string, unknown>): string {
  const direct = text(entry.link);
  if (direct.startsWith("http")) return direct;
  // Atom: <link rel="alternate" href="..."/>, possibly several.
  for (const l of asArray(entry.link as unknown)) {
    const o = l as Record<string, unknown>;
    const href = typeof o?.["@href"] === "string" ? o["@href"] : "";
    if (href.startsWith("http") && (o["@rel"] ?? "alternate") === "alternate") return href;
  }
  const guid = text(entry.guid) || text(entry.id);
  return guid.startsWith("http") ? guid : "";
}

function parseDate(entry: Record<string, unknown>): number | null {
  for (const key of ["pubDate", "published", "updated", "date", "modified"]) {
    const raw = text(entry[key]);
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

const TICKER_RE = /\((?:NYSE|NASDAQ|NYSEARCA|AMEX|OTC|LSE|TSX)[:\s]+\s*([A-Z.\-]{1,6})\)/g;
const CASHTAG_RE = /(?:^|\s)\$([A-Z]{1,5})(?=\s|$|[.,)])/g;

function extractTickers(...parts: string[]): string[] {
  const found = new Set<string>();
  const hay = parts.join(" ");
  for (const m of hay.matchAll(TICKER_RE)) found.add(m[1]);
  for (const m of hay.matchAll(CASHTAG_RE)) found.add(m[1]);
  return Array.from(found).slice(0, 6);
}

function itemsFrom(doc: Record<string, unknown>): Record<string, unknown>[] {
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel) return asRows(channel.item);

  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed) return asRows(feed.entry);

  // RDF (ECB and other older government feeds).
  const rdf = doc.RDF as Record<string, unknown> | undefined;
  if (rdf) return asRows(rdf.item);

  return asRows(doc.item);
}

async function loadSource(src: NewsSource): Promise<NewsItem[]> {
  const xml = await get(src.url, {
    timeoutMs: 12_000,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  });
  if (!/^\s*<(\?xml|rss|feed|rdf)/i.test(xml)) {
    throw new Error("response was not a feed");
  }
  const doc = parser.parse(xml) as Record<string, unknown>;

  return itemsFrom(doc)
    .map((entry, idx) => {
      const title = clean(text(entry.title), 300);
      const url = link(entry);
      if (!title || !url) return null;
      const summary = clean(
        text(entry.description) || text(entry.summary) || text(entry.content) || "",
        360
      );
      const item: NewsItem = {
        id: `${src.id}:${url || idx}`,
        source: src.label,
        category: src.category,
        title,
        url,
        summary,
        published: parseDate(entry),
        tickers: extractTickers(title, summary),
      };
      return item;
    })
    .filter((v): v is NewsItem => v !== null);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const requested = (p.get("sources") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.min(Number(p.get("limit") ?? 220) || 220, 500);

  const active = requested.length
    ? NEWS_SOURCES.filter((s) => requested.includes(s.id))
    : NEWS_SOURCES.filter((s) => s.enabledByDefault);

  const results = await settle(
    active.map((src) => ({
      key: src.id,
      run: async () => (await cached(`news:${src.id}`, 60_000, () => loadSource(src))).value,
    }))
  );

  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const r of results) {
    for (const item of r.value ?? []) {
      // Wires syndicate the same story; collapse on normalised headline.
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  items.sort((a, b) => (b.published ?? 0) - (a.published ?? 0));

  const body: ApiEnvelope<NewsItem[]> = {
    ok: items.length > 0,
    data: items.slice(0, limit),
    fetchedAt: Date.now(),
    warnings: results
      .filter((r) => r.error)
      .map((r) => `${r.key}: ${r.error}`),
  };
  return NextResponse.json(body);
}
