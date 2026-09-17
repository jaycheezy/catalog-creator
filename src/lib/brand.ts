import type { Template } from "@/editor/types";

export type BrandKit = {
  domain: string;
  name: string;
  accent: string;
  accentInk: string;
  softBg: string;
  logoUrl: string | null;
  source: "context.dev" | "heuristic";
};

/* Known-brand logo overrides: exact artwork beats a favicon guess.
   Keyed by host substring, so subdomains (store.gibun.at) match. */
export const KNOWN_LOGOS: Record<string, string> = {
  gibun: "https://store.gibun.at/cdn/shop/files/logo_without_bg_260x.png?v=1715673474",
};

export function knownLogoFor(host: string): string | null {
  const h = host.toLowerCase();
  for (const [key, url] of Object.entries(KNOWN_LOGOS)) {
    if (h.includes(key)) return url;
  }
  return null;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function prettyNameFromDomain(domain: string, vendor?: string): string {
  if (vendor && vendor.trim().length >= 2 && vendor.trim().length <= 28) return vendor.trim();
  const host = domain.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  const base = host.split(".")[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function heuristicBrandKit(domain: string, vendor?: string): BrandKit {
  const clean = domain.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "") || domain;
  const hue = hashHue(clean.toLowerCase());
  // Deep, ad-friendly accent; keep luminance mid so white text works.
  const accent = `hsl(${hue} 65% 32%)`;
  const softBg = `hsl(${hue} 70% 96%)`;
  const host = clean;
  return {
    domain: clean,
    name: prettyNameFromDomain(clean, vendor),
    accent,
    accentInk: "#ffffff",
    softBg,
    logoUrl: knownLogoFor(clean)
      ?? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    source: "heuristic",
  };
}

/** Apply brand accent to a demo template clone: price pill + vendor line. */
export function brandTemplate(base: Template, kit: BrandKit): Template {
  return {
    ...base,
    layers: base.layers.map((l) => {
      if (l.type === "badge" && /price/i.test(l.name)) {
        return { ...l, style: { ...l.style, background: kit.accent, color: kit.accentInk } };
      }
      if (l.type === "text" && /vendor/i.test(l.name)) {
        return { ...l, style: { ...l.style, color: kit.accent } };
      }
      return l;
    }),
  };
}
