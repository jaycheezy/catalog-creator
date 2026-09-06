import type { FeedRow } from "./facebook";

export const FEED_PREVIEW_LIMIT = 200;

/** Basic SSRF guard for server-side feed fetching (not a sandbox — defense in depth). */
export function isBlockedFeedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return true;
  if (h === "localhost" || h === "metadata.google.internal") return true;
  if (h === "169.254.169.254") return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^127\./.test(h) || h === "::1" || h === "[::1]") return true;
  if (/^(10|192\.168)\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

export function normalizeFeedUrl(input: string): string {
  const s = input.trim();
  if (!s) throw new Error("Empty feed URL");
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  const url = new URL(withProto);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Feed URL must be http(s)");
  if (url.username || url.password) throw new Error("Feed URLs with embedded credentials are not supported");
  if (isBlockedFeedHost(url.hostname)) throw new Error("That host is blocked for server-side fetching — upload the CSV instead");
  return url.toString();
}

// ---------- CSV ----------

function splitDelimitedRecords(text: string, delimiter: "," | "\t"): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    record.push(field.trim());
    field = "";
  };
  const pushRecord = () => {
    pushField();
    if (record.some((value) => value.length > 0)) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.trim().length === 0) {
      field = "";
      inQuotes = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      pushRecord();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (inQuotes) throw new Error("CSV has an unterminated quoted field");
  if (field.length > 0 || record.length > 0) pushRecord();
  return records;
}

function pick(row: Record<string, string>, names: string[]): string {
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().replace(/[\s_-]+/g, "") === n) return row[k] ?? "";
    }
  }
  return "";
}

export function parseFeedCsv(text: string, sourceLabel = "csv", limit = Number.POSITIVE_INFINITY): FeedRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const records = splitDelimitedRecords(clean, delimiter);
  if (records.length < 2) throw new Error("CSV has no data rows (need a header + at least 1 product)");
  const headers = records[0];
  if (!headers.some((header) => ["title", "name", "producttitle"].includes(header.toLowerCase().replace(/[\s_-]+/g, "")))) {
    throw new Error("CSV needs a title column (supported headers: title, name, product_title)");
  }
  const rows: FeedRow[] = [];
  for (const cells of records.slice(1)) {
    if (rows.length >= limit) break;
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = cells[i] ?? ""; });
    const id = pick(rec, ["id", "sku", "variantid", "itemid"]);
    const title = pick(rec, ["title", "name", "producttitle"]);
    const rawAvailability = pick(rec, ["availability", "stock", "inventory"]).toLowerCase();
    const availability: FeedRow["availability"] = /out/.test(rawAvailability)
      ? "out of stock"
      : /in.?stock|available/.test(rawAvailability)
        ? "in stock"
        : "";
    const rawCondition = pick(rec, ["condition"]).toLowerCase();
    const condition: FeedRow["condition"] = ["new", "used", "refurbished"].includes(rawCondition)
      ? rawCondition as FeedRow["condition"]
      : "";
    const regularPrice = normalizePrice(pick(rec, ["price", "amount"]));
    const salePrice = normalizePrice(pick(rec, ["saleprice"]));
    rows.push({
      id: id.slice(0, 100),
      source_id: `csv:row:${rows.length + 1}`,
      title: title.slice(0, 150),
      description: pick(rec, ["description", "bodyhtml", "desc"]).slice(0, 5000),
      availability,
      condition,
      price: regularPrice || salePrice,
      link: pick(rec, ["link", "url", "producturl", "handle"]),
      image_link: pick(rec, ["imagelink", "image", "imagesrc", "src"]),
      brand: pick(rec, ["brand", "vendor", "manufacturer"]).slice(0, 70),
      additional_image_link: pick(rec, ["additionalimagelink", "additionalimages"]),
      item_group_id: pick(rec, ["itemgroupid", "groupid", "parentid"]),
      google_product_category: pick(rec, ["googleproductcategory", "category"]),
      sale_price: regularPrice ? salePrice : "",
      inventory: "",
    });
  }
  if (rows.length === 0) throw new Error("CSV has no data rows");
  void sourceLabel;
  return rows;
}

