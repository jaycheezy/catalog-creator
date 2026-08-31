import type { FeedRow } from "@/lib/facebook";

export function resolveBinding(template: string, product: FeedRow | null): string {
  if (!template) return "";
  if (!product) return template.replace(/\{\{[^}]+\}\}/g, "—");
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    switch (key) {
      case "title":
        return product.title || "";
      case "price":
        return product.price || "";
      case "sale_price":
        return product.sale_price || "";
      case "compare_at_price":
        // derived from price vs sale_price; if sale_price exists, price is original
        return product.sale_price ? product.price : "";
      case "discount_pct": {
        const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
        const p = parse(product.price);
        const sp = parse(product.sale_price || "");
        if (sp && p > sp) return String(Math.round(((p - sp) / p) * 100));
        if (product.sale_price) return "0";
        return "";
      }
      case "discount_amount": {
        const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
        const p = parse(product.price);
        const sp = parse(product.sale_price || "");
        if (sp && p > sp) return `${(p - sp).toFixed(2)} EUR`;
        return "";
      }
      case "vendor":
      case "brand":
        return product.brand || "";
      case "description":
        return product.description || "";
      case "handle":
        return product.link?.split("/products/")[1] || "";
      case "sku":
      case "id":
        return product.id || "";
      default:
        // allow any FeedRow key
        return (product as Record<string, string>)[key] ?? "";
    }
  });
}

export function hasBinding(content: string | undefined): boolean {
  return !!content && /\{\{\w+\}\}/.test(content);
}
