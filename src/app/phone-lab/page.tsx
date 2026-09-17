"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PhoneHero } from "@/components/PhoneHero";
import { IgTabBar } from "@/components/IgTabBar";
import { TemplateRenderer } from "@/editor/TemplateRenderer";
import { adaptTemplateToSize } from "@/editor/autoLayout";
import { SIZE_PRESETS } from "@/editor/types";
import { DEMO_TEMPLATES } from "@/lib/demoTemplates";
import type { FeedRow } from "@/lib/facebook";
import { KNOWN_LOGOS } from "@/lib/brand";

/* Gibun avatar with initial-letter fallback if the CDN artwork fails. */
function GibunAvatar({ size }: { size: number }) {
  const [ok, setOk] = useState(true);
  return (
    <span className="relative block rounded-full overflow-hidden bg-white" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-white"
        style={{ background: MOSS, fontSize: Math.round(size * 0.42) }}
      >
        G
      </span>
      {ok && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={KNOWN_LOGOS.gibun}
          alt="gibun"
          onError={() => setOk(false)}
          className="absolute inset-0 w-full h-full object-contain bg-white"
        />
      )}
    </span>
  );
}

const INK = "#191712";
const MOSS = "#3a5a1e";
const SIGNAL = "#c8f04a";
const PORCELAIN = "#fbfaf6";
const LINE = "#e9e4d6";

const DEMO_IMG =
  "https://picsum.photos/seed/catalog-forge-watch/800/800";

const DEMO_PRODUCT: FeedRow = {
  id: "demo-voyager-40",
  title: "Voyager Watch 40mm",
  description: "Sand steel case, sapphire glass, 5 ATM.",
  availability: "in stock",
  condition: "new",
  price: "€289",
  link: "https://gibun.example/products/voyager-40",
  image_link: "https://picsum.photos/seed/catalog-forge-watch/800/800",
  brand: "gibun",
};

export default function PhoneLabPage() {
  return (
    <div className="min-h-screen" style={{ background: PORCELAIN, color: INK }}>
      <style>{`
        @keyframes lab-swap { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
      `}</style>
      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-40" style={{ borderColor: LINE }}>
        <div className="max-w-[1300px] mx-auto px-8 py-3 flex items-center gap-3">
          <Link href="/" className="text-[13px] font-medium text-zinc-500 hover:text-black">← homepage</Link>
          <h1 className="text-[15px] font-bold tracking-tight ml-2">Phone Lab — before / after</h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full" style={{ background: SIGNAL }}>
            3 ways
          </span>
          <div className="ml-auto font-mono text-[11px] text-zinc-400 hidden md:block">
            raw feed in · forged creative out
          </div>
        </div>
      </header>

      <main className="max-w-[1300px] mx-auto px-8 py-10 space-y-10">
        <div className="max-w-[720px]">
          <div className="font-mono text-[10px] tracking-[0.24em] uppercase" style={{ color: MOSS }}>
            The oldest demo in catalog ads
          </div>
          <h2 className="text-[42px] leading-[1.02] mt-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Raw feed in, <em style={{ color: MOSS }}>brand-perfect out.</em>
          </h2>
            <p className="text-[15px] text-zinc-600 mt-3 leading-relaxed">
              Three flavors of the same wipe — drag it, stack it, or hold it.
              All live, all on the real shared phone.
            </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <VariationCard
            n="01"
            title="Swipe the Difference"
            sub="Wipe 1 · horizontal"
            desc="Drag the handle edge to edge — it snaps to either side, so you can park it on the full forged ad or the full raw photo. Same SKU, same phone."
            techniques={["Full 0–100% travel with edge snap", "Forged side is real template output", "Tilt auto-freezes mid-swipe"]}
            backdrop="linear-gradient(180deg,#f1ede1 0%, #fbfaf6 70%)"
            footer="Strongest for skeptics: proof inside the product."
            interactive
          >
            <BeforeAfterDemo />
          </VariationCard>

          <VariationCard
            n="02"
            title="Wipe Up for Forged"
            sub="Wipe 2 · vertical"
            desc="Same wipe, rotated for portrait-first feeds: raw on top, forged below, full travel with snap. Built for story and 4:5 placements."
            techniques={["Shared divider engine, vertical axis", "Chips fade as their side disappears", "Same real template output"]}
            backdrop="linear-gradient(180deg,#efeee8 0%, #fbfaf6 70%)"
            footer="For portrait placements: the difference, stacked."
          >
            <VerticalWipeDemo />
          </VariationCard>

          <VariationCard
            n="03"
            title="Hold to Peek"
            sub="Wipe 3 · press and hold"
            desc="No precision needed: press anywhere and the forged ad melts back to the raw feed photo. Release and it springs home. The mobile-native version."
            techniques={["200ms crossfade, no handle to grab", "Full-bleed raw reveal under your thumb", "Tilt freezes while held"]}
            backdrop="linear-gradient(180deg,#f1ede1 0%, #fbfaf6 70%)"
            footer="For thumbs: proof without aiming."
          >
            <HoldPeekDemo />
          </VariationCard>
        </div>

        <div className="rounded-2xl border bg-white p-6 flex flex-col md:flex-row md:items-center gap-4" style={{ borderColor: LINE }}>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: MOSS }}>Which wipe wins?</div>
            <p className="text-[14px] mt-1 text-zinc-700 leading-relaxed max-w-[640px]">
              01 is the classic, 02 stacks it for portrait, 03 needs no aiming.
              Tell me which one earns a place and it ships to the homepage.
            </p>
          </div>
          <div className="md:ml-auto flex gap-2 shrink-0">
            <Link href="/" className="text-xs px-4 py-2 border rounded-full font-medium hover:bg-zinc-50" style={{ borderColor: LINE }}>← back to homepage</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ————————— card shell ————————— */

