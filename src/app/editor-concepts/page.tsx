"use client";

import Link from "next/link";
import { useState } from "react";

const LAYERS = [
  { id: "cta", name: "CTA Button", sub: "badge • SHOP NOW", icon: "⬢", active: false },
  { id: "price", name: "Price Badge", sub: "badge • {{price}}", icon: "⬢", active: false },
  { id: "title", name: "Title", sub: "text • {{title}}", icon: "T", active: false },
  { id: "vendor", name: "Vendor", sub: "text • {{vendor}}", icon: "T", active: false },
  { id: "img", name: "Product Image", sub: "product-image", icon: "🖼", active: true },
  { id: "bg", name: "Backdrop", sub: "shape", icon: "▭", active: false },
];

const PRODUCTS = [
  { t: "Apricot Eclipse", p: "17.00 EUR" },
  { t: "Chai Ritual", p: "19.50 EUR" },
  { t: "Berry Field", p: "16.20 EUR" },
  { t: "Milk Oolong", p: "22.00 EUR" },
  { t: "First Date", p: "18.40 EUR" },
  { t: "Midnight K", p: "21.00 EUR" },
];

function Shell({
  id, index, title, tagline, blurb, picked, onPick, children, footer,
}: {
  id: string; index: string; title: string; tagline: string; blurb: string;
  picked: boolean; onPick: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xs font-mono bg-zinc-900 text-white rounded-full px-2.5 py-1 mt-1">{index}</span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <div className="text-[13px] font-medium text-zinc-500">{tagline}</div>
        </div>
        <button
          onClick={onPick}
          className={`ml-auto shrink-0 text-xs px-4 py-2 rounded-full font-medium border ${picked ? "bg-green-600 text-white border-green-600" : "bg-white hover:border-zinc-500"}`}
        >
          {picked ? "✓ My pick" : "Pick this"}
        </button>
      </div>
      <p className="text-[13px] text-zinc-600 mb-4 max-w-3xl">{blurb}</p>
      <div className="rounded-2xl overflow-hidden border shadow-sm bg-white">{children}</div>
      <div className="mt-3">{footer}</div>
    </section>
  );
}

function Verdict({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-[12.5px]">
      <div className="rounded-xl border bg-green-50/60 border-green-200 px-4 py-3">
        <div className="font-semibold text-green-900 text-xs uppercase tracking-wider mb-1.5">What gets better</div>
        <ul className="space-y-1 text-green-950/80">{pros.map((p) => <li key={p}>✓ {p}</li>)}</ul>
      </div>
      <div className="rounded-xl border bg-amber-50/60 border-amber-200 px-4 py-3">
        <div className="font-semibold text-amber-900 text-xs uppercase tracking-wider mb-1.5">Trade-off</div>
        <ul className="space-y-1 text-amber-950/80">{cons.map((c) => <li key={c}>• {c}</li>)}</ul>
      </div>
    </div>
  );
}

