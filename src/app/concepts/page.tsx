"use client";

import Link from "next/link";
import { useState } from "react";

// Shared mock catalog — same products in all three concepts so you compare design, not data.
const MOCK_PRODUCTS = [
  { id: "1", title: "Tulsi Mala", price: "24.95 EUR", img: "https://picsum.photos/seed/mala1/700/700", vendor: "Lotuscrafts" },
  { id: "2", title: "Rudraksha Mala", price: "19.95 EUR", img: "https://picsum.photos/seed/mala2/700/700", vendor: "Lotuscrafts" },
  { id: "3", title: "Yoga Bolster", price: "59.00 EUR", img: "https://picsum.photos/seed/bolster/700/700", vendor: "Lotuscrafts" },
];

function Stars() {
  return <span className="tracking-tight">★★★★★</span>;
}

export default function ConceptsPage() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold">← Catalog Forge</Link>
          <span className="text-xs text-zinc-500">12 concepts — A–C round 1, D–F hybrids, G–I refresh, J–L landing refinements</span>
          <div className="ml-auto flex gap-1.5 text-xs">
            {(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] as const).map((k) => (
              <a key={k} href={`#concept-${k}`} className="px-3 py-1.5 border rounded-full bg-white hover:border-zinc-500">
                {k.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-14">
        <Intro />
        <ConceptA active={active} setActive={setActive} />
        <ConceptB active={active} setActive={setActive} />
        <ConceptC active={active} setActive={setActive} />
        <div className="border-t pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Round 2 — B&apos;s edge, A&apos;s safety.</h2>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">Three hybrids: light base with signal accents, warm dark with serif calm, and a split gallery-grid system. Same mock catalog throughout.</p>
        </div>
        <ConceptD active={active} setActive={setActive} />
        <ConceptE active={active} setActive={setActive} />
        <ConceptF active={active} setActive={setActive} />
        <div className="border-t pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Round 3 — landing refresh.</h2>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">Three takes on the live homepage: motion-first aura, trust-first proof ledger, and a stripped-back gallery. Same mock catalog throughout.</p>
        </div>
        <ConceptG active={active} setActive={setActive} />
        <ConceptH active={active} setActive={setActive} />
        <ConceptI active={active} setActive={setActive} />
        <div className="border-t pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Round 4 — landing refinements.</h2>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">Same layout as the live page, pushed three ways: executive restraint, social punch, commerce proof. Gibun product throughout for a like-for-like read.</p>
        </div>
        <ConceptJ active={active} setActive={setActive} />
        <ConceptK active={active} setActive={setActive} />
        <ConceptL active={active} setActive={setActive} />
      </main>
    </div>
  );
}

function Intro() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Three directions, pick a winner.</h1>
      <p className="text-sm text-zinc-600 mt-2">
        Each concept keeps your brief: URL input on the left, single preview on the right that fits the viewport,
        Instagram carousel first, deduped visuals, brand-tinted accents. Scroll to compare, then tell me which to apply to <code className="bg-white border px-1 rounded">/</code>.
      </p>
    </div>
  );
}

function ConceptShell({
  id, index, title, blurb, children, picked, onPick,
}: {
  id: string; index: string; title: string; blurb: string;
  children: React.ReactNode; picked: boolean; onPick: () => void;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-xs font-mono bg-zinc-900 text-white rounded-full px-2.5 py-1">{index}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <button
          onClick={onPick}
          className={`ml-auto text-xs px-4 py-2 rounded-full font-medium border ${picked ? "bg-green-600 text-white border-green-600" : "bg-white hover:border-zinc-500"}`}
        >
          {picked ? "✓ My pick" : "Pick this"}
        </button>
      </div>
      <p className="text-[13px] text-zinc-600 mb-4 max-w-3xl">{blurb}</p>
      <div className="rounded-3xl overflow-hidden border shadow-sm">{children}</div>
    </section>
  );
}

/* ————————————————— Concept A: Atelier Editorial —————————————————
   Warm paper, ink text, botanical green accent, serif display + mono meta.
   Airy, thin rules, gallery-mat preview. Calm trust for yoga/tea/beauty. */
