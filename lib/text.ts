const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/**
 * Feed summaries and Nasdaq event descriptions arrive as HTML fragments, some
 * of them double-escaped (`&lt;BR/&gt;`). Strip to plain text and clamp.
 */
export function clean(html: string, limit = 400): string {
  let out = html;
  // Undo one layer of double-escaping before tags are stripped.
  if (/&lt;\/?[a-z]/i.test(out)) {
    out = out.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  out = out
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (m: string, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  return out.length > limit ? `${out.slice(0, limit - 1).trimEnd()}…` : out;
}
