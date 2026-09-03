import { NextRequest, NextResponse } from "next/server";
import {
  getAdminPassword,
  createSessionToken,
  verifyPassword,
  isAuthenticated,
  buildSessionCookie,
  clearSessionCookie,
  getClientIp,
  checkRateLimit,
} from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/login → { configured, authenticated } for UI gating
export async function GET(req: NextRequest) {
  const password = await getAdminPassword();
  const authenticated = await isAuthenticated(req);
  return NextResponse.json({ configured: !!password, authenticated });
}

// POST /api/login { password } → sets HttpOnly session cookie
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:${ip}`, 10);
  if (!rl.ok)
    return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });

  const password = await getAdminPassword();
  if (!password) {
    // No password configured (local dev) — nothing to do
    return NextResponse.json({ ok: true, open: true });
  }

  let input = "";
  try {
    const body = (await req.json()) as { password?: string };
    input = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(await verifyPassword(input, password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await createSessionToken(password);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildSessionCookie(token));
  return res;
}

// DELETE /api/login → logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