export function normalizePrice(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const compact = s.replace(/[\s\u00a0]/g, "");
  const suffix = compact.match(/^(-?[\d.,]+)([A-Za-z]{3})?$/);
  const prefix = compact.match(/^([A-Za-z]{3})(-?[\d.,]+)$/);
  if (!suffix && !prefix) return s.slice(0, 30);
  let amount = suffix?.[1] ?? prefix![2];
  const currency = suffix?.[2] ?? prefix?.[1] ?? "";
  const lastComma = amount.lastIndexOf(",");
  const lastDot = amount.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    amount = decimal === ","
      ? amount.replace(/\./g, "").replace(",", ".")
      : amount.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = amount.length - lastComma - 1;
    amount = decimals > 0 && decimals <= 2 ? amount.replace(",", ".") : amount.replace(/,/g, "");
  }
  const num = Number.parseFloat(amount);
  if (isNaN(num)) return s.slice(0, 30);
  const cur = currency.toUpperCase();
  return `${num.toFixed(2)}${cur ? ` ${cur}` : ""}`;
}

// ---------- XML (Google Shopping RSS / sitemap-ish product feeds) ----------

function tagInner(xml: string, names: string[]): string {
  for (const n of names) {
    // matches <g:title>, <title>, <g:image_link>, namespaced or not, CDATA-aware
    const re = new RegExp(`<(?:\\w+:)?${n}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${n}>`, "i");
    const m = xml.match(re);
    if (m) {
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

export function parseFeedXml(text: string, sourceLabel = "feed", limit = Number.POSITIVE_INFINITY): FeedRow[] {
  // Split on <item> (RSS) or <entry> (Atom). Content feeds use these ~always.
  const blocks = text.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi);
  if (!blocks || blocks.length === 0) throw new Error("No <item>/<entry> products found in this XML feed");
  const rows: FeedRow[] = [];
  for (const b of blocks.slice(0, limit)) {
    const title = tagInner(b, ["title"]);
    const rawAvailability = tagInner(b, ["availability"]).toLowerCase();
    const availability: FeedRow["availability"] = /out.?of.?stock|unavailable/.test(rawAvailability)
      ? "out of stock"
      : /in.?stock|available/.test(rawAvailability)
        ? "in stock"
        : "";
    const rawCondition = tagInner(b, ["condition"]).toLowerCase();
    const condition: FeedRow["condition"] = ["new", "used", "refurbished"].includes(rawCondition)
      ? rawCondition as FeedRow["condition"]
      : "";
    const regularPrice = normalizePrice(tagInner(b, ["price"]));
    const salePrice = normalizePrice(tagInner(b, ["sale_price"]));
    rows.push({
      id: tagInner(b, ["id", "sku", "item_id"]),
      source_id: `xml:row:${rows.length + 1}`,
      title: title.slice(0, 150),
      description: tagInner(b, ["description"]).slice(0, 5000),
      availability,
      condition,
      price: regularPrice || salePrice,
      link: tagInner(b, ["link"]),
      image_link: tagInner(b, ["image_link", "image", "image_url"]),
      brand: tagInner(b, ["brand", "vendor"]).slice(0, 70),
      additional_image_link: tagInner(b, ["additional_image_link"]),
      item_group_id: tagInner(b, ["item_group_id"]),
      google_product_category: tagInner(b, ["google_product_category", "product_type"]),
      sale_price: regularPrice ? salePrice : "",
      inventory: "",
    });
  }
  if (rows.length === 0) throw new Error("XML has no product rows");
  void sourceLabel;
  return rows;
}

export function parseFeedText(
  text: string,
  contentType: string,
  sourceLabel: string,
  limit = Number.POSITIVE_INFINITY
): { rows: FeedRow[]; format: "csv" | "xml" } {
  const head = text.slice(0, 2000).trimStart();
  const looksXml = /^(<\?xml|<\s*rss|<\s*feed|<\s*urlset)/i.test(head) || /<\s*(item|entry)[\s>]/i.test(head.slice(0, 5000)) || /xml/i.test(contentType);
  if (looksXml) return { rows: parseFeedXml(text, sourceLabel, limit), format: "xml" };
  return { rows: parseFeedCsv(text, sourceLabel, limit), format: "csv" };
}
