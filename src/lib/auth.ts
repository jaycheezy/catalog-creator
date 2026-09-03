// Simple single-password auth + capability URLs for Meta reads.
// - Humans (editor UI, POST /api/templates, GET ?list=1) auth via ADMIN_PASSWORD cookie session.
// - Meta's fetcher can't log in, so /api/feed?templateId= and /api/render?templateId= are
//   public by design. Security comes from unguessable template IDs (see newTemplateId()).
const TEXT_ENCODER = new TextEncoder();

export const SESSION_COOKIE = "catalog-forge-admin";

async function hmacHex(message: string, secret: string): Promise<string> {
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
  try {
    const { createHmac } = await import("crypto");
    return createHmac("sha256", secret).update(message).digest("hex");
  } catch {
    let hash = 0;
    for (let i = 0; i < message.length; i++) hash = (hash * 31 + message.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { timingSafeEqual };

export async function getAdminPassword(): Promise<string | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = (mod as unknown as { getCloudflareContext: () => { env: Record<string, unknown> } }).getCloudflareContext();
    const s = ctx?.env?.["ADMIN_PASSWORD"] as string | undefined;
    if (s) return s;
  } catch {}
  try {
    const s = (process as unknown as { env: Record<string, string> }).env?.["ADMIN_PASSWORD"];
    if (s) return s;
  } catch {}
  return null;
}

export async function createSessionToken(password: string): Promise<string> {
  return hmacHex("catalog-forge-admin-session", password);
}

export async function verifyPassword(input: string, password: string): Promise<boolean> {
  return timingSafeEqual(input, password);
}

export function getSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  const password = await getAdminPassword();
  if (!password) return true; // no password configured → open (local dev)
  const value = getSessionCookie(req);
  if (!value) return false;
  const expected = await createSessionToken(password);
  return timingSafeEqual(value, expected);
}

export function buildSessionCookie(token: string): string {
  // 30 days, HttpOnly, Lax, Secure in prod ( weaknesses: no rotation except password change — fine for MVP)
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// Unguessable template IDs double as capability URLs (like Notion share links).
export function newTemplateId(): string {
  try {
    const uuid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as Crypto).randomUUID()
        : null;
    if (uuid) return `tpl_${uuid.replace(/-/g, "")}`;
  } catch {}
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `tpl_${rand}`.slice(0, 32);
}

export function sanitizeTemplateId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

// Simple in-memory rate limiter (per isolate, best effort for Workers without KV)
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
