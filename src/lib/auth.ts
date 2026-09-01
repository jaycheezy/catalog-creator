// Auth helpers — works in edge (Web Crypto) + nodejs (Node crypto)
const TEXT_ENCODER = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  // Try Web Crypto first (Workers/edge)
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const key = await crypto.subtle.importKey(
        "raw",
        TEXT_ENCODER.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(message));
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {}
  // Fallback to Node crypto
  try {
    const { createHmac } = await import("crypto");
    return createHmac("sha256", secret).update(message).digest("hex");
  } catch {
    // Last resort: simple hash (not secure, dev only)
    let hash = 0;
    for (let i = 0; i < message.length; i++) hash = (hash * 31 + message.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  }
}

export async function signTemplateId(templateId: string, secret: string): Promise<string> {
  return hmacHex(`template:${templateId}`, secret);
}

export async function verifyTemplateToken(templateId: string, token: string | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const expected = await signTemplateId(templateId, secret);
  // constant-time compare
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function getSecret(): Promise<string | null> {
  // Try Cloudflare env first
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = (mod as unknown as { getCloudflareContext: () => { env: Record<string, unknown> } }).getCloudflareContext();
    const s = ctx?.env?.["API_SECRET"] as string | undefined;
    if (s) return s;
  } catch {}
  // Fallback to process.env for local dev (set via .dev.vars or env)
  try {
    const s = (process as unknown as { env: Record<string, string> }).env?.["API_SECRET"];
    if (s) return s;
  } catch {}
  return null;
}

export async function isAuthorized(req: Request, secret: string | null): Promise<boolean> {
  if (!secret) return true; // no secret configured → allow (local dev)
  const header = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return false;
  return header === secret;
}

// Simple in-memory rate limiter (per isolate, 60/min per IP) — best effort for Workers without KV
const rateMap = new Map<string, { count: number; reset: number }>();
export function checkRateLimit(ip: string, limit = 60, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { ok: false, remaining: 0 };
  entry.count++;
  return { ok: true, remaining: limit - entry.count };
}

export function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
