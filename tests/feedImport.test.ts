import { afterEach, describe, expect, it, vi } from "vitest";
import { FEED_PREVIEW_LIMIT, normalizePrice, parseFeedCsv } from "@/lib/feedImport";
import { importRemoteFeed, MAX_FEED_BYTES } from "@/lib/remoteFeed";

afterEach(() => vi.unstubAllGlobals());

describe("full catalog imports", () => {
  it("parses quoted newlines, escaped quotes, and European decimal prices", () => {
    const csv = [
      "id,title,description,price,link,image_link,brand,sale_price",
      '1,"Tea, green","First line\nSecond ""quoted"" line","17,90 EUR",https://shop.example/tea,https://img.example/tea.jpg,Leaf,"15,50 EUR"',
    ].join("\n");
    const [row] = parseFeedCsv(csv);
    expect(row).toMatchObject({
      id: "1",
      source_id: "csv:row:1",
      title: "Tea, green",
      description: 'First line\nSecond "quoted" line',
      price: "17.90 EUR",
      sale_price: "15.50 EUR",
    });
    expect(normalizePrice("1.234,56 EUR")).toBe("1234.56 EUR");
    expect(normalizePrice("1,234.56 USD")).toBe("1234.56 USD");
    expect(normalizePrice("USD 19.95")).toBe("19.95 USD");
    expect(normalizePrice("19.95")).toBe("19.95");
  });

  it("reports an unterminated quoted field instead of shifting columns", () => {
    expect(() => parseFeedCsv('id,title,price\n1,"Broken title,10 EUR')).toThrow("unterminated quoted field");
  });

  it("keeps the full import while allowing an explicit preview limit", () => {
    const rows = Array.from({ length: 250 }, (_, i) => `${i + 1},Product ${i + 1},10.00 EUR`).join("\n");
    const csv = `id,title,price\n${rows}`;
    expect(parseFeedCsv(csv)).toHaveLength(250);
    expect(parseFeedCsv(csv, "csv", FEED_PREVIEW_LIMIT)).toHaveLength(200);
  });

  it("revalidates redirect destinations before fetching them", async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/private.csv" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(importRemoteFeed("https://feeds.example/catalog.csv")).rejects.toThrow("blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects declared oversized feeds before buffering the body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("small", {
      headers: { "Content-Length": String(MAX_FEED_BYTES + 1), "Content-Type": "text/csv" },
    })));
    await expect(importRemoteFeed("https://feeds.example/catalog.csv")).rejects.toMatchObject({ status: 413 });
  });
});
