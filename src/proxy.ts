import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminPassword, createSessionToken, timingSafeEqual, SESSION_COOKIE } from "@/lib/auth";

// Optimistic site-wide gate (per Next docs: proxy does the redirect, route
// handlers remain the secure check). Public by design: /login, /api/login,
// and the Meta machine endpoints /api/feed + /api/render (capability URLs).
// Template reads by ID stay public — /api/render fetches them server-to-server.
export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/phone-lab" ||
    pathname.startsWith("/phone-lab/") ||
    pathname === "/api/login" ||
    pathname === "/api/feed" ||
    pathname === "/api/render" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  if (pathname === "/api/templates" && req.method === "GET" && searchParams.has("id")) {
    return NextResponse.next();
  }

  const password = await getAdminPassword();
  if (!password) return NextResponse.next(); // no password configured → open (local dev)

  const value = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await createSessionToken(password);
  if (value && timingSafeEqual(value, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not signed in — POST /api/login first", loginRequired: true },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Run on pages + APIs, skip framework/static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff2?|txt|xml)$).*)"],
};
