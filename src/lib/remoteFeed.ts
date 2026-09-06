import { normalizeFeedUrl, parseFeedText } from "./feedImport";
import type { FeedRow } from "./facebook";

export const MAX_FEED_BYTES = 8_000_000;
const MAX_REDIRECTS = 5;

export class RemoteFeedError extends Error {
  constructor(message: string, public readonly status: 400 | 413 | 502 | 504 = 502) {
    super(message);
    this.name = "RemoteFeedError";
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RemoteFeedError(`Feed is too large (maximum ${Math.round(maxBytes / 1_000_000)}MB)`, 413);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RemoteFeedError(`Feed is too large (maximum ${Math.round(maxBytes / 1_000_000)}MB)`, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export type ImportedRemoteFeed = {
  url: string;
  contentType: string;
  rows: FeedRow[];
  format: "csv" | "xml";
};

export async function importRemoteFeed(rawUrl: string, limit = Number.POSITIVE_INFINITY): Promise<ImportedRemoteFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let currentUrl = normalizeFeedUrl(rawUrl);

  try {
    let response: Response | null = null;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "CatalogForge/1.0 (+https://catalog-forge)",
          Accept: "text/csv,application/xml,text/xml,application/rss+xml,application/atom+xml,text/plain,*/*",
        },
        redirect: "manual",
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirects === MAX_REDIRECTS) throw new RemoteFeedError("Feed redirected too many times");
      const location = response.headers.get("location");
      if (!location) throw new RemoteFeedError("Feed redirect was missing a destination");
      currentUrl = normalizeFeedUrl(new URL(location, currentUrl).toString());
    }

    if (!response?.ok) {
      throw new RemoteFeedError(`Feed returned ${response?.status ?? 502} ${response?.statusText ?? ""}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    const text = await readBoundedText(response, MAX_FEED_BYTES);
    if (!text || text.length < 10) throw new RemoteFeedError("Feed is empty");
    const host = new URL(currentUrl).hostname.replace(/^www\./, "");
    const parsed = parseFeedText(text, contentType, host, limit);
    return { url: currentUrl, contentType, ...parsed };
  } catch (error) {
    if (error instanceof RemoteFeedError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/abort/i.test(message)) throw new RemoteFeedError("Feed fetch timed out (15s)", 504);
    throw new RemoteFeedError(`Couldn't fetch feed: ${message.slice(0, 200)}`);
  } finally {
    clearTimeout(timeout);
  }
}
