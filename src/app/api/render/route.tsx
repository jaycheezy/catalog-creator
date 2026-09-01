import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { fetchShopifyProducts, normalizeDomain } from "@/lib/shopify";
import { resolveBinding } from "@/editor/bindings";
import { getSecret, verifyTemplateToken, getClientIp, checkRateLimit } from "@/lib/auth";
import type { Template } from "@/editor/types";

async function fetchTemplateViaHttp(req: NextRequest, id: string): Promise<Template | null> {
  try {
    const secret = await getSecret();
    const headers: Record<string, string> = {};
    if (secret) headers["x-api-key"] = secret;
    // In edge, direct file access not available, fetch via HTTP to nodejs templates API
    const url = new URL(`/api/templates?id=${encodeURIComponent(id)}`, req.nextUrl.origin).toString();
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Template;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const secret = await getSecret();
  // Rate limit: 60/min per IP for render (expensive)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`render:${ip}`, 60);
  if (!rl.ok) return new Response("Rate limited — 60 renders/min per IP", { status: 429, headers: { "Retry-After": "60" } });

  const { searchParams } = req.nextUrl;
  const templateId = searchParams.get("templateId") || searchParams.get("id");
  const templateParam = searchParams.get("template");
  const handle = searchParams.get("handle");
  const domain = searchParams.get("domain") || "store.gibun.at";
  const token = searchParams.get("token");

  if (!handle) {
    return new Response("Missing ?handle=product-handle", { status: 400 });
  }

  // Enriched render requires token when secret is set
  if (secret && templateId) {
    if (!(await verifyTemplateToken(templateId, token, secret))) {
      return new Response("Unauthorized — missing or invalid token. Save template to get signed URL with ?token=...", { status: 401 });
    }
  }

  let template: Template | null = null;
  if (templateParam) {
    try {
      const json = Buffer.from(templateParam, "base64").toString("utf-8");
      template = JSON.parse(json) as Template;
    } catch {}
  } else if (templateId) {
    template = await fetchTemplateViaHttp(req, templateId);
  }

  if (!template) {
    return new Response(`Template not found: ${templateId ?? "(no id)"}. POST it to /api/templates first.`, { status: 404 });
  }

  let origin: string;
  try {
    origin = normalizeDomain(domain);
  } catch {
    return new Response(`Invalid domain: ${domain}`, { status: 400 });
  }

  let product: import("@/lib/facebook").FeedRow | null = null;
  try {
    const products = await fetchShopifyProducts(origin);
    const { productsToRows } = await import("@/lib/facebook");
    const { getFilteredProducts } = await import("@/lib/shopify");
    const filtered = getFilteredProducts(products);
    const rows = productsToRows(filtered, origin);
    const found = rows.find((r) => r.link.includes(`/products/${handle}`));
    if (found) product = found;
    else {
      const allRows = productsToRows(products, origin);
      const alt = allRows.find((r) => r.link.includes(`/products/${handle}`));
      if (alt) product = alt;
    }
  } catch (e) {
    return new Response(`Failed to fetch product ${handle}: ${String(e)}`, { status: 502 });
  }

  if (!product) {
    return new Response(`Product handle not found: ${handle} in ${origin}`, { status: 404 });
  }

  const width = template.width;
  const height = template.height;
  const layers = [...template.layers].filter((l) => l.visible).sort((a, b) => a.z - b.z);

  const jsx = (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        background: template.background || "#ffffff",
        position: "relative",
        display: "flex",
      }}
    >
      {layers.map((layer) => {
        if (layer.type === "product-image") {
          const src = product!.image_link;
          return (
            <div
              key={layer.id}
              style={{
                position: "absolute",
                left: `${layer.x}px`,
                top: `${layer.y}px`,
                width: `${layer.w}px`,
                height: `${layer.h}px`,
                background: layer.style.background || "#fafaf7",
                borderRadius: `${layer.style.borderRadius ?? 0}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  width={layer.w}
                  height={layer.h}
                  style={{ width: "100%", height: "100%", objectFit: (layer.objectFit as "contain" | "cover") ?? "contain" }}
                  alt=""
                />
              ) : null}
            </div>
          );
        }
        const text = resolveBinding(layer.content ?? "", product);
        const isBadge = layer.type === "badge";
        return (
          <div
            key={layer.id}
            style={{
              position: "absolute",
              left: `${layer.x}px`,
              top: `${layer.y}px`,
              width: `${layer.w}px`,
              height: `${layer.h}px`,
              background: layer.style.background ?? (isBadge ? "#111" : "transparent"),
              color: layer.style.color ?? (isBadge ? "#fff" : "#111"),
              fontSize: `${layer.style.fontSize ?? 32}px`,
              fontWeight: layer.style.fontWeight ?? 600,
              display: "flex",
              alignItems: "center",
              justifyContent: layer.style.textAlign === "left" ? "flex-start" : layer.style.textAlign === "right" ? "flex-end" : "center",
              borderRadius: `${layer.style.borderRadius ?? 0}px`,
              padding: `${layer.style.padding ?? (isBadge ? 8 : 0)}px`,
            }}
          >
            <span style={{ width: "100%", textAlign: (layer.style.textAlign as "left" | "center" | "right") ?? "center", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {text || ""}
            </span>
          </div>
        );
      })}
    </div>
  );

  return new ImageResponse(jsx, {
    width,
    height,
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