function MiniCreative({ dark }: { dark?: boolean }) {
  return (
    <div className={`w-[300px] rounded-lg overflow-hidden ${dark ? "bg-[#1c1c21]" : "bg-[#fdf6e9]"} shadow-lg`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://picsum.photos/seed/gibun-apricot/600/420" alt="" className="w-full h-[190px] object-cover" />
      <div className="p-3 text-center">
        <div className={`font-mono text-[9px] tracking-[0.2em] ${dark ? "text-white/50" : "text-[#3a5a1e]"}`}>GIBUN.AT</div>
        <div className={`text-[13px] font-bold leading-tight mt-0.5 ${dark ? "text-white" : "text-zinc-900"}`}>Bio Kräutertee mit Moringa und Aprikose</div>
        <div className="flex justify-center gap-1.5 mt-2">
          <span className="text-[11px] font-bold text-white bg-zinc-900 rounded-full px-2.5 py-1">17.00 EUR</span>
          <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${dark ? "bg-[#d6ff3f] text-black" : "bg-[#2f4d1a] text-white"}`}>SHOP NOW</span>
        </div>
      </div>
      {/* selection outline */}
      <div className="pointer-events-none absolute inset-0" />
    </div>
  );
}

function ConceptA() {
  return (
    <div className="h-[640px] flex flex-col text-[12px]" style={{ background: "#0e0e11", color: "#e7e7ea" }}>
      {/* top bar */}
      <div className="h-11 flex items-center gap-2 px-3 border-b border-white/10 bg-[#141417]">
        <span className="w-6 h-6 rounded-md bg-white text-black font-black flex items-center justify-center text-[13px]">C</span>
        <span className="font-semibold text-[13px]">Forge</span>
        <span className="text-white/30">/</span>
        <span className="text-white/70">Apricot Eclipse</span>
        <span className="ml-2 font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/20">● Saved</span>
        <div className="mx-auto flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 font-mono text-[11px]">
          {["1:1", "4:5", "9:16", "1.91:1"].map((s, i) => (
            <span key={s} className={`px-2.5 py-1 rounded-md ${i === 0 ? "bg-white text-black font-bold" : "text-white/50"}`}>{s}</span>
          ))}
        </div>
        <span className="font-mono text-white/50">42%</span>
        <span className="px-2.5 py-1.5 rounded-lg bg-white text-black font-semibold">Export PNG</span>
      </div>
      <div className="flex-1 flex min-h-0">
        {/* layers */}
        <div className="w-[228px] border-r border-white/10 bg-[#141417] flex flex-col">
          <div className="p-2">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/50">
              <span>⌕</span><span>Filter layers…</span><span className="ml-auto font-mono text-[10px]">⌘F</span>
            </div>
          </div>
          <div className="px-3 py-1.5 font-mono text-[10px] tracking-widest text-white/40">LAYERS — 6</div>
          <div className="flex-1 overflow-hidden">
            {LAYERS.map((l) => (
              <div key={l.id} className={`mx-2 px-2 py-[7px] rounded-lg flex items-center gap-2 ${l.active ? "bg-[#2b5cff] text-white" : "hover:bg-white/5 text-white/80"}`}>
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${l.active ? "bg-white/20" : "bg-white/10"}`}>{l.icon}</span>
                <div className="min-w-0">
                  <div className="truncate font-medium leading-tight">{l.name}</div>
                  <div className={`truncate font-mono text-[10px] ${l.active ? "text-white/70" : "text-white/40"}`}>{l.sub}</div>
                </div>
                {l.active && <span className="ml-auto text-[10px]">◉</span>}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/10 flex gap-1.5">
            <span className="flex-1 text-center py-1.5 rounded-lg bg-white/5 border border-white/10">+ Text</span>
            <span className="flex-1 text-center py-1.5 rounded-lg bg-white/5 border border-white/10">+ Badge</span>
            <span className="flex-1 text-center py-1.5 rounded-lg bg-white/5 border border-white/10">+ Shape</span>
          </div>
        </div>
        {/* canvas */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: "radial-gradient(circle at 50% 0%, #1b1b22, #0e0e11), #0e0e11" }}>
          <div className="px-3 py-2 flex items-center gap-2">
            <span className="font-mono text-[10px] px-2 py-1 rounded bg-[#c8f04a] text-black font-bold">✦ AI</span>
            <span className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50">“make dark premium, red sale badge”… <span className="font-mono text-[10px]">⌘J</span></span>
            <span className="px-2 py-1 rounded border border-white/10 text-white/60 font-mono text-[10px]">All sizes</span>
          </div>
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
            <div className="relative">
              <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-[#1d1d23] border border-white/10 rounded-xl p-1">
                {["↖", "✋", "T", "▭", "⬢"].map((t, i) => (
                  <span key={t} className={`w-7 h-7 rounded-lg flex items-center justify-center ${i === 0 ? "bg-white text-black" : "text-white/60 hover:bg-white/10"}`}>{t}</span>
                ))}
              </div>
              <div className="rounded-[4px] ring-2 ring-[#2b5cff] ring-offset-2 ring-offset-black/60">
                <MiniCreative dark />
              </div>
              <div className="absolute -right-2 -top-2 w-3 h-3 bg-[#2b5cff] rounded-sm border border-white" />
              <div className="absolute -left-2 -bottom-2 w-3 h-3 bg-[#2b5cff] rounded-sm border border-white" />
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 font-mono text-[10px] text-white/50 bg-black/60 px-2 py-0.5 rounded">1080 × 1080 · X 80 Y 64</div>
            </div>
          </div>
          <div className="px-3 pb-2 flex gap-1.5 items-center">
            <span className="font-mono text-[10px] text-white/40">1 / 31</span>
            {PRODUCTS.map((p, i) => (
              <span key={p.t} className={`h-9 flex-1 rounded-lg border truncate px-2 py-1 ${i === 0 ? "border-[#2b5cff] bg-[#2b5cff]/10 text-white" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
                <span className="block truncate font-medium">{p.t}</span>
              </span>
            ))}
          </div>
        </div>
        {/* inspector */}
        <div className="w-[248px] border-l border-white/10 bg-[#141417] overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 font-semibold text-[12px]">Product Image <span className="ml-1 font-mono text-[10px] text-white/40">⌘3</span></div>
          <div className="p-3 space-y-3 overflow-hidden">
            <div>
              <div className="font-mono text-[10px] text-white/40 mb-1.5">POSITION</div>
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                {[["X", "80"], ["Y", "64"], ["W", "920"], ["H", "720"]].map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5"><span className="text-white/30">{k}</span><span>{v}</span></span>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-white/40 mb-1.5">FILL</div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-white border border-white/20" />
                <span className="font-mono bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex-1">#FFFFFF</span>
                <span className="font-mono text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10">100%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 relative"><span className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-[#2b5cff]" /></div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-white/40 mb-1.5">TYPOGRAPHY</div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex justify-between"><span>Inter Semibold</span><span className="text-white/40">32</span></div>
            </div>
            <div className="flex gap-1.5">
              <span className="flex-1 text-center py-1.5 rounded-lg bg-white text-black font-semibold">Design</span>
              <span className="flex-1 text-center py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60">Arrange</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptB() {
  return (
    <div className="h-[640px] flex flex-col text-[12.5px]" style={{ background: "#fbfaf6", color: "#191712" }}>
      <div className="h-[52px] flex items-center gap-3 px-5 border-b bg-white/80 backdrop-blur" style={{ borderColor: "#e9e4d6" }}>
        <span className="font-bold tracking-tight text-[14px]">Catalog Forge</span>
        <span className="text-[12px] px-2.5 py-1 rounded-full font-medium" style={{ background: "#eef3e6", color: "#3a5a1e" }}>Apricot Eclipse · 1:1 Feed</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] px-2.5 py-1.5 rounded-full border font-medium" style={{ borderColor: "#e9e4d6", background: "#f0f7e8" }}>● Saved ✓</span>
          <span className="text-[12px] px-3 py-1.5 rounded-full border" style={{ borderColor: "#e9e4d6" }}>Copy link</span>
          <span className="text-[12px] px-4 py-2 rounded-full text-white font-semibold" style={{ background: "#191712" }}>Export PNG →</span>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-[248px] border-r p-4 flex flex-col gap-3 bg-white" style={{ borderColor: "#e9e4d6" }}>
          <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">LAYERS</div>
          <div className="space-y-1.5">
            {LAYERS.map((l) => (
              <div key={l.id} className={`px-3 py-2 rounded-2xl border flex items-center gap-2.5 ${l.active ? "border-[#3a5a1e] bg-[#f3f6ec] shadow-sm" : "border-transparent hover:border-[#e9e4d6] hover:bg-[#fbfaf6]"}`}>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${l.active ? "bg-[#3a5a1e] text-white" : "bg-[#f3eee1]"}`}>{l.icon}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] leading-tight truncate">{l.name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">{l.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-2xl border-2 border-dashed p-3 text-center" style={{ borderColor: "#d8d1bd", background: "#fdfbf5" }}>
            <div className="text-[13px] font-semibold">Add something</div>
            <div className="flex gap-1.5 mt-2">
              {["Text", "Badge", "Shape"].map((t) => (
                <span key={t} className="flex-1 py-1.5 rounded-full bg-white border text-[12px] font-medium" style={{ borderColor: "#e9e4d6" }}>+ {t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0" style={{ background: "radial-gradient(circle at 50% 20%, #fffdf8, #f1ebe0)" }}>
          <div className="p-4">
            <div className="max-w-[520px] mx-auto flex items-center gap-2 bg-white rounded-full border pl-4 pr-1.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(58,90,30,0.4)]" style={{ borderColor: "#e9e4d6" }}>
              <span>✨</span>
              <span className="flex-1 text-zinc-500">Describe any change… “warm sunset backdrop”</span>
              <span className="px-4 py-2 rounded-full text-white text-[12px] font-bold" style={{ background: "#3a5a1e" }}>Generate</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center pb-2">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-[0_24px_60px_-24px_rgba(28,27,26,0.3)] ring-1" style={{ ["--tw-ring-color" as string]: "#e7dfd2" }}>
                <MiniCreative />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border rounded-full px-2 py-1 shadow-sm" style={{ borderColor: "#e9e4d6" }}>
                <span className="px-1.5">−</span><span className="font-mono text-[11px]">42%</span><span className="px-1.5">+</span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="flex gap-2 overflow-hidden">
              {PRODUCTS.map((p, i) => (
                <span key={p.t} className={`w-[132px] shrink-0 rounded-2xl border bg-white p-2 ${i === 0 ? "ring-2" : ""}`} style={i === 0 ? { ["--tw-ring-color" as string]: "#3a5a1e", borderColor: "#3a5a1e" } : { borderColor: "#e9e4d6" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://picsum.photos/seed/tea${i}/200/140`} alt="" className="w-full h-[64px] object-cover rounded-xl" />
                  <span className="block text-[11px] font-semibold truncate mt-1">{p.t}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{p.p}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="w-[264px] border-l p-3 space-y-3 overflow-hidden bg-[#fdfcf8]" style={{ borderColor: "#e9e4d6" }}>
          <div className="font-semibold text-[13px]">Product Image</div>
          <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "#e9e4d6" }}>
            <div className="font-mono text-[10px] text-zinc-500 mb-2">CONTENT</div>
            <div className="rounded-xl bg-[#f6f2e8] px-2.5 py-2 font-mono text-[11px]">Contain ▾</div>
            <div className="mt-2.5">
              <div className="flex justify-between text-[11px] mb-1"><span>Size</span><span className="font-mono">920 × 720</span></div>
              <div className="h-2 rounded-full bg-[#eee7d3] relative"><span className="absolute inset-y-0 left-0 w-3/4 rounded-full" style={{ background: "#3a5a1e" }} /></div>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "#e9e4d6" }}>
            <div className="font-mono text-[10px] text-zinc-500 mb-2">STYLE</div>
            <div className="flex gap-1.5">
              {["#ffffff", "#f6f2e8", "#191712", "#3a5a1e", "#c8f04a"].map((c, i) => (
                <span key={c} className={`w-7 h-7 rounded-full border ${i === 0 ? "ring-2 ring-offset-2" : ""}`} style={{ background: c, borderColor: "#e9e4d6", ["--tw-ring-color" as string]: "#3a5a1e" }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2.5">
              <span className="rounded-xl border px-2 py-1.5 font-mono text-[11px]" style={{ borderColor: "#e9e4d6" }}>Radius 36</span>
              <span className="rounded-xl border px-2 py-1.5 font-mono text-[11px]" style={{ borderColor: "#e9e4d6" }}>Opacity 100%</span>
            </div>
          </div>
          <div className="rounded-2xl p-3 text-white text-[12px] font-semibold text-center" style={{ background: "#191712" }}>Show all sizes (4) →</div>
        </div>
      </div>
    </div>
  );
}

function ConceptC() {
  return (
    <div className="h-[640px] flex flex-col text-[13px] bg-white text-zinc-900">
      <div className="h-12 flex items-center gap-2 px-4 border-b">
        <span className="text-zinc-400">←</span>
        <span className="font-medium">Catalog</span>
        <span className="text-zinc-300">/</span>
        <span className="font-semibold">Apricot Eclipse</span>
        <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live draft</span>
        <div className="ml-auto flex items-center gap-1.5 text-[12px]">
          <span className="px-2.5 py-1.5 rounded-lg border font-mono">⌘K</span>
          <span className="px-2.5 py-1.5 rounded-lg border">All sizes</span>
          <span className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-medium">Save ⌘S</span>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-[216px] border-r flex flex-col">
          <div className="px-3 py-2 flex items-center justify-between text-[12px]">
            <span className="font-semibold">Layers</span>
            <span className="font-mono text-[11px] text-zinc-400">6</span>
          </div>
          <div className="flex-1 px-1.5 space-y-0.5">
            {LAYERS.map((l, i) => (
              <div key={l.id} className={`px-2 py-1.5 rounded-lg flex items-center gap-2 ${l.active ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"}`}>
                <span className="font-mono text-[10px] text-zinc-400 w-4">0{i + 1}</span>
                <span className="truncate">{l.name}</span>
                {l.active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </div>
            ))}
          </div>
          <div className="p-2 border-t text-[12px] text-zinc-500">
            <div className="px-2 py-1">Press <span className="font-mono border rounded px-1">T</span> for text</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-white text-[12px]">
            <span className="font-medium border-b-2 border-zinc-900 pb-0.5">Canvas</span>
            <span className="text-zinc-400">All sizes</span>
            <span className="text-zinc-400">JSON</span>
            <span className="ml-auto font-mono text-[11px] text-zinc-400">1080 × 1080</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.2)] rounded-[2px] ring-1 ring-zinc-200">
              <MiniCreative />
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="max-w-[560px] mx-auto flex items-center gap-2 bg-white border rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm">
              <span className="text-zinc-400">›</span>
              <span className="flex-1 text-zinc-500">add red sale badge…</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100">↵</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-white">AI ⌘J</span>
            </div>
            <div className="max-w-[560px] mx-auto flex gap-1.5 mt-2 overflow-hidden">
              <span className="font-mono text-[11px] px-2 py-1 rounded-full bg-zinc-900 text-white">31 products →</span>
              {PRODUCTS.slice(0, 5).map((p) => (
                <span key={p.t} className="font-mono text-[11px] px-2 py-1 rounded-full border bg-white truncate">{p.t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="w-[232px] border-l flex flex-col">
          <div className="flex text-[12px] border-b">
            <span className="flex-1 text-center py-2 font-medium border-b-2 border-zinc-900">Design</span>
            <span className="flex-1 text-center py-2 text-zinc-400">Arrange</span>
          </div>
          <div className="p-3 space-y-3 text-[12px]">
            <div>
              <div className="text-zinc-500 mb-1">Content</div>
              <div className="font-mono bg-zinc-50 border rounded-lg px-2 py-1.5">{"{{price}}"} · 17.00 EUR</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono">
              {[["X", "80"], ["Y", "64"], ["W", "920"], ["H", "720"]].map(([k, v]) => (
                <span key={k} className="border-b px-1 py-1 flex justify-between hover:bg-zinc-50"><span className="text-zinc-400">{k}</span><span>{v}</span></span>
              ))}
            </div>
            <div>
              <div className="text-zinc-500 mb-1.5">Fill <span className="float-right font-mono">#FFF</span></div>
              <div className="flex gap-1">
                {["#fff", "#f4f4f5", "#18181b", "#3f6212"].map((c) => (
                  <span key={c} className="w-6 h-6 rounded-md border" style={{ background: c }} />
                ))}
                <span className="ml-auto font-mono text-[11px] text-zinc-500">100%</span>
              </div>
            </div>
            <div className="text-zinc-500">Click any value to type — <span className="font-mono border rounded px-1">⇅</span> scrubs</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorConceptsPage() {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/editor" className="text-sm font-semibold">← Editor</Link>
          <span className="text-xs text-zinc-500">3 directions for the rough editor — same layers, same canvas, new chrome</span>
          <div className="ml-auto flex gap-1.5 text-xs">
            {[["a", "A · Studio"], ["b", "B · Atelier"], ["c", "C · Flow"]].map(([k, label]) => (
              <a key={k} href={`#editor-${k}`} className="px-3 py-1.5 border rounded-full bg-white hover:border-zinc-500">{label}</a>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-14">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Editor redesign — pick a direction.</h1>
          <p className="text-sm text-zinc-600 mt-2">
            Today&apos;s pain from your screenshot: 11 top-bar controls with equal weight, emoji layer icons with tiny ↑↓,
            a bolted-on AI bar, and a 14-field inspector wall (X Y W H + Background + Text Color + …).
            Below are three full mock editors with the <em>same real content</em> (Apricot Eclipse, 6 layers, 31 products) so you compare chrome, not data.
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-[12px]">
            <div className="rounded-xl border bg-white px-3 py-2"><span className="font-bold">A · Studio Pro</span><br /><span className="text-zinc-500">Figma-grade dark, dense, scales to 50 layers</span></div>
            <div className="rounded-xl border bg-white px-3 py-2"><span className="font-bold">B · Atelier</span><br /><span className="text-zinc-500">Warm merchant-friendly, matches homepage</span></div>
            <div className="rounded-xl border bg-white px-3 py-2"><span className="font-bold">C · Flow</span><br /><span className="text-zinc-500">Linear-minimal, keyboard-first, canvas focus</span></div>
          </div>
        </div>

        <Shell
          id="editor-a" index="A" title="Studio Pro" tagline="For power users + agents — dark, dense, precise"
          blurb="Collapses 11 top-bar buttons into: breadcrumb + save state + size segmented + one Export. Layers get search (⌘F) and a floating tool rail. Inspector collapses into Position / Fill / Type sections with scrub + swatches. AI lives in one ⌘J line, not a second toolbar."
          picked={pick === "a"} onPick={() => setPick(pick === "a" ? null : "a")}
          footer={<Verdict pros={["Handles 20+ layers + all-sizes without scrolling hell", "Rulers, pixel readout (X80 Y64), blue selection = pro trust", "AI + JSON in one line — agents feel native"]} cons={["Dark = heaviest visual departure from airy homepage", "Denser = steeper for first-time Gibun merchants"]} />}
        >
          <ConceptA />
        </Shell>

        <Shell
          id="editor-b" index="B" title="Atelier" tagline="For merchants — calm, warm, matches your landing"
          blurb="Keeps the porcelain / moss / ink system from /. Big touch targets, layer cards instead of rows, style as swatch + sliders instead of hex fields. AI is a friendly hero pill (“Describe any change…”). The canvas floats on paper with a zoom capsule — feels like Canva, not CAD."
          picked={pick === "b"} onPick={() => setPick(pick === "b" ? null : "b")}
          footer={<Verdict pros={["Zero learning curve — closest to Canva merchants know", "Brand-consistent: same moss/porcelain as homepage hero", "Large filmstrip cards show title + price, not just thumbs"]} cons={["Cards take vertical space — 15+ layers will scroll", "Soft = less precise for pixel-perfect ad ops"]} />}
        >
          <ConceptB />
        </Shell>

        <Shell
          id="editor-c" index="C" title="Flow" tagline="For speed — minimal chrome, command bar does everything"
          blurb="Deletes chrome: one 48px top bar, tabbed center (Canvas / All sizes / JSON), inspector reduced to click-to-edit values. Bottom command bar replaces both AI bar and product strip: type “add red sale badge” or “→” to page products. Every action shows its shortcut."
          picked={pick === "c"} onPick={() => setPick(pick === "c" ? null : "c")}
          footer={<Verdict pros={["Fastest daily driver — canvas is 30% larger than today", "Fewest elements to maintain + easiest responsive", "Shortcuts (⌘K ⌘S ⌘J T) make agents + humans share a language"]} cons={["Minimal = features hidden — discoverability needs work", "Inline values can feel fiddly for color/type heavy edits"]} />}
        >
          <ConceptC />
        </Shell>

        <div className="rounded-2xl border bg-white p-6 grid md:grid-cols-[1fr_280px] gap-6">
          <div>
            <h3 className="font-semibold tracking-tight">My take</h3>
            <p className="text-[13px] text-zinc-600 mt-1 max-w-xl">
              Ship <strong>B for the outer shell</strong> (warm, on-brand, merchant-safe) with <strong>C&apos;s command bar</strong> replacing today&apos;s AI strip + product strip,
              and steal <strong>A&apos;s inspector grouping + size segmented control</strong>. That hybrid fixes the screenshot&apos;s three loudest issues in one pass
              without a full dark-mode fork.
            </p>
            <div className="mt-3 overflow-auto">
              <table className="text-[12px] w-full">
                <thead><tr className="text-left font-mono text-[10px] text-zinc-500"><th className="py-1 pr-4">AREA</th><th className="pr-4">TODAY</th><th className="pr-4">A</th><th className="pr-4">B</th><th>C</th></tr></thead>
                <tbody className="[&_td]:py-1 [&_td]:pr-4 [&_tr]:border-t">
                  <tr><td className="font-medium">Top bar</td><td>11 equal buttons</td><td>breadcrumb + segmented</td><td>3 pills only</td><td>single 48px bar</td></tr>
                  <tr><td className="font-medium">Layers</td><td>emoji + ↑↓</td><td>search + rail</td><td>cards + dropzone</td><td>numbered minimal</td></tr>
                  <tr><td className="font-medium">AI</td><td>second toolbar</td><td>⌘J line</td><td>hero pill</td><td>bottom command</td></tr>
                  <tr><td className="font-medium">Inspector</td><td>14 flat fields</td><td>3 sections</td><td>2 cards + swatches</td><td>inline edit</td></tr>
                  <tr><td className="font-medium">Products</td><td>tiny thumbs</td><td>compact list</td><td>large cards</td><td>→ command</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl bg-zinc-900 text-white p-4 text-[12.5px] flex flex-col">
            <div className="font-semibold">Next step</div>
            <div className="text-white/70 mt-1">Tell me A, B, or C (or “hybrid”) and I&apos;ll apply it to <span className="font-mono text-white">/editor</span> — starting with top bar + inspector, canvas untouched so nothing breaks.</div>
            <div className="mt-3 font-mono text-[11px] px-2.5 py-2 rounded-lg bg-white/10">
              {pick ? `→ picked: ${pick.toUpperCase()} — say “apply ${pick.toUpperCase()}”` : "→ no pick yet — click “Pick this” above"}
            </div>
            <Link href="/editor" className="mt-3 text-center py-2 rounded-lg bg-white text-black font-semibold">Back to live editor →</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