function VariationCard({
  n, title, sub, desc, techniques, backdrop, footer, dark, interactive, children,
}: {
  n: string; title: string; sub: string; desc: string; techniques: string[];
  backdrop: string; footer: string; dark?: boolean; interactive?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[20px] border overflow-hidden flex flex-col ${dark ? "border-black" : "bg-white"}`}
      style={dark ? { borderColor: "#2a2825", background: "#111009" } : { borderColor: LINE }}>
      <div className="px-5 pt-5 pb-1 flex items-start gap-3">
        <span className="font-mono text-[11px] px-2 py-1 rounded-full shrink-0" style={{ background: dark ? "#232117" : INK, color: dark ? SIGNAL : "#fff" }}>{n}</span>
        <div>
          <div className={`text-[17px] font-bold tracking-tight ${dark ? "text-white" : ""}`}>{title}</div>
          <div className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{sub}</div>
        </div>
      </div>
      <p className={`px-5 pt-2 text-[13px] leading-relaxed ${dark ? "text-zinc-300" : "text-zinc-600"}`}>{desc}</p>

      <div className="m-4 rounded-2xl relative overflow-hidden flex items-center justify-center py-10 min-h-[660px]" style={{ background: backdrop }}>
        {!dark && (
          <div className="absolute inset-0 pointer-events-none opacity-60"
            style={{ backgroundImage: "radial-gradient(rgba(25,23,18,0.10) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        )}
        {dark && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "100% 44px" }} />
        )}
        <div className="relative z-10">{children}</div>
        {interactive && (
          <div className="absolute bottom-3 font-mono text-[10px] text-zinc-500 bg-white/80 backdrop-blur px-2.5 py-1 rounded-full border" style={{ borderColor: LINE }}>
            hover to tilt · live perspective
          </div>
        )}
      </div>

      <div className={`px-5 pb-2 space-y-1.5 ${dark ? "text-zinc-300" : ""}`}>
        {techniques.map((t) => (
          <div key={t} className="flex gap-2 text-[12px]">
            <span style={{ color: MOSS }}>✓</span>
            <span className={dark ? "text-zinc-300" : "text-zinc-700"}>{t}</span>
          </div>
        ))}
      </div>
      <div className={`mt-auto px-5 py-4 font-mono text-[11px] ${dark ? "text-zinc-400" : "text-zinc-500"}`}>→ {footer}</div>
    </div>
  );
}

/* ————————— lab screen ————————— */
/* Built 1:1 on the homepage feed layout (same classes, same order, same
   fixed rows + locked 2-line caption) so heights match by construction. */

function LabScreen({ creative }: { creative?: React.ReactNode }) {
  // Ad CTA pulse: ink at rest, brand moss after 4s.
  const [ctaOn, setCtaOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCtaOn(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="flex items-center justify-between pl-7 pr-6 pt-3.5 pb-1 text-[11px] font-semibold shrink-0 text-black">
        <span className="w-10">9:41</span>
        <span className="flex items-center gap-1.5">
          <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5" /><rect x="4" y="5" width="3" height="6" rx="0.5" /><rect x="8" y="2.5" width="3" height="8.5" rx="0.5" /><rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.4" /></svg>
          <svg width="22" height="11" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" /></svg>
        </span>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2 shrink-0">
        <span className="rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)" }}>
          <span className="block rounded-full bg-white p-[2px]">
            <GibunAvatar size={26} />
          </span>
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[12px] font-semibold truncate">gibun</div>
          <div className="text-[11px] text-zinc-500">Sponsored</div>
        </div>
        <span className="ml-auto text-[15px] tracking-widest text-zinc-800 px-1">•••</span>
      </div>
      {creative ?? (
      <div className="w-full aspect-square overflow-hidden shrink-0 relative" style={{ background: "linear-gradient(140deg,#e8e2d2,#cfc8b4)" }}>
        <div className="absolute inset-0 flex items-center justify-center text-[64px]">⌚</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DEMO_IMG}
          alt="Voyager Watch 40mm"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.45))" }} />
        <div className="absolute left-2.5 right-2.5 bottom-2.5 flex items-end gap-2">
          <div className="text-white leading-tight">
            <div className="text-[12px] font-bold drop-shadow">Voyager Watch 40mm</div>
            <div className="font-mono text-[10px] opacity-90">€289 · gibun</div>
          </div>
          <span className="ml-auto text-[11px] font-bold text-white rounded-full px-3 py-1.5 shrink-0" style={{ background: INK }}>Shop Now</span>
        </div>
        <span className="absolute top-2.5 left-2.5 text-[10px] font-bold text-white rounded-full px-2.5 py-1" style={{ background: "rgba(25,23,18,0.85)" }}>€289</span>
      </div>
      )}
      {/* IG ad CTA — white/black at rest, brand moss after 4s */}
      <div
        className="flex items-center justify-between pl-3 pr-2.5 shrink-0"
        style={{
          background: ctaOn ? MOSS : "#ffffff",
          color: ctaOn ? "#ffffff" : INK,
          borderBottom: ctaOn ? "1px solid transparent" : "1px solid #f4f4f5",
          transition: "background-color 900ms ease, color 900ms ease, border-color 900ms ease",
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <span className="text-[13.5px] font-semibold tracking-tight">Shop Now</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </div>
      <div className="px-2.5 pt-2 flex items-center shrink-0">
        <span className="flex items-center gap-3 text-[20px] leading-none">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" strokeWidth="1.5"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.3 5 5.7 5c2 0 3.4 1.1 4.3 2.6h4C15 6.1 16.4 5 18.4 5c3.4 0 5.3 3.6 3.7 6.7C19.5 16.4 12 21 12 21z" transform="scale(0.92) translate(1,1)" /></svg>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" strokeLinejoin="round" /></svg>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 2 11 13" strokeLinecap="round" /><path d="M22 2 15 22l-4-9-9-4 20-7z" strokeLinejoin="round" /></svg>
        </span>
        <span className="mx-auto flex gap-1 px-2">
          <span className="h-[6px] rounded-full" style={{ width: 16, background: "#3897f0" }} />
          <span className="h-[6px] w-[6px] rounded-full bg-[#c7c7c7]" />
          <span className="h-[6px] w-[6px] rounded-full bg-[#c7c7c7]" />
        </span>
        <span className="ml-auto">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <div className="px-2.5 pt-1 text-[12px] font-semibold shrink-0">2,314 likes</div>
      <div className="px-2.5 pt-0.5 pb-5 text-[12px] leading-snug flex-1 min-h-0 overflow-hidden">
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.75em" }}>
          <span className="font-semibold">gibun</span> <span>Voyager in sand steel ✨ Tap to shop — <span className="text-zinc-500">#gibun #newin</span></span>
        </span>
      </div>
      <IgTabBar />
    </div>
  );
}

/* ————————— wipe engine: draggable raw/forged divider ————————— */

function useForgedTemplate() {
  return useMemo(() => adaptTemplateToSize(DEMO_TEMPLATES[0], SIZE_PRESETS[0]), []);
}

function DividerSquare({ axis = "x" }: { axis?: "x" | "y" }) {
  const vertical = axis === "y";
  const [pos, setPos] = useState(vertical ? 60 : 62);
  const [drag, setDrag] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const forged = useForgedTemplate();
  const move = (clientX: number, clientY: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const raw = vertical
      ? ((clientY - r.top) / r.height) * 100
      : ((clientX - r.left) / r.width) * 100;
    if (!Number.isFinite(raw)) return;
    const clamped = Math.min(100, Math.max(0, raw));
    // full travel with edge snap — park it to see either side complete
    setPos(clamped < 5 ? 0 : clamped > 95 ? 100 : clamped);
  };
  // raw leads (left / top), forged follows (right / bottom)
  const clip = vertical ? `inset(${pos}% 0 0 0)` : `inset(0 0 0 ${pos}%)`;
  const rawVisible = pos > 12;
  const forgedVisible = pos < 88;
  return (
    <div
      ref={boxRef}
      className="w-full aspect-square overflow-hidden shrink-0 relative select-none cursor-ew-resize touch-none"
      style={{ cursor: vertical ? "ns-resize" : "ew-resize" }}
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture unsupported — drag still works */ } setDrag(true); move(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (drag) move(e.clientX, e.clientY); }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      {/* RAW base full-bleed on opaque white (transparent packshots
          must show white, never the forged layers beneath) */}
      <div className="absolute inset-0" style={{ background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEMO_PRODUCT.image_link} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <span
        className="absolute top-2.5 left-2.5 z-20 text-[10px] font-bold rounded-full px-2.5 py-1 pointer-events-none bg-white/85 text-zinc-700"
        style={{ opacity: rawVisible ? 1 : 0, transition: "opacity 200ms" }}
      >
        RAW FEED
      </span>
      {/* FORGED — real template output, revealed past the handle */}
      <div className="absolute inset-0 pointer-events-none" style={{ clipPath: clip }}>
        <TemplateRenderer template={forged} product={DEMO_PRODUCT} scale={264 / 1080} />
      </div>
      <span
        className="absolute text-[10px] font-bold text-white rounded-full px-2.5 py-1 pointer-events-none"
        style={{
          background: "rgba(25,23,18,0.85)",
          opacity: forgedVisible ? 1 : 0,
          transition: "opacity 200ms",
          zIndex: 20,
          ...(vertical ? { left: 10, bottom: 10 } : { top: 10, right: 10 }),
        }}
      >
        FORGED ✓
      </span>
      {/* handle */}
      <div className="absolute z-10 pointer-events-none" style={vertical ? { top: `${pos}%`, left: 0, right: 0 } : { left: `${pos}%`, top: 0, bottom: 0 }}>
        <div
          className="absolute bg-white"
          style={vertical
            ? { left: 0, right: 0, top: -1, height: 2.5, transform: "translateY(-50%)", boxShadow: "0 0 8px rgba(0,0,0,0.35)" }
            : { top: 0, bottom: 0, left: -1, width: 2.5, transform: "translateX(-50%)", boxShadow: "0 0 8px rgba(0,0,0,0.35)" }}
        />
        <div
          className="absolute w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center font-bold text-zinc-700 text-[15px]"
          style={{
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            ...(vertical ? { left: "50%", top: 0, transform: "translate(-50%,-50%)" } : { left: 0, top: "50%", transform: "translate(-50%,-50%)" }),
          }}
        >
          {vertical ? "⇕" : "⇔"}
        </div>
      </div>
    </div>
  );
}

/* ————————— way 3 · hold to peek (press-and-hold raw reveal) ————————— */

function HoldPeekDemo() {
  const [held, setHeld] = useState(false);
  return (
    <div className="relative flex items-center justify-center w-full">
      <div className="relative z-10">
        <PhoneHero>
          <div
            className="flex-1 min-h-0 flex flex-col bg-white relative select-none touch-none"
            onPointerDown={() => setHeld(true)}
            onPointerUp={() => setHeld(false)}
            onPointerCancel={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
          >
            <LabScreen />
            {/* raw full-bleed reveal while held */}
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ opacity: held ? 1 : 0, transition: "opacity 200ms ease" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEMO_PRODUCT.image_link} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.5))" }} />
              <span className="absolute top-2.5 left-2.5 text-[10px] font-bold rounded-full px-2.5 py-1 bg-white/85 text-zinc-700">RAW FEED · HOLDING</span>
              <span className="absolute bottom-2.5 left-2.5 right-2.5 text-center font-mono text-[10px] text-white/90">release to spring back to forged</span>
            </div>
            {!held && (
              <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] font-bold text-white rounded-full px-3 py-1.5 pointer-events-none" style={{ background: "rgba(25,23,18,0.85)" }}>
                HOLD TO PEEK · RAW
              </span>
            )}
          </div>
        </PhoneHero>
      </div>
    </div>
  );
}

/* ————————— way 1 · swipe the difference ————————— */

function BeforeAfterDemo() {
  return (
    <div className="relative flex items-center justify-center w-full">
      <div className="relative z-10">
        <PhoneHero>
          <LabScreen creative={<DividerSquare />} />
        </PhoneHero>
      </div>
    </div>
  );
}

/* ————————— way 2 · wipe up for forged (vertical axis) ————————— */

function VerticalWipeDemo() {
  return (
    <div className="relative flex items-center justify-center w-full">
      <div className="relative z-10">
        <PhoneHero>
          <LabScreen creative={<DividerSquare axis="y" />} />
        </PhoneHero>
      </div>
    </div>
  );
}

/* ————————— way 3 · hold to peek is defined above (with the wipe engine) ————————— */
