import type { FeedRow } from "./facebook";

export type CatalogValidationSeverity = "error" | "warning" | "info";
export type CatalogValidationStatus = "blocked" | "needs-review" | "ready";

export type CatalogValidationIssue = {
  code: string;
  severity: CatalogValidationSeverity;
  message: string;
  count: number;
  rowIndexes: number[];
  productIds: string[];
};

export type CatalogValidationResult = {
  status: CatalogValidationStatus;
  rowCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  currencyCodes: string[];
  importComplete: boolean;
  imageChecks: "verified" | "not-run";
  issues: CatalogValidationIssue[];
};

export type ParsedCatalogPrice = { amount: number; currency: string };

const FALLBACK_CURRENCIES = new Set([
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR",
  "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON",
  "SEK", "SGD", "THB", "TRY", "TWD", "UAH", "USD", "VND", "ZAR",
]);

function supportedCurrencies(): Set<string> {
  try {
    const values = Intl.supportedValuesOf?.("currency");
    if (values?.length) return new Set(values);
  } catch {}
  return FALLBACK_CURRENCIES;
}

const CURRENCIES = supportedCurrencies();

export function parseCatalogPrice(value: string | null | undefined): ParsedCatalogPrice | null {
  const match = value?.trim().match(/^(\d+(?:\.\d{2}))\s+([A-Z]{3})$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const currency = match[2];
  if (!Number.isFinite(amount) || amount <= 0 || currency === "XXX" || !CURRENCIES.has(currency)) return null;
  return { amount, currency };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function validateCatalog(
  rows: FeedRow[],
  options: { importComplete?: boolean; imageChecks?: "verified" | "not-run" } = {}
): CatalogValidationResult {
  const importComplete = options.importComplete ?? true;
  const imageChecks = options.imageChecks ?? "not-run";
  const issues: CatalogValidationIssue[] = [];

  const add = (
    code: string,
    severity: CatalogValidationSeverity,
    message: string,
    rowIndexes: number[] = [],
    count = rowIndexes.length
  ) => {
    if (count === 0) return;
    issues.push({
      code,
      severity,
      message,
      count,
      rowIndexes,
      productIds: rowIndexes.map((index) => rows[index]?.id || `(row ${index + 1})`),
    });
  };
  const matching = (predicate: (row: FeedRow, index: number) => boolean) =>
    rows.flatMap((row, index) => predicate(row, index) ? [index] : []);

  if (rows.length === 0) add("no-products", "error", "No products were imported.", [], 1);
  if (!importComplete) {
    add("incomplete-import", "error", "The import reached its safety limit, so the complete catalog has not been validated.", [], 1);
  }

  add("missing-id", "error", "Product ID is required.", matching((row) => !row.id?.trim()));
  add("missing-source-id", "error", "A stable source product ID is required for exact image rendering.", matching((row) => !row.source_id?.trim()));

  const duplicateIndexes = (key: (row: FeedRow) => string | undefined) => {
    const groups = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const value = key(row)?.trim();
      if (!value) return;
      groups.set(value, [...(groups.get(value) ?? []), index]);
    });
    return Array.from(groups.values()).filter((indexes) => indexes.length > 1).flat();
  };
  add("duplicate-id", "error", "Product IDs must be unique in the exported catalog.", duplicateIndexes((row) => row.id));
  add("duplicate-source-id", "error", "Stable source product IDs must be unique.", duplicateIndexes((row) => row.source_id));

  add("missing-title", "error", "Title is required.", matching((row) => !row.title?.trim()));
  add("missing-description", "error", "Description is required.", matching((row) => !row.description?.trim()));
  add("missing-brand", "error", "Brand is required.", matching((row) => !row.brand?.trim()));
  add("missing-image", "error", "image_link is required.", matching((row) => !row.image_link?.trim()));
  add("invalid-link", "error", "Product links must be absolute HTTP(S) URLs.", matching((row) => !isHttpUrl(row.link)));
  add("invalid-image-link", "error", "Image links must be absolute HTTP(S) URLs.", matching((row) => Boolean(row.image_link?.trim()) && !isHttpUrl(row.image_link)));
  add("invalid-availability", "error", "Availability must be “in stock” or “out of stock”.", matching((row) => !["in stock", "out of stock"].includes(row.availability)));
  add("invalid-condition", "error", "Condition must be new, used, or refurbished.", matching((row) => !["new", "used", "refurbished"].includes(row.condition)));

  const parsedPrices = rows.map((row) => parseCatalogPrice(row.price));
  add("invalid-price", "error", "Price must be a positive amount with two decimals and a supported ISO currency, such as 17.90 EUR.", matching((_row, index) => !parsedPrices[index]));

  const parsedSales = rows.map((row) => row.sale_price?.trim() ? parseCatalogPrice(row.sale_price) : null);
  add("invalid-sale-price", "error", "Sale price must use the same amount and ISO currency format as price.", matching((row, index) => Boolean(row.sale_price?.trim()) && !parsedSales[index]));
  add("sale-currency-mismatch", "error", "Sale price currency must match the regular price currency.", matching((row, index) => {
    if (!row.sale_price?.trim() || !parsedPrices[index] || !parsedSales[index]) return false;
    return parsedPrices[index]!.currency !== parsedSales[index]!.currency;
  }));
  add("invalid-sale-order", "error", "Sale price must be lower than the regular price.", matching((row, index) => {
    if (!row.sale_price?.trim() || !parsedPrices[index] || !parsedSales[index]) return false;
    return parsedSales[index]!.amount >= parsedPrices[index]!.amount;
  }));

  add("short-description", "warning", "Descriptions under 20 characters may reduce catalog relevance.", matching((row) => Boolean(row.description) && row.description.length < 20));
  add("long-title", "warning", "Titles over 150 characters may be truncated by Meta.", matching((row) => row.title.length > 150));
  add("out-of-stock", "info", "Out-of-stock products remain in the feed but are not eligible for delivery.", matching((row) => row.availability === "out of stock"));
  if (rows.length > 0 && imageChecks === "not-run") {
    add("image-dimensions-unverified", "warning", "Image dimensions have not been verified for this catalog.", [], rows.length);
  }

  const currencyCodes = Array.from(new Set(
    [...parsedPrices, ...parsedSales].flatMap((price) => price ? [price.currency] : [])
  )).sort();
  const errorCount = issues.filter((issue) => issue.severity === "error").reduce((sum, issue) => sum + issue.count, 0);
  const warningCount = issues.filter((issue) => issue.severity === "warning").reduce((sum, issue) => sum + issue.count, 0);
  const infoCount = issues.filter((issue) => issue.severity === "info").reduce((sum, issue) => sum + issue.count, 0);
  return {
    status: errorCount > 0 ? "blocked" : warningCount > 0 ? "needs-review" : "ready",
    rowCount: rows.length,
    errorCount,
    warningCount,
    infoCount,
    currencyCodes,
    importComplete,
    imageChecks,
    issues,
  };
}