function ConceptA({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const accent = "#1f4d2e";
  return (
    <ConceptShell
      id="concept-a" index="A" title="Atelier Editorial"
      blurb="Warm paper background, ink serif headlines, one botanical green used sparingly. Thin hairline rules, generous whitespace, small-caps vendor lines. Feels like a gallery wall — good for Lotuscrafts, Gibun, slow brands."
      picked={active === "a"} onPick={() => setActive(active === "a" ? null : "a")}
    >
      <div className="h-[620px] grid grid-cols-[340px_1fr]" style={{ background: "#f6f2ea" }}>
        <aside className="p-7 flex flex-col gap-5 border-r" style={{ borderColor: "#e7dfd2", background: "#fdfbf7" }}>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: accent }}>Catalog Forge — Nº 01</div>
          <h3 className="font-serif text-[34px] leading-[1.02]" style={{ color: "#1c1b1a", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Your products,<br /><em style={{ color: accent }}>dressed for Meta.</em>
          </h3>
          <div className="flex rounded-full border bg-white p-1.5" style={{ borderColor: "#e7dfd2" }}>
            <span className="flex-1 px-3 py-2 font-mono text-xs text-zinc-700">lotuscrafts.com</span>
            <span className="px-4 py-2 rounded-full text-white text-xs" style={{ background: accent }}>→</span>
          </div>
          <div className="border-t pt-4" style={{ borderColor: "#e7dfd2" }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Maison — Lotuscrafts</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              <span className="text-xs">86 products · 5 unique visuals</span>
            </div>
          </div>
          <div className="flex gap-1.5 text-[11px]">
            <span className="px-3 py-1.5 rounded-full text-white" style={{ background: "#1c1b1a" }}>Clean Minimal</span>
            <span className="px-3 py-1.5 rounded-full border bg-white" style={{ borderColor: "#e7dfd2" }}>Dark</span>
            <span className="px-3 py-1.5 rounded-full border bg-white" style={{ borderColor: "#e7dfd2" }}>Sale</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-auto">
            {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.img} alt="" className={`w-full h-12 object-cover rounded-lg border ${i === 0 ? "ring-2" : ""}`} style={i === 0 ? { ["--tw-ring-color" as string]: accent } : { borderColor: "#e7dfd2" }} />
            ))}
          </div>
          <div className="rounded-full text-center text-white text-sm py-3" style={{ background: accent }}>Customize →</div>
        </aside>
        <div className="p-8 flex items-center justify-center" style={{ background: "radial-gradient(circle at 50% 30%, #fffdf8, #f1ebe0)" }}>
          <div className="bg-white rounded-2xl shadow-[0_24px_60px_-24px_rgba(28,27,26,0.25)] overflow-hidden w-[560px] border" style={{ borderColor: "#e7dfd2" }}>
            <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: "#efe8da" }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-serif" style={{ background: accent }}>L</span>
              <div>
                <div className="text-[13px] font-semibold">Lotuscrafts</div>
                <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Sponsored · Carousel</div>
              </div>
              <span className="ml-auto font-mono text-[10px] px-2 py-1 rounded-full" style={{ background: "#eef3ec", color: accent }}>1:1 · 4:5 · 9:16</span>
            </div>
            <div className="flex">
              {MOCK_PRODUCTS.map((p) => (
                <div key={p.id} className="flex-1 border-r last:border-r-0 p-4" style={{ borderColor: "#f0e9db" }}>
                  <div className="rounded-xl overflow-hidden" style={{ background: "#f4f1e8" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase mt-3 text-center" style={{ color: accent }}>{p.vendor}</div>
                  <div className="font-serif text-[15px] text-center leading-tight mt-0.5" style={{ fontFamily: "Georgia, serif" }}>{p.title}</div>
                  <div className="mx-auto w-fit mt-2 text-[11px] font-mono text-white rounded-full px-2.5 py-1" style={{ background: "#1c1b1a" }}>{p.price}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-zinc-500 border-t" style={{ borderColor: "#efe8da" }}>
              <span>♡ 214</span><span>💬 18</span>
              <span className="mx-auto flex gap-1"><span className="w-4 h-1 rounded-full" style={{ background: accent }} /><span className="w-1 h-1 rounded-full bg-zinc-300" /><span className="w-1 h-1 rounded-full bg-zinc-300" /></span>
              <span className="font-mono text-[10px]"><Stars /> Free shipping</span>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept B: Nocturne Studio —————————————————
   Near-black canvas, lime signal + violet depth, grotesk/mono, grid lines.
   High-contrast, glow carousel. Nike-dark-gradient energy for street/sport. */
function ConceptB({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const lime = "#d6ff3f";
  return (
    <ConceptShell
      id="concept-b" index="B" title="Nocturne Studio"
      blurb="Near-black canvas with a lime signal color and violet depth. Mono labels, grid backdrop, glowing carousel track. Built for thumb-stop in dark feeds — sport, streetwear, premium tech."
      picked={active === "b"} onPick={() => setActive(active === "b" ? null : "b")}
    >
      <div className="h-[620px] grid grid-cols-[340px_1fr]" style={{ background: "#0a0a0e" }}>
        <aside className="p-6 flex flex-col gap-4 border-r border-white/10 text-white">
          <div className="font-mono text-[10px] tracking-[0.25em] text-white/50">CF_02 // SIGNAL</div>
          <h3 className="text-[32px] font-extrabold leading-[0.95] tracking-tight">
            RAW FEED<br /><span style={{ color: lime }}>SCALED ×12.</span>
          </h3>
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1.5">
            <span className="flex-1 px-3 py-2 font-mono text-xs text-white/80">lotuscrafts.com</span>
            <span className="px-4 py-2 rounded-lg text-black text-xs font-bold" style={{ background: lime }}>RUN →</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black" style={{ background: lime }}>L</span>
            <div className="flex-1">
              <div className="text-[13px] font-bold">LOTUSCRAFTS</div>
              <div className="font-mono text-[10px] text-white/50">86 SKU · 05 UNIQUE · 1:1/4:5/9:16</div>
            </div>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: lime }} />
          </div>
          <div className="flex gap-1.5 font-mono text-[11px]">
            <span className="px-3 py-1.5 rounded-full text-black font-bold" style={{ background: lime }}>MINIMAL</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-white/70">DARK</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-white/70">SALE</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-auto">
            {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.img} alt="" className="w-full h-12 object-cover rounded-md border border-white/10" style={i === 0 ? { outline: `2px solid ${lime}` } : undefined} />
            ))}
          </div>
          <div className="rounded-xl text-center text-black text-sm font-bold py-3" style={{ background: lime }}>Customize carousel →</div>
        </aside>
        <div className="p-8 flex items-center justify-center relative overflow-hidden" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(139,92,246,0.25), transparent), #0a0a0e" }}>
          <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
          <div className="relative bg-[#121218] rounded-2xl overflow-hidden w-[580px] border border-white/10 shadow-[0_0_80px_-20px_rgba(214,255,63,0.35)]">
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-white/10 text-white">
              <span className="w-8 h-8 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${lime}, #8b5cf6)` }}>
                <span className="w-full h-full rounded-full bg-black flex items-center justify-center text-xs font-bold">L</span>
              </span>
              <div>
                <div className="text-[13px] font-bold">lotuscrafts <span className="text-white/40 font-normal">• Sponsored</span></div>
                <div className="font-mono text-[10px] text-white/50">CAROUSEL — 03/12 · SWIPE →</div>
              </div>
              <span className="ml-auto font-mono text-[10px] px-2 py-1 rounded" style={{ background: lime, color: "#000" }}>75% SPEND → CATALOG</span>
            </div>
            <div className="flex">
              {MOCK_PRODUCTS.map((p, i) => (
                <div key={p.id} className="flex-1 border-r border-white/10 last:border-r-0 p-3" style={i === 1 ? { background: "rgba(214,255,63,0.05)" } : undefined}>
                  <div className="rounded-lg overflow-hidden bg-gradient-to-b from-white/10 to-transparent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                  </div>
                  <div className="font-mono text-[9px] text-white/50 mt-2">0{i + 1} — {p.vendor.toUpperCase()}</div>
                  <div className="text-white text-[14px] font-bold leading-tight">{p.title}</div>
                  <div className="mt-1.5 inline-block font-mono text-[11px] font-bold text-black rounded px-2 py-0.5" style={{ background: lime }}>{p.price}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 flex items-center text-white/60 text-xs border-t border-white/10">
              <span>♡ 1.2k</span><span className="ml-3">💬 84</span>
              <span className="mx-auto flex gap-1"><span className="w-5 h-1 rounded-full" style={{ background: lime }} /><span className="w-1 h-1 rounded-full bg-white/30" /><span className="w-1 h-1 rounded-full bg-white/30" /><span className="w-1 h-1 rounded-full bg-white/30" /></span>
              <span className="font-mono text-[10px] text-white/40">ANDROMEDA-READY · BROAD</span>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept C: Confect Candy —————————————————
   Cream canvas, tangerine + berry, extra-rounded sticker cards, chunky pills.
   Friendly, complete-card (trust→value→price) energy for gifts/kids/food. */
function ConceptC({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const tang = "#ff5c1a";
  const berry = "#a51c5b";
  return (
    <ConceptShell
      id="concept-c" index="C" title="Candy Commerce"
      blurb="Cream canvas, tangerine pop with berry depth, sticker-style cards and chunky price pills. Trust row (stars + free shipping) baked into every card — the complete côte&ciel / Sparfönster card. Warmest, most clickable."
      picked={active === "c"} onPick={() => setActive(active === "c" ? null : "c")}
    >
      <div className="h-[620px] grid grid-cols-[340px_1fr]" style={{ background: "#fff7ee" }}>
        <aside className="p-6 flex flex-col gap-4 bg-white border-r-2 border-dashed" style={{ borderColor: "#f3e2cc" }}>
          <div className="inline-flex w-fit items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full text-white" style={{ background: berry }}>✨ New · Catalog → Ads in 30s</div>
          <h3 className="text-[30px] font-black leading-[1.0] tracking-tight" style={{ color: "#2b1408" }}>
            Paste it.<br />Post it. <span style={{ color: tang }}>Sell it.</span>
          </h3>
          <div className="flex rounded-2xl border-2 p-1.5 bg-[#fffdf8]" style={{ borderColor: "#2b1408" }}>
            <span className="flex-1 px-3 py-2 font-mono text-xs">lotuscrafts.com</span>
            <span className="px-5 py-2 rounded-xl text-white text-xs font-black" style={{ background: tang }}>Go 🍊</span>
          </div>
          <div className="rounded-2xl p-3 flex items-center gap-2.5 text-white" style={{ background: "#2b1408" }}>
            <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-lg">🧘</span>
            <div>
              <div className="text-[13px] font-black">Lotuscrafts</div>
              <div className="text-[11px] opacity-70">86 products · <Stars /> 4.9 · Free shipping</div>
            </div>
          </div>
          <div className="flex gap-1.5 text-[11px] font-bold">
            <span className="px-3 py-1.5 rounded-full text-white" style={{ background: tang }}>Minimal 🍑</span>
            <span className="px-3 py-1.5 rounded-full bg-[#fbeedf] border border-[#f3e2cc]">Dark 🌙</span>
            <span className="px-3 py-1.5 rounded-full bg-[#fbeedf] border border-[#f3e2cc]">Sale 🏷️</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-auto">
            {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.img} alt="" className="w-full h-12 object-cover rounded-xl border-2" style={{ borderColor: i === 0 ? tang : "#f3e2cc" }} />
            ))}
          </div>
          <div className="rounded-2xl text-center text-white text-sm font-black py-3 shadow-[0_6px_0_#2b1408]" style={{ background: tang }}>Customize my carousel →</div>
        </aside>
        <div className="p-8 flex items-center justify-center" style={{ background: "radial-gradient(circle at 20% 10%, #ffe9d2, transparent 55%), radial-gradient(circle at 90% 90%, #ffd9e4, transparent 50%), #fff7ee" }}>
          <div className="bg-white rounded-[26px] overflow-hidden w-[580px] border-2 shadow-[0_18px_0_-8px_#2b1408]" style={{ borderColor: "#2b1408" }}>
            <div className="px-4 py-3 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2" style={{ borderColor: "#2b1408", background: "#ffe9d2" }}>🧘</span>
              <div>
                <div className="text-[13px] font-black">lotuscrafts <span className="font-normal text-zinc-400">• Sponsored</span></div>
                <div className="text-[11px] text-zinc-500"><Stars /> 4.9 · Free shipping over €50</div>
              </div>
              <span className="ml-auto text-[11px] font-black text-white rounded-full px-3 py-1.5 -rotate-3" style={{ background: berry }}>SALE −20%</span>
            </div>
            <div className="flex gap-3 px-4 pb-2">
              {MOCK_PRODUCTS.map((p) => (
                <div key={p.id} className="flex-1 rounded-2xl border-2 overflow-hidden bg-[#fffdf8]" style={{ borderColor: "#f3e2cc" }}>
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                    <span className="absolute top-2 left-2 text-[10px] font-black text-white rounded-full px-2 py-1 -rotate-6" style={{ background: tang }}>−20%</span>
                  </div>
                  <div className="p-2.5 text-center">
                    <div className="text-[13px] font-black leading-tight">{p.title}</div>
                    <div className="text-[11px] text-zinc-500 line-through">€29.95</div>
                    <div className="inline-block text-[12px] font-black text-white rounded-full px-3 py-1 mt-0.5" style={{ background: "#2b1408" }}>{p.price}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex items-center text-xs text-zinc-500">
              <span>♡ 486</span><span className="ml-3">💬 32</span><span className="ml-3">↗</span>
              <span className="mx-auto flex gap-1.5"><span className="w-5 h-2 rounded-full" style={{ background: tang }} /><span className="w-2 h-2 rounded-full bg-[#f3e2cc]" /><span className="w-2 h-2 rounded-full bg-[#f3e2cc]" /></span>
              <span className="font-bold" style={{ color: berry }}>Shop now →</span>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept D: Porcelain Signal —————————————————
   A's porcelain paper + serif, B's mono eyebrow + single lime signal.
   Light and safe, but alive: signal only on live/selected/price-tick. */
function ConceptD({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const ink = "#191712";
  const moss = "#3a5a1e";
  const signal = "#c8f04a";
  return (
    <ConceptShell
      id="concept-d" index="D" title="Porcelain Signal"
      blurb="A's warm porcelain base and serif headlines, with B reduced to a single lime signal: status dot, active pill, price tick, progress bar. Light-mode safe for conservative retailers, still feels engineered."
      picked={active === "d"} onPick={() => setActive(active === "d" ? null : "d")}
    >
      <div className="h-[620px] grid grid-cols-[340px_1fr]" style={{ background: "#fbfaf6" }}>
        <aside className="p-7 flex flex-col gap-4 border-r bg-white" style={{ borderColor: "#e9e4d6" }}>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-zinc-500">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: moss }} />
            CF_04 // LIVE_PREVIEW
          </div>
          <h3 className="text-[32px] leading-[1.0] tracking-tight" style={{ color: ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Safe canvas,<br /><span className="italic" style={{ color: moss }}>live signal.</span>
          </h3>
          <div className="flex rounded-full border-2 bg-white p-1" style={{ borderColor: ink }}>
            <span className="flex-1 px-3 py-2 font-mono text-xs">lotuscrafts.com</span>
            <span className="px-4 py-2 rounded-full text-xs font-bold" style={{ background: signal, color: ink }}>→</span>
          </div>
          <div className="rounded-2xl border p-3 flex items-center gap-2.5" style={{ borderColor: "#e9e4d6", background: "#fbfaf6" }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center font-serif text-white" style={{ background: moss }}>L</span>
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Lotuscrafts</div>
              <div className="font-mono text-[10px] text-zinc-500">86 SKU · 05 UNIQUE · DEDUPED ✓</div>
            </div>
          </div>
          <div className="flex gap-1.5 font-mono text-[11px]">
            <span className="px-3 py-1.5 rounded-full font-bold" style={{ background: ink, color: signal }}>MINIMAL</span>
            <span className="px-3 py-1.5 rounded-full border text-zinc-600">DARK</span>
            <span className="px-3 py-1.5 rounded-full border text-zinc-600">SALE</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-auto">
            {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.img} alt="" className="w-full h-12 object-cover rounded-lg border" style={i === 0 ? { outline: `2px solid ${moss}`, borderColor: moss } : { borderColor: "#e9e4d6" }} />
            ))}
          </div>
          <div className="rounded-full text-center text-sm font-bold py-3 text-white" style={{ background: ink }}>Customize →</div>
        </aside>
        <div className="p-8 flex items-center justify-center" style={{ background: "linear-gradient(180deg, #fbfaf6, #f1ecdd)" }}>
          <div className="bg-white rounded-2xl overflow-hidden w-[580px] border shadow-[0_20px_50px_-24px_rgba(25,23,18,0.3)]" style={{ borderColor: "#e9e4d6" }}>
            <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: "#efe9d8" }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-serif" style={{ background: moss }}>L</span>
              <div>
                <div className="text-[13px] font-semibold">lotuscrafts <span className="font-mono text-[10px] text-zinc-400">• Sponsored</span></div>
                <div className="font-mono text-[10px] text-zinc-500">CAROUSEL · <span style={{ color: moss }}>● LIVE</span> · SWIPE →</div>
              </div>
              <span className="ml-auto font-mono text-[10px] font-bold px-2 py-1 rounded" style={{ background: signal, color: ink }}>ENRICHED ✓</span>
            </div>
            <div className="flex">
              {MOCK_PRODUCTS.map((p, i) => (
                <div key={p.id} className="flex-1 border-r last:border-r-0 p-4" style={{ borderColor: "#f0ead9", background: i === 0 ? "#fbf8ef" : "#fff" }}>
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#eee7d3" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.18em] uppercase mt-2.5" style={{ color: moss }}>{p.vendor}</div>
                  <div className="text-[14px] font-semibold leading-tight" style={{ fontFamily: "Georgia, serif" }}>{p.title}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-white rounded-full px-2.5 py-1" style={{ background: ink }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: signal }} />{p.price}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 flex items-center text-xs text-zinc-500 border-t" style={{ borderColor: "#efe9d8" }}>
              <span>♡ 214</span><span className="ml-3">💬 18</span>
              <span className="mx-auto flex gap-1"><span className="w-5 h-1 rounded-full" style={{ background: moss }} /><span className="w-1 h-1 rounded-full bg-zinc-300" /><span className="w-1 h-1 rounded-full bg-zinc-300" /></span>
              <span className="font-mono text-[10px]"><Stars /> 4.9</span>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept E: Soft Nocturne —————————————————
   B's dark canvas warmed to espresso, lime cooled to moss-gold,
   A's serif display on dark. Premium calm for food/beauty/wellness. */
function ConceptE({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const bg = "#171310";
  const panel = "#211b14";
  const cream = "#f3ecdd";
  const gold = "#dfa63f";
  const sage = "#9fb87a";
  return (
    <ConceptShell
      id="concept-e" index="E" title="Soft Nocturne"
      blurb="Nocturne warmed up: espresso instead of blue-black, cream instead of white, muted gold + sage instead of lime. Serif headlines on dark keep A's calm. Premium without the streetwear shout — Demel, beauty, tea."
      picked={active === "e"} onPick={() => setActive(active === "e" ? null : "e")}
    >
      <div className="h-[620px] grid grid-cols-[340px_1fr]" style={{ background: bg }}>
        <aside className="p-7 flex flex-col gap-4 border-r border-white/10 text-white" style={{ color: cream }}>
          <div className="font-mono text-[10px] tracking-[0.22em]" style={{ color: sage }}>ATELIER — NOCTURNE Nº 05</div>
          <h3 className="text-[32px] leading-[1.0]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Evening light,<br /><em style={{ color: gold }}>morning sales.</em>
          </h3>
          <div className="flex rounded-full p-1.5 border border-white/15" style={{ background: panel }}>
            <span className="flex-1 px-3 py-2 font-mono text-xs text-white/75">lotuscrafts.com</span>
            <span className="px-4 py-2 rounded-full text-xs font-bold" style={{ background: gold, color: "#241a08" }}>→</span>
          </div>
          <div className="rounded-2xl border border-white/10 p-3 flex items-center gap-2.5" style={{ background: panel }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center font-serif" style={{ background: gold, color: "#241a08" }}>L</span>
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Lotuscrafts</div>
              <div className="font-mono text-[10px] text-white/50">86 products · <Stars /> 4.9</div>
            </div>
          </div>
          <div className="flex gap-1.5 text-[11px]">
            <span className="px-3 py-1.5 rounded-full font-bold" style={{ background: cream, color: bg }}>Minimal</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-white/70">Dark</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-white/70">Sale</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-auto">
            {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.img} alt="" className="w-full h-12 object-cover rounded-lg border border-white/10" style={i === 0 ? { outline: `2px solid ${gold}` } : undefined} />
            ))}
          </div>
          <div className="rounded-full text-center text-sm font-bold py-3" style={{ background: gold, color: "#241a08" }}>Customize →</div>
        </aside>
        <div className="p-8 flex items-center justify-center" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(223,166,63,0.16), transparent), ${bg}` }}>
          <div className="rounded-3xl overflow-hidden w-[580px] border border-white/10 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)]" style={{ background: panel }}>
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-white/10">
              <span className="w-8 h-8 rounded-full flex items-center justify-center font-serif" style={{ background: gold, color: "#241a08" }}>L</span>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: cream }}>lotuscrafts <span className="font-normal text-white/40">• Sponsored</span></div>
                <div className="font-mono text-[10px]" style={{ color: sage }}>CAROUSEL · SMALL-BATCH · SWIPE →</div>
              </div>
              <span className="ml-auto font-mono text-[10px] px-2 py-1 rounded-full border border-white/15 text-white/70">1:1 · 4:5 · 9:16</span>
            </div>
            <div className="flex">
              {MOCK_PRODUCTS.map((p) => (
                <div key={p.id} className="flex-1 border-r border-white/10 last:border-r-0 p-4">
                  <div className="rounded-2xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase mt-2.5" style={{ color: sage }}>{p.vendor}</div>
                  <div className="text-[15px] leading-tight" style={{ color: cream, fontFamily: "Georgia, serif" }}>{p.title}</div>
                  <div className="mt-1.5 inline-block font-mono text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: cream, color: bg }}>{p.price}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 flex items-center text-xs border-t border-white/10" style={{ color: "rgba(243,236,221,0.6)" }}>
              <span>♡ 486</span><span className="ml-3">💬 32</span>
              <span className="mx-auto flex gap-1"><span className="w-5 h-1 rounded-full" style={{ background: gold }} /><span className="w-1 h-1 rounded-full bg-white/20" /><span className="w-1 h-1 rounded-full bg-white/20" /></span>
              <span className="font-mono text-[10px]">FREE SHIPPING · SMALL-BATCH</span>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept F: Gallery Grid —————————————————
   Split system: ink utility bar + paper body, faint 12-col grid from B,
   cobalt workwear accent. Most retailer-safe: reads as tool, not artwork. */
function ConceptF({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const ink = "#101014";
  const cobalt = "#2b4eff";
  return (
    <ConceptShell
      id="concept-f" index="F" title="Gallery Grid"
      blurb="The compromise candidate: ink header bar and mono numbering from B, paper body and serif titles from A, one trustworthy cobalt for selection. Faint grid shows the system. Reads as reliable software — easiest yes for agencies."
      picked={active === "f"} onPick={() => setActive(active === "f" ? null : "f")}
    >
      <div className="h-[620px] flex flex-col" style={{ background: "#f4f2ec" }}>
        <div className="flex items-center gap-3 px-6 py-2.5 text-white font-mono text-[10px] tracking-[0.18em]" style={{ background: ink }}>
          <span>CATALOG FORGE</span><span className="opacity-40">/</span><span className="opacity-70">LOTUSCRAFTS.COM</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: cobalt }} /> 86 CONNECTED</span>
          <span className="opacity-60">1:1 · 4:5 · 9:16</span>
        </div>
        <div className="flex-1 grid grid-cols-[340px_1fr] min-h-0">
          <aside className="p-6 flex flex-col gap-4 bg-white border-r" style={{ borderColor: "#e3ded0" }}>
            <h3 className="text-[28px] font-semibold tracking-tight leading-[1.0]">
              Input left.<br /><span style={{ color: cobalt }}>Preview right.</span>
            </h3>
            <div className="flex rounded-xl border-2 p-1 bg-white" style={{ borderColor: ink }}>
              <span className="flex-1 px-3 py-2 font-mono text-xs">lotuscrafts.com</span>
              <span className="px-4 py-2 rounded-lg text-white text-xs font-bold" style={{ background: cobalt }}>→</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
              <span className="px-2 py-1.5 rounded-lg text-white text-center font-bold" style={{ background: ink }}>01 MIN</span>
              <span className="px-2 py-1.5 rounded-lg border text-center text-zinc-600">02 DRK</span>
              <span className="px-2 py-1.5 rounded-lg border text-center text-zinc-600">03 SAL</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-auto">
              {MOCK_PRODUCTS.concat(MOCK_PRODUCTS.slice(0, 2)).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.img} alt="" className="w-full h-12 object-cover rounded-md border-2" style={{ borderColor: i === 0 ? cobalt : "#e3ded0" }} />
              ))}
            </div>
            <div className="rounded-xl text-center text-white text-sm font-bold py-3" style={{ background: ink }}>Customize 01 →</div>
          </aside>
          <div className="p-7 flex items-center justify-center relative" style={{ backgroundImage: "linear-gradient(rgba(16,16,20,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,16,20,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px" }}>
            <div className="bg-white rounded-2xl overflow-hidden w-[580px] border shadow-[0_16px_40px_-20px_rgba(16,16,20,0.25)]" style={{ borderColor: "#e3ded0" }}>
              <div className="px-4 py-2.5 flex items-center gap-2.5 border-b font-mono text-[10px] text-zinc-500" style={{ borderColor: "#ece7d7" }}>
                <span className="font-bold text-zinc-900">IG / CAROUSEL_01</span>
                <span className="ml-auto flex gap-1"><span className="w-4 h-1 rounded-full" style={{ background: cobalt }} /><span className="w-1 h-1 rounded-full bg-zinc-300" /><span className="w-1 h-1 rounded-full bg-zinc-300" /></span>
                <span>LOTUSCRAFTS • SPONSORED</span>
              </div>
              <div className="flex">
                {MOCK_PRODUCTS.map((p, i) => (
                  <div key={p.id} className="flex-1 border-r last:border-r-0 p-4" style={{ borderColor: "#ece7d7", background: i === 0 ? "#f6f8ff" : "#fff" }}>
                    <div className="font-mono text-[10px] mb-2" style={{ color: cobalt }}>0{i + 1}</div>
                    <div className="rounded-lg overflow-hidden bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.img} alt="" className="w-full aspect-square object-cover" />
                    </div>
                    <div className="text-[14px] font-semibold leading-tight mt-2" style={{ fontFamily: "Georgia, serif" }}>{p.title}</div>
                    <div className="font-mono text-[11px] mt-1"><span className="text-zinc-400 line-through">€29.95</span> <span className="font-bold text-white rounded px-1.5 py-0.5" style={{ background: ink }}>{p.price}</span></div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 flex items-center text-[11px] text-zinc-500 border-t font-mono" style={{ borderColor: "#ece7d7" }}>
                <span>♡ 214 · 💬 18 · ↗</span>
                <span className="ml-auto">GRID 12-COL · DEDUPED ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept G: Aura Carousel —————————————————
   Motion-first: porcelain with peach/lavender aura wash, tilted floating
   phone, live swipe counter. Sells the carousel, not the form. */
function ConceptG({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const ink = "#1c1a15";
  const moss = "#3a5a1e";
  return (
    <ConceptShell
      id="concept-g" index="G" title="Aura Carousel"
      blurb="Motion-first landing: aura-wash backdrop, phone tilted and floating with a live 01/12 counter, headline about the swipe. Same left/right brief, but the right side feels alive."
      picked={active === "g"} onPick={() => setActive(active === "g" ? null : "g")}
    >
      <div className="h-[620px] grid grid-cols-[1fr_1fr]" style={{ background: "radial-gradient(circle at 15% 20%, #ffe7cf, transparent 55%), radial-gradient(circle at 85% 85%, #e3d9ff, transparent 55%), #fbf8f1" }}>
        <div className="p-10 flex flex-col justify-center gap-5">
          <div className="font-mono text-[10px] tracking-[0.24em] uppercase" style={{ color: moss }}>Swipe it — live catalog</div>
          <h3 className="text-[44px] leading-[0.98] tracking-tight" style={{ color: ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Watch it<br /><em style={{ color: moss }}>swipe.</em>
          </h3>
          <p className="text-sm text-zinc-600 max-w-[340px]">Paste a store URL and the phone starts swiping through your real products — one unique visual per card.</p>
          <div className="flex rounded-full border-2 bg-white p-1.5 max-w-[360px]" style={{ borderColor: ink }}>
            <span className="flex-1 px-4 py-2.5 font-mono text-xs">lotuscrafts.com</span>
            <span className="px-5 py-2.5 rounded-full text-xs font-bold text-white" style={{ background: ink }}>→</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-500">01/12 · TULSI MALA · 24.95 EUR</div>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-[280px] rounded-[48px] bg-black p-[10px] shadow-[0_40px_70px_-30px_rgba(28,26,21,0.5)]" style={{ transform: "rotate(-4deg)" }}>
            <div className="rounded-[38px] overflow-hidden bg-white">
              <div className="px-3 py-2.5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: moss }}>L</span>
                <div><div className="text-[12px] font-bold">lotuscrafts</div><div className="text-[10px] text-zinc-500">Sponsored</div></div>
                <span className="ml-auto font-mono text-[10px] px-2 py-1 rounded-full text-white" style={{ background: ink }}>1/12</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_PRODUCTS[0].img} alt="" className="w-full aspect-square object-cover" />
              <div className="px-3 py-2.5 text-[12px]"><span className="font-bold">lotuscrafts</span> Tulsi Mala ✨ <span className="text-zinc-500">#newin</span></div>
              <div className="mx-3 mb-3 rounded-xl text-center text-[12px] font-bold text-white py-2.5" style={{ background: ink }}>Shop Now → 24.95 EUR</div>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept H: Proof Ledger —————————————————
   Trust-first: ledger header, mono numerals, proof chips. For the
   performance buyer who needs numbers before beauty. */
function ConceptH({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const ink = "#1a1813";
  return (
    <ConceptShell
      id="concept-h" index="H" title="Proof Ledger"
      blurb="Content-led trust: proof chips up top (+44% ROAS, 30 visuals, 3 placements), ledger spec rows under the input, phone smaller with a ledger caption. Converts skeptics."
      picked={active === "h"} onPick={() => setActive(active === "h" ? null : "h")}
    >
      <div className="h-[620px] grid grid-cols-[1fr_1fr]" style={{ background: "#faf8f2" }}>
        <div className="p-10 flex flex-col justify-center gap-4 border-r" style={{ borderColor: "#e7e0cf" }}>
          <div className="flex gap-1.5 font-mono text-[10px] font-bold">
            <span className="px-2.5 py-1 rounded-full text-white" style={{ background: ink }}>+44% ROAS</span>
            <span className="px-2.5 py-1 rounded-full bg-white border">30 UNIQUE VISUALS</span>
            <span className="px-2.5 py-1 rounded-full bg-white border">3 PLACEMENTS</span>
          </div>
          <h3 className="text-[40px] leading-[1.0] tracking-tight" style={{ fontFamily: "Georgia, serif" }}>Your products,<br />dressed for Meta.</h3>
          <div className="flex rounded-xl border-2 bg-white p-1.5 max-w-[380px]" style={{ borderColor: ink }}>
            <span className="flex-1 px-4 py-2.5 font-mono text-xs">lotuscrafts.com</span>
            <span className="px-5 py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: ink }}>Run →</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-600 space-y-1.5 border-t pt-4" style={{ borderColor: "#e7e0cf" }}>
            <div className="flex justify-between max-w-[380px]"><span>FORMAT</span><span className="text-zinc-900 font-bold">CAROUSEL · 1:1</span></div>
            <div className="flex justify-between max-w-[380px]"><span>DEDUP</span><span className="text-zinc-900 font-bold">30 FROM 86 VARIANTS</span></div>
            <div className="flex justify-between max-w-[380px]"><span>FEED</span><span className="text-zinc-900 font-bold">0 ERRORS · DAILY SYNC</span></div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 p-8">
          <div className="w-[250px] rounded-[44px] bg-black p-[9px] shadow-xl">
            <div className="rounded-[36px] overflow-hidden bg-white">
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">L</span>
                <div className="text-[11px] font-bold">lotuscrafts · <span className="font-normal text-zinc-500">Sponsored</span></div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_PRODUCTS[1].img} alt="" className="w-full aspect-square object-cover" />
              <div className="px-3 py-2 text-[11px]"><span className="font-bold">2,314 likes</span> · Rudraksha Mala ✨</div>
            </div>
          </div>
          <div className="font-mono text-[10px] text-zinc-500">FIG. 01 — CAROUSEL CARD 02/12 · 1:1 · ENRICHED</div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————————————— Concept I: Atelier OK —————————————————
   Stripped-back gallery: huge whitespace, giant serif, one pill, one link,
   jewel-sized phone. Quietest and most confident of the set. */
function ConceptI({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  const ink = "#191712";
  return (
    <ConceptShell
      id="concept-i" index="I" title="Atelier OK"
      blurb="The minimalist: giant serif, a single URL pill, a text-link CTA, and a small jewel phone on an empty gallery wall. Maximum whitespace — for brands that hate dashboards."
      picked={active === "i"} onPick={() => setActive(active === "i" ? null : "i")}
    >
      <div className="h-[620px] grid grid-cols-[1.2fr_1fr] bg-white">
        <div className="p-14 flex flex-col justify-center">
          <h3 className="text-[56px] leading-[0.95] tracking-tight" style={{ color: ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Your products,<br /><em>dressed for Meta.</em>
          </h3>
          <div className="flex items-center gap-2 mt-8 border-b pb-3 max-w-[380px]" style={{ borderColor: "#e9e4d6" }}>
            <span className="flex-1 font-mono text-sm text-zinc-700">lotuscrafts.com</span>
            <span className="text-xl">→</span>
          </div>
          <span className="mt-4 text-sm underline underline-offset-8 decoration-1">See it in the phone →</span>
        </div>
        <div className="flex items-center justify-center" style={{ background: "#f6f3ec" }}>
          <div className="w-[230px] rounded-[44px] bg-black p-[9px] shadow-[0_30px_60px_-30px_rgba(25,23,18,0.4)]">
            <div className="rounded-[36px] overflow-hidden bg-white">
              <div className="px-3 py-2 text-[11px] font-bold">lotuscrafts <span className="font-normal text-zinc-400">• Sponsored</span></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_PRODUCTS[2].img} alt="" className="w-full aspect-square object-cover" />
              <div className="px-3 py-2 text-[11px]"><span className="font-bold">Yoga Bolster</span> · 59.00 EUR</div>
            </div>
          </div>
        </div>
      </div>
    </ConceptShell>
  );
}

/* ————————— Round 4: landing refinements (J/K/L) —————————
   Same brief as the live page: airy left half, phone cutout right,
   Gibun product for a like-for-like read. One parametric mock. */

const GIBUN_IMG = "https://picsum.photos/seed/gibun-apricot/700/700";

function LandingSimilar({ variant }: { variant: "j" | "k" | "l" }) {
  const ink = "#191712";
  const moss = "#3a5a1e";
  const signal = "#c8f04a";
  const tang = "#e8590c";

  if (variant === "k") {
    // K — SOCIAL PUNCH: porcelain left, ink stage right, lime glow phone.
    return (
      <div className="grid grid-cols-2">
        <div className="flex flex-col justify-center p-10 gap-4 bg-white">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase flex items-center gap-2" style={{ color: moss }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: moss }} /> LIVE · SHOPIFY → INSTAGRAM AD
          </div>
          <h3 className="text-[40px] leading-[0.95] font-black tracking-tight" style={{ color: ink }}>
            YOUR PRODUCTS.<br /><span style={{ background: signal, padding: "0 8px" }}>DRESSED FOR META.</span>
          </h3>
          <p className="text-[13.5px] text-zinc-600 max-w-[360px]">Paste a store URL. The phone starts selling — loud enough to stop the scroll.</p>
          <div className="flex rounded-2xl bg-zinc-100 p-1.5 max-w-[400px]">
            <span className="flex-1 px-4 py-2.5 font-mono text-xs">store.gibun.at</span>
            <span className="px-6 py-2.5 rounded-xl text-xs font-black" style={{ background: ink, color: signal }}>GO →</span>
          </div>
          <div className="flex gap-2 text-[12px] font-bold">
            {["Carousel", "Feed", "Portrait", "Story"].map((s, i) => (
              <span key={s} className="px-3.5 py-1.5 rounded-full border-2" style={i === 0 ? { background: signal, borderColor: ink, color: ink } : { borderColor: ink, color: ink }}>{s}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-[14px] px-7 py-3.5 rounded-2xl font-black" style={{ background: signal, color: ink, boxShadow: `5px 5px 0 ${ink}` }}>Customize →</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-8" style={{ background: `radial-gradient(circle at 50% 35%, rgba(200,240,74,0.28), transparent 60%), #14120d` }}>
          <div className="relative shrink-0" style={{ width: 292, filter: "drop-shadow(0 0 34px rgba(200,240,74,0.45))", transform: "rotate(2.5deg)" }}>
            <div className="absolute inset-0 rounded-[52px] bg-black border-2" style={{ borderColor: signal }} />
            <div className="absolute rounded-[42px] overflow-hidden bg-white flex flex-col" style={{ inset: 10 }}>
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[86px] h-[23px] bg-black rounded-full z-30" />
              <div className="flex items-center gap-2 px-2.5 pt-9 pb-1.5">
                <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-black text-white" style={{ background: moss }}>G</span>
                <div className="leading-tight"><div className="text-[12px] font-black">gibunat 🔥</div><div className="text-[10.5px] text-zinc-500">Sponsored</div></div>
                <span className="ml-auto font-mono text-[9px] font-black px-2 py-1 rounded" style={{ background: signal }}>AD</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GIBUN_IMG} alt="" className="w-full aspect-[4/3] object-cover" />
              <div className="px-3 py-2 text-center" style={{ background: ink }}>
                <div className="text-[11.5px] font-black text-white leading-tight">APRICOT ECLIPSE — 17.00 EUR</div>
                <div className="inline-block mt-1 text-[10px] font-black rounded-full px-3 py-1" style={{ background: signal, color: ink }}>SHOP NOW →</div>
              </div>
              <div className="px-2.5 py-2 flex items-center text-[18px]">
                <span>❤</span><span className="ml-2 opacity-60">○</span><span className="ml-2 opacity-60">➤</span>
                <span className="mx-auto flex gap-1"><span className="h-[6px] rounded-full" style={{ width: 16, background: "#3897f0" }} /><span className="w-[6px] h-[6px] rounded-full bg-zinc-300" /><span className="w-[6px] h-[6px] rounded-full bg-zinc-300" /></span>
                <span className="opacity-60">▱</span>
              </div>
              <div className="px-2.5 pb-3 text-[11.5px]"><span className="font-black">12.4k likes</span> · <span className="font-bold">gibunat</span> DROPPED ✨ <span style={{ color: moss }}>#gibunat #viral #newin</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "l") {
    // L — MARKET COMMERCE: warm cream + tangerine, sticker badge, proof ledger.
    return (
      <div className="grid grid-cols-2" style={{ background: "#fff8ef" }}>
        <div className="flex flex-col justify-center p-10 gap-4">
          <div className="inline-flex w-fit items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full text-white" style={{ background: tang }}>★ 4.9 · 2,300 reviews</div>
          <h3 className="text-[42px] leading-[1.0] tracking-tight" style={{ color: "#2b1408", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Your products,<br /><em style={{ color: tang }}>priced to move.</em>
          </h3>
          <p className="text-[13.5px] text-zinc-600 max-w-[360px]">Paste a store URL. Every card shows price, rating and shipping — the full market stall in one ad.</p>
          <div className="flex rounded-2xl border-[3px] bg-white p-1.5 max-w-[400px]" style={{ borderColor: "#2b1408" }}>
            <span className="flex-1 px-4 py-2.5 font-mono text-xs">store.gibun.at</span>
            <span className="px-5 py-2.5 rounded-xl text-xs font-black text-white" style={{ background: tang }}>Sell →</span>
          </div>
          <div className="rounded-2xl p-3 flex items-center gap-2.5 text-white max-w-[400px]" style={{ background: "#2b1408" }}>
            <span className="text-[13px] font-bold">gibun.at</span>
            <span className="text-[11px] opacity-70">31 products · ★★★★★ · Free shipping over €30</span>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-[13px] px-6 py-3 text-white rounded-2xl font-black" style={{ background: tang, boxShadow: "0 6px 0 #2b1408" }}>Customize →</span>
          </div>
          <div className="font-mono text-[10px] text-zinc-500">WAS €21.00 → NOW €17.00 · −20% TODAY · DAILY SYNC</div>
        </div>
        <div className="flex items-center justify-center p-8" style={{ background: "radial-gradient(circle at 20% 10%, #ffe3c2, transparent 55%), #fff1de" }}>
          <div className="relative shrink-0" style={{ width: 272, filter: "drop-shadow(0 24px 30px rgba(43,20,8,0.35))" }}>
            <div className="absolute inset-0 rounded-[52px]" style={{ background: "#2b1408" }} />
            <div className="absolute rounded-[42px] overflow-hidden bg-white flex flex-col" style={{ inset: 10 }}>
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[86px] h-[23px] bg-black rounded-full z-30" />
              <div className="flex items-center gap-2 px-2.5 pt-9 pb-1.5">
                <span className="w-[28px] h-[28px] rounded-full bg-orange-100 flex items-center justify-center">🍑</span>
                <div className="leading-tight"><div className="text-[11.5px] font-black">gibunat</div><div className="text-[10.5px] text-zinc-500">★★★★★ · Sponsored</div></div>
                <span className="ml-auto text-[11px] font-black text-white rounded-full px-2.5 py-1 -rotate-6" style={{ background: tang }}>−20%</span>
              </div>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={GIBUN_IMG} alt="" className="w-full aspect-[4/3] object-cover" />
                <span className="absolute bottom-2 left-2 text-[10px] font-black text-white rounded-full px-2.5 py-1" style={{ background: tang }}>BESTSELLER</span>
              </div>
              <div className="px-3 py-2 text-center">
                <div className="text-[11px] font-black leading-tight">Bio Kräutertee — APRICOT ECLIPSE</div>
                <div className="text-[10.5px] text-zinc-400 line-through">€21.00</div>
                <div className="inline-block text-[11px] font-black text-white rounded-full px-3 py-1" style={{ background: "#2b1408" }}>17.00 EUR · Free shipping</div>
              </div>
              <div className="mx-2.5 mb-2.5 rounded-xl text-center text-[12px] font-black text-white py-2.5" style={{ background: tang }}>Shop Now →</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // J — QUIET LUXURY: monochrome restraint, hairlines, small phone, no lime.
  const line = "#e3ddcc";
  return (
    <div className="grid grid-cols-2 bg-white">
      <div className="flex flex-col justify-center p-12 gap-6">
        <div className="font-mono text-[10px] uppercase" style={{ color: moss, letterSpacing: "0.32em" }}>
          Shopify → Instagram ad
        </div>
        <h3 className="text-[50px] leading-[0.98]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: ink }}>
          Your products,<br /><em>dressed for Meta.</em>
        </h3>
        <p className="text-[14px] text-zinc-500 max-w-[360px] leading-relaxed">
          Paste a store URL. A quiet, gallery-grade preview appears in the phone — nothing shouts.
        </p>
        <div className="flex items-center gap-2 border-b pb-3 max-w-[380px]" style={{ borderColor: line }}>
          <span className="flex-1 font-mono text-sm text-zinc-700">store.gibun.at</span>
          <span className="text-2xl">→</span>
        </div>
        <div className="font-mono text-[10.5px] text-zinc-400 tracking-wide">GIBUN.AT — 31 PRODUCTS — 30 VISUALS</div>
        <div className="flex gap-5 text-[13px] font-medium">
          <span className="underline underline-offset-8 decoration-2">Minimal</span>
          <span className="text-zinc-400">Dark</span>
          <span className="text-zinc-400">Sale</span>
          <span className="text-zinc-400">Carousel</span>
          <span className="text-zinc-400">Story</span>
        </div>
        <span className="text-[13px] underline underline-offset-8">Customize →</span>
      </div>
      <div className="flex items-center justify-center p-10" style={{ background: "#f4f1e9" }}>
        <div className="relative shrink-0" style={{ width: 236, filter: "drop-shadow(0 18px 24px rgba(25,23,18,0.18))" }}>
          <div className="absolute inset-0 rounded-[48px] bg-zinc-900" />
          <div className="absolute rounded-[40px] overflow-hidden bg-white flex flex-col" style={{ inset: 8 }}>
            <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[76px] h-[20px] bg-black rounded-full z-30" />
            <div className="px-3 pt-9 pb-2 text-center">
              <div className="text-[11px] font-semibold tracking-wide">gibunat</div>
              <div className="font-mono text-[9px] tracking-[0.2em] text-zinc-400">SPONSORED</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GIBUN_IMG} alt="" className="w-full aspect-square object-cover" />
            <div className="px-3 py-3 text-center">
              <div className="font-mono text-[8.5px] tracking-[0.24em]" style={{ color: moss }}>GIBUN.AT</div>
              <div className="text-[12px] mt-1" style={{ fontFamily: "Georgia, serif" }}>Apricot Eclipse</div>
              <div className="font-mono text-[10.5px] mt-1">17.00 EUR</div>
            </div>
            <div className="mx-auto pb-4 flex gap-1"><span className="w-4 h-[3px] rounded-full bg-zinc-900" /><span className="w-[3px] h-[3px] rounded-full bg-zinc-300" /><span className="w-[3px] h-[3px] rounded-full bg-zinc-300" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptJ({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  return (
    <ConceptShell
      id="concept-j" index="J" title="Quiet Luxury"
      blurb="Monochrome restraint: hairlines, underline selectors instead of pills, small phone, zero lime. For brands that flinch at neon."
      picked={active === "j"} onPick={() => setActive(active === "j" ? null : "j")}
    >
      <div className="h-[640px] overflow-hidden"><LandingSimilar variant="j" /></div>
    </ConceptShell>
  );
}

function ConceptK({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  return (
    <ConceptShell
      id="concept-k" index="K" title="Social Punch"
      blurb="Deliberate contrast: porcelain left, ink stage right, lime glow phone, shouty grotesk headline. Unmissable at thumbnail size."
      picked={active === "k"} onPick={() => setActive(active === "k" ? null : "k")}
    >
      <div className="h-[640px] overflow-hidden"><LandingSimilar variant="k" /></div>
    </ConceptShell>
  );
}

function ConceptL({ active, setActive }: { active: string | null; setActive: (v: string | null) => void }) {
  return (
    <ConceptShell
      id="concept-l" index="L" title="Market Day"
      blurb="Warm commerce: cream + tangerine, sticker badges, ratings and strikethrough pricing everywhere. Friendly market stall, not gallery."
      picked={active === "l"} onPick={() => setActive(active === "l" ? null : "l")}
    >
      <div className="h-[640px] overflow-hidden"><LandingSimilar variant="l" /></div>
    </ConceptShell>
  );
}
