"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import type { Template } from "@/editor/types";
import type { FeedRow } from "@/lib/facebook";
import { HOMEPAGE_SLOTS } from "@/lib/homepageTemplates";

const INK = "#191712";
const MOSS = "#3a5a1e";
const SIGNAL = "#c8f04a";
const PORCELAIN = "#fbfaf6";
const LINE = "#e9e4d6";

/* Stable preview product — design review only, never exported. */
const PREVIEW_PRODUCT: FeedRow = {
  id: "admin-preview",
  title: "Voyager Watch 40mm",
  description: "Sand steel case, sapphire glass, 5 ATM.",
  availability: "in stock",
  condition: "new",
  price: "€289",
  link: "https://example.com/products/voyager-40",
  image_link: "https://picsum.photos/seed/catalog-forge-watch/800/800",
  brand: "gibun",
};

type Slot = {
  id: string;
  label: string;
  template: Template;
  customized: boolean;
  revision: number;
  updatedAt: number | null;
};

type HubLink = {
  href: string;
  title: string;
  desc: string;
  badge: string;
  badgeStyle?: React.CSSProperties;
};

const WORKFLOW: HubLink[] = [
  { href: "/", title: "Homepage →", desc: "Public landing: store URL in, phone preview out.", badge: "live" },
  { href: "/editor", title: "Editor →", desc: "Visual template editor (HTML, no canvas lib).", badge: "core" },
  { href: "/validate", title: "Validate →", desc: "Feed health: blocked / needs-review / ready.", badge: "core" },
];

const DESIGN: HubLink[] = [
  { href: "/concepts", title: "Landing concepts A–L →", desc: "12 directions: round 1, hybrids, refresh, refinements.", badge: "12 concepts" },
  { href: "/editor-concepts", title: "Editor concepts A–C →", desc: "3 editor redesigns: Studio Pro, Atelier, Flow.", badge: "3 concepts" },
  { href: "/phone-lab", title: "Phone lab →", desc: "Phone cutout + IG chrome experiments.", badge: "lab" },
];

const INTERNAL: HubLink[] = [
  { href: "/architecture", title: "Architecture →", desc: "Data flow, services, storage, auth. Internal docs.", badge: "docs" },
  { href: "/story-map", title: "Story map →", desc: "50 stories across 6 slices. Dev-only planning tool.", badge: "dev-only" },
  { href: "/story-map/experiments", title: "Experiments →", desc: "Story-map design lab. Dev-only.", badge: "dev-only" },
];

function LinkGrid({ items }: { items: HubLink[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-[16px] border bg-white p-4 hover:border-zinc-500 transition-colors block"
          style={{ borderColor: LINE }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold tracking-tight">{l.title}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full" style={l.badgeStyle ?? { background: "#f1efe9", color: "#71717a" }}>
              {l.badge}
            </span>
          </div>
          <div className="text-[12.5px] text-zinc-600 mt-1 leading-relaxed">{l.desc}</div>
          <div className="font-mono text-[11px] text-zinc-400 mt-2">{l.href}</div>
        </Link>
      ))}
    </div>
  );
}

export function AdminHub() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/homepage-templates");
      const json = (await res.json()) as { slots?: Slot[]; error?: string; loginRequired?: boolean };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/admin")}`);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Could not load homepage templates");
      setSlots(json.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetSlot = async (id: string) => {
    if (!window.confirm("Reset this slot to its demo default? Your customized design will be replaced (revision kept safe — it just increments).")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/homepage-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Reset failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: PORCELAIN, color: INK }}>
      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-40" style={{ borderColor: LINE }}>
        <div className="max-w-[1100px] mx-auto px-8 py-3 flex items-center gap-3">
          <Link href="/" className="text-[13px] font-medium text-zinc-500 hover:text-black">← homepage</Link>
          <h1 className="text-[15px] font-bold tracking-tight ml-2">Admin</h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full" style={{ background: SIGNAL }}>
            dev-only hub
          </span>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-8 py-10 space-y-10">
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
          Dev-only page (404s in production builds) — but the controls below write <strong>production data</strong> (homepage hero templates). Edit carefully.
        </div>

        <section className="space-y-3">
          <h2 className="text-[18px] font-bold tracking-tight">Workflow</h2>
          <LinkGrid items={WORKFLOW} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold tracking-tight">Homepage templates</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full" style={{ background: "#fde68a" }}>
              writes production data
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full" style={{ background: SIGNAL }}>
              {HOMEPAGE_SLOTS.length} slots
            </span>
          </div>
          <p className="text-[14px] text-zinc-600 leading-relaxed max-w-[680px]">
            These three designs power the hero phone on the homepage. Edit one in the
            visual editor and saving updates the homepage immediately — same record,
            no redeploy. Reset restores the demo default.
          </p>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-[13px] font-medium text-red-800">
              {error}
            </div>
          )}

          {!slots && !error && <div className="text-sm text-zinc-400">Loading slots…</div>}

          {slots?.map((slot) => (
            <section key={slot.id} className="rounded-[20px] border bg-white overflow-hidden" style={{ borderColor: LINE }}>
              <div className="flex flex-col md:flex-row">
                <div className="p-6 flex items-start justify-center shrink-0" style={{ background: "#f3f0e6" }}>
                  <div className="rounded-2xl overflow-hidden border bg-white" style={{ borderColor: LINE }}>
                    <TemplateRenderer
                      template={slot.template}
                      product={PREVIEW_PRODUCT}
                      scale={238 / Math.max(slot.template.width || 1080, 1)}
                    />
                  </div>
                </div>
                <div className="p-6 space-y-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[16px] font-bold tracking-tight">{slot.template.name || slot.label}</h3>
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full"
                      style={slot.customized
                        ? { background: "#e7f0d8", color: MOSS }
                        : { background: "#f1efe9", color: "#71717a" }}
                    >
                      {slot.customized ? "customized" : "default"}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-500 space-y-1">
                    <div>id · {slot.id}</div>
                    <div>
                      revision · {slot.revision}
                      {slot.updatedAt ? ` · updated ${new Date(slot.updatedAt).toLocaleString()}` : " · never saved"}
                    </div>
                    <div>{slot.template.width}×{slot.template.height} · {slot.template.layers.length} layers</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/editor?templateId=${encodeURIComponent(slot.id)}`}
                      className="text-xs px-4 py-2 text-white rounded-full font-bold"
                      style={{ background: INK }}
                    >
                      Edit in visual editor →
                    </Link>
                    <button
                      onClick={() => resetSlot(slot.id)}
                      disabled={busyId === slot.id}
                      className="text-xs px-4 py-2 border rounded-full font-medium hover:bg-zinc-50 disabled:opacity-40"
                      style={{ borderColor: LINE }}
                    >
                      {busyId === slot.id ? "Resetting…" : "Reset to default"}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400">
                    Preview product is fixed — open the editor to proof with real catalog rows.
                  </p>
                </div>
              </div>
            </section>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-[18px] font-bold tracking-tight">Design directions</h2>
          <LinkGrid items={DESIGN} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[18px] font-bold tracking-tight">Internal docs</h2>
          <LinkGrid items={INTERNAL} />
        </section>
      </main>
    </div>
  );
}
