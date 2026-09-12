"use client";

import Link from "next/link";
import { useState } from "react";

const INK = "#191712";
const MOSS = "#3a5a1e";
const SIGNAL = "#c8f04a";
const PORCELAIN = "#fbfaf6";
const LINE = "#e9e4d6";

const DEMO_IMG =
  "https://picsum.photos/seed/catalog-forge-watch/800/800";

export default function PhoneLabPage() {
  const [tilt, setTilt] = useState({ x: 1, y: -14 });

  return (
    <div className="min-h-screen" style={{ background: PORCELAIN, color: INK }}>
      <style>{`
        @keyframes floaty { 0%,100% { transform: translateY(-8px); } 50% { transform: translateY(10px); } }
        @keyframes sheen { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .preserve-3d { transform-style: preserve-3d; }
        .brushed::after {
          content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
          background: repeating-linear-gradient(95deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px);
          mix-blend-mode: overlay;
        }
      `}</style>

      <header className="border-b bg-white/90 backdrop-blur sticky top-0 z-40" style={{ borderColor: LINE }}>
        <div className="max-w-[1300px] mx-auto px-8 py-3 flex items-center gap-3">
          <Link href="/" className="text-[13px] font-medium text-zinc-500 hover:text-black">← homepage</Link>
          <h1 className="text-[15px] font-bold tracking-tight ml-2">Phone Lab — 3D realism test</h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full" style={{ background: SIGNAL }}>
            3 variations
          </span>
          <div className="ml-auto font-mono text-[11px] text-zinc-400 hidden md:block">
            same screen content · same 296×616 footprint
          </div>
        </div>
      </header>

      <main className="max-w-[1300px] mx-auto px-8 py-10 space-y-10">
        <div className="max-w-[720px]">
          <div className="font-mono text-[10px] tracking-[0.24em] uppercase" style={{ color: MOSS }}>
            Strictly the phone on the right — nothing else changed
          </div>
          <h2 className="text-[42px] leading-[1.02] mt-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            How real can the <em style={{ color: MOSS }}>phone</em> feel?
          </h2>
          <p className="text-[15px] text-zinc-600 mt-3 leading-relaxed">
            All three use your exact Instagram screen. Only the hardware rendering changes —
            materials, thickness, glass, light and shadow. Pick the direction you feel, then I’ll roll it into the homepage.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <VariationCard
            n="01"
            title="Photoreal Front"
            sub="Straight-on · studio product shot"
            desc="Keeps your current framing. Adds titanium micro-detail, chamfer light, curved-glass glare and a grounded floor shadow."
            techniques={["Brushed titanium + chamfer highlight", "Antenna bands + milled buttons", "Dual glass streak + edge vignette", "Contact + ambient floor shadow"]}
            backdrop="radial-gradient(circle at 50% 42%, rgba(58,90,30,0.10), transparent 62%), linear-gradient(#f3f0e6,#fbfaf6)"
            footer="Safest upgrade — same layout, 10× more real."
          >
            <PhonePhotoreal />
          </VariationCard>

          <VariationCard
            n="02"
            title="Floating ¾ Tilt"
            sub="Perspective · shows thickness"
            desc="Tilts in 3D so you see the edge wall. Extruded side, floating animation, strong glare sweep. Most “3D” of the three."
            techniques={["perspective(1600px) · true 3D slab", "01's titanium, chamfer, bands + buttons", "LevBootstrap float + deep drop shadow", "Angle-reactive glass sheen"]}
            backdrop="radial-gradient(circle at 50% 60%, rgba(200,240,74,0.22), transparent 60%), linear-gradient(180deg,#eceadf 0%, #fbfaf6 70%)"
            footer="Most dramatic. Move your mouse over it ↓"
            interactive
          >
            <PhoneTilt tilt={tilt} setTilt={setTilt} />
          </VariationCard>

          <VariationCard
            n="03"
            title="Dark Studio Edge"
            sub="Rim light · mirror floor"
            desc="Opposite angle on a dark stage. Signal-green rim light traces the titanium, screen reflects into the floor."
            techniques={["Dark stage + green rim light", "Opposite tilt rotateY(+18°)", "Mirrored floor reflection + fade", "Hot top highlight + deep blacks"]}
            backdrop="radial-gradient(circle at 50% 30%, rgba(200,240,74,0.18), transparent 55%), linear-gradient(180deg,#17150f,#0c0b09)"
            dark
            footer="Most premium — best for a hero moment."
          >
            <PhoneDarkStudio />
          </VariationCard>
        </div>

        <div className="rounded-2xl border bg-white p-6 flex flex-col md:flex-row md:items-center gap-4" style={{ borderColor: LINE }}>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: MOSS }}>My take</div>
            <p className="text-[14px] mt-1 text-zinc-700 leading-relaxed max-w-[640px]">
              <strong>01</strong> if you want to stay clean, <strong>02</strong> if you want the “wow, that’s 3D” reaction,
              <strong> 03</strong> if you want premium / cinematic. My vote: <strong>02 for the homepage</strong> — thickness is what sells realism — with 01’s materials.
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

/* ————————— shared screen (identical in all 3) ————————— */

function MockScreen() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white h-full">
      <div className="flex items-center justify-between pl-7 pr-6 pt-3.5 pb-1 text-[11px] font-semibold text-black shrink-0">
        <span className="w-10">9:41</span>
        <span className="flex items-center gap-1.5">
          <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5" /><rect x="4" y="5" width="3" height="6" rx="0.5" /><rect x="8" y="2.5" width="3" height="8.5" rx="0.5" /><rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.4" /></svg>
          <svg width="22" height="11" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" /></svg>
        </span>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2 shrink-0">
        <span className="rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)" }}>
          <span className="block w-[30px] h-[30px] rounded-full bg-white p-[2px]">
            <span className="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: MOSS }}>G</span>
          </span>
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[12px] font-semibold truncate">gibun</div>
          <div className="text-[11px] text-zinc-500">Sponsored</div>
        </div>
        <span className="ml-auto text-[15px] tracking-widest text-zinc-800 px-1">•••</span>
      </div>
      <div className="w-full aspect-square overflow-hidden shrink-0 relative" style={{ background: "linear-gradient(140deg,#e8e2d2,#cfc8b4)" }}>
        {/* fallback glyph — visible only if the photo fails to load */}
        <div className="absolute inset-0 flex items-center justify-center text-[64px]">⌚</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DEMO_IMG}
          alt="Voyager Watch 40mm"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
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
      <div className="px-2.5 pt-1 text-[12px] font-semibold">2,314 likes</div>
      <div className="px-2.5 pt-0.5 text-[12px] leading-snug flex-1 min-h-0 overflow-hidden">
        <span className="font-semibold">gibun</span> <span>Voyager in sand steel ✨ Tap to shop — <span className="text-zinc-500">#gibun #newin</span></span>
      </div>
      <div className="flex items-center justify-around py-2 border-t bg-white shrink-0 text-[19px]">
        <span>⌂</span><span className="opacity-30">⚲</span><span className="opacity-30">▣</span><span className="opacity-30">🎬</span>
        <span className="w-[20px] h-[20px] rounded-full text-white flex items-center justify-center text-[10px] font-bold" style={{ background: MOSS }}>G</span>
      </div>
    </div>
  );
}

function Island() {
  return (
    <div className="absolute top-[11px] left-1/2 -translate-x-1/2 w-[88px] h-[25px] bg-black rounded-full z-30 flex items-center justify-end pr-3 gap-1.5"
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.5)" }}>
      <span className="w-[9px] h-[9px] rounded-full relative overflow-hidden" style={{ background: "radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0a1628 45%, #000 70%)" }}>
        <span className="absolute top-[1.5px] left-[1.5px] w-[2.5px] h-[2.5px] rounded-full bg-blue-400/80 blur-[0.5px]" />
      </span>
      <span className="w-[5px] h-[5px] rounded-full bg-[#1a1d22]" style={{ boxShadow: "inset 0 0 1px rgba(120,180,255,0.5)" }} />
    </div>
  );
}

function GlassOverlay({ strength = 1 }: { strength?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 rounded-[inherit]">
      {/* diagonal showroom streak */}
      <div className="absolute inset-0" style={{
        opacity: strength,
        background: "linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.22) 40%, rgba(255,255,255,0.07) 47%, transparent 58%, transparent 72%, rgba(255,255,255,0.10) 82%, transparent 90%)",
      }} />
      {/* top-down softbox glare */}
      <div className="absolute inset-x-6 top-0 h-28" style={{
        opacity: 0.7 * strength,
        background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(255,255,255,0.35), transparent 70%)",
      }} />
      {/* curved-edge vignette = glass thickness */}
      <div className="absolute inset-0" style={{
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(255,255,255,0.18), inset 2px 0 6px rgba(0,0,0,0.14), inset -2px 0 6px rgba(0,0,0,0.14), inset 0 0 28px rgba(0,0,0,0.10)",
        borderRadius: "inherit",
      }} />
    </div>
  );
}

/* ————————— 01 photoreal front ————————— */

function PhonePhotoreal() {
  return (
    <div className="relative" style={{ width: 296, height: 616 }}>
      {/* ambient + contact shadow */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 w-[260px] h-[44px] rounded-[100%]" style={{ background: "rgba(25,23,18,0.28)", filter: "blur(26px)" }} />
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 w-[210px] h-[20px] rounded-[100%]" style={{ background: "rgba(25,23,18,0.45)", filter: "blur(12px)" }} />

      {/* antenna bands (breaks in the titanium) */}
      <div className="absolute left-[52px] -top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
      <div className="absolute right-[52px] -top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
      <div className="absolute left-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
      <div className="absolute right-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />

      {/* milled side buttons with highlight + shadow */}
      <div className="absolute -left-[2.5px] top-[108px] w-[3.5px] h-[26px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
      <div className="absolute -left-[2.5px] top-[144px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
      <div className="absolute -left-[2.5px] top-[200px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
      <div className="absolute -right-[2.5px] top-[156px] w-[3.5px] h-[64px] rounded-r-md z-10" style={{ background: "linear-gradient(270deg,#6e695f,#35322d)" }} />

      {/* titanium unibody */}
      <div className="absolute inset-0 rounded-[54px] brushed" style={{
        background: "linear-gradient(148deg, #9a9488 0%, #4c4841 12%, #211f1c 28%, #3d3a35 48%, #131211 66%, #5c5850 84%, #2c2a26 100%)",
        boxShadow: "0 40px 70px -18px rgba(25,23,18,0.5), 0 14px 28px -10px rgba(25,23,18,0.35)",
        padding: 2.5,
      }}>
        {/* chamfer — polished edge that catches light */}
        <div className="w-full h-full rounded-[51.5px]" style={{
          background: "linear-gradient(148deg, rgba(255,255,255,0.75), rgba(255,255,255,0.08) 18%, rgba(0,0,0,0.35) 55%, rgba(255,255,255,0.28) 85%, rgba(255,255,255,0.55))",
          padding: 1.5,
        }}>
          <div className="w-full h-full rounded-[50px] bg-[#0a0908]" style={{ padding: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9)" }}>
            <div className="relative w-full h-full rounded-[42px] overflow-hidden bg-white">
              <MockScreen />
              <GlassOverlay />
              <Island />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————————— 02 floating tilt ————————— */

function PhoneTilt({
  tilt, setTilt,
}: {
  tilt: { x: number; y: number };
  setTilt: (t: { x: number; y: number }) => void;
}) {
  // True 3D slab: front face at +HALF, back plate at −HALF, four edge walls
  // rotated 90° so they read as thickness from any angle. Float lives on the
  // OUTER wrapper, tilt on the INNER — previously one `floaty` animation drove
  // `transform` and silently overrode the hover tilt, and screen-space
  // box-shadow "extrusion" banded the right edge instead of turning with it.
  const W = 288;
  const H = 600;
  const T = 18;
  const HALF = T / 2;
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="relative flex items-center justify-center cursor-grab active:cursor-grabbing"
      style={{ perspective: 2000, width: 340, height: 656 }}
      onMouseMove={(e) => {
        if (dragging) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ x: 1 - py * 10, y: -14 + px * 14 });
      }}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onMouseLeave={() => { setDragging(false); setTilt({ x: 1, y: -14 }); }}
    >
      {/* two-layer floor shadow, key light top-left (mirrors homepage) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[240px] h-[26px] rounded-[100%] pointer-events-none"
        style={{ background: "rgba(25,23,18,0.16)", filter: "blur(26px)", transform: `translateX(calc(-50% + 16px + ${tilt.y * 1.6}px))` }} />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[160px] h-[11px] rounded-[100%] pointer-events-none"
        style={{ background: "#191712", opacity: 0.3, filter: "blur(9px)", transform: `translateX(calc(-50% + 10px + ${tilt.y * 1.2}px))`, animation: "phone-shadow-breathe 7s ease-in-out infinite" }} />

      {/* FLOAT only — never touches rotate, so it can't override tilt */}
      <div style={{ animation: "floaty 7s ease-in-out infinite" }}>
        {/* TILT only — driven by hover state */}
        <div className="preserve-3d relative" style={{
          width: W, height: H,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(1deg)`,
          transition: "transform 280ms ease-out",
        }}>
          {/* ——— back plate (dark titanium + camera plateau) ——— */}
          {/* inset 2px so it never peeks past the front silhouette in corners */}
          <div className="absolute rounded-[52px] brushed" style={{
            inset: 2,
            transform: `translateZ(${-HALF}px)`,
            background: "linear-gradient(150deg,#3a3733,#171614 60%,#2b2925)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25)",
          }}>
            <div className="absolute left-5 top-5 w-[104px] h-[104px] rounded-[28px]" style={{
              background: "linear-gradient(150deg,#4a463f,#1c1a17)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 10px rgba(0,0,0,0.4)",
            }}>
              <div className="absolute left-3 top-3 w-[42px] h-[42px] rounded-full bg-black" style={{ boxShadow: "inset 0 0 0 3px #2c2a26, inset 0 0 0 5px #0a0a0a" }}>
                <div className="absolute top-[8px] left-[8px] w-[10px] h-[10px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #2a4a7f, #000 70%)" }} />
              </div>
              <div className="absolute right-3 bottom-3 w-[42px] h-[42px] rounded-full bg-black" style={{ boxShadow: "inset 0 0 0 3px #2c2a26, inset 0 0 0 5px #0a0a0a" }}>
                <div className="absolute top-[8px] left-[8px] w-[10px] h-[10px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #2a4a7f, #000 70%)" }} />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-white/25 text-[40px]">◍</div>
          </div>

          {/* ——— solid core: fills the slab so corner seams can never see through.
              Height 96% (top-anchored): full-height core's bottom edge projected
              past the front silhouette and read as chin. Walls untouched — they
              land on full-size front/back, back plate backs all gaps. ——— */}
          <div className="absolute rounded-[53px] pointer-events-none" style={{
            inset: 1,
            height: "96%",
            transform: "translateZ(0)",
            background: "linear-gradient(150deg,#2e2c28,#131211 55%,#232120)",
          }} />

          {/* ——— edge walls: perpendicular faces = real thickness ——— */}
          {/* right wall flush — nothing past the silhouette at rest */}
          <div className="absolute" style={{
            top: 58, bottom: 58, right: "0px", width: T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, #6b665c 18%, #2b2925 60%, #0f0e0c 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            {/* antenna breaks crossing the frame */}
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
          </div>
          {/* left wall — flush, mirrored */}
          <div className="absolute" style={{
            top: 58, bottom: 58, left: "0px", width: T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, #0f0e0c 0%, #2b2925 55%, #57534a 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
          </div>
          {/* top + bottom walls */}
          <div className="absolute" style={{
            left: 58, right: 58, top: 0, height: T, marginTop: -HALF,
            transform: "rotateX(90deg)",
            background: "linear-gradient(180deg, #8d877b 0%, #2b2925 70%, #0f0e0c 100%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
          }}>
            <div className="absolute top-0 bottom-0" style={{ left: 26, width: 3, background: "#b9b2a2" }} />
            <div className="absolute top-0 bottom-0" style={{ right: 26, width: 3, background: "#b9b2a2" }} />
          </div>
          {/* bottom wall tucked to 96% — at 100% its band hangs past the body */}
          <div className="absolute" style={{
            left: 58, right: 58, top: "96%", height: T, marginTop: -HALF,
            transform: "rotateX(90deg)",
            background: "linear-gradient(180deg, #0f0e0c 0%, #2b2925 60%, #57534a 100%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0, black 34px, black calc(100% - 34px), transparent 100%)",
          }}>
            <div className="absolute top-0 bottom-0" style={{ left: 26, width: 3, background: "#8f887a" }} />
            <div className="absolute top-0 bottom-0" style={{ right: 26, width: 3, background: "#8f887a" }} />
          </div>

          {/* ——— front face: full photoreal recipe, same as 01 ——— */}
          <div className="absolute inset-0 rounded-[54px] brushed" style={{
            transform: `translateZ(${HALF}px)`,
            background: "linear-gradient(148deg, #9a9488 0%, #4c4841 12%, #211f1c 28%, #3d3a35 48%, #131211 66%, #5c5850 84%, #2c2a26 100%)",
            padding: 2.5,
            boxShadow: "14px 26px 44px -10px rgba(25,23,18,0.32)",
          }}>
            {/* antenna bands (breaks in the titanium) */}
            <div className="absolute left-[52px] -top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute right-[52px] -top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute left-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            <div className="absolute right-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            {/* milled side buttons with highlight + shadow — ride on the front
                plane so they tilt with the phone */}
            <div className="absolute -left-[2.5px] top-[104px] w-[3.5px] h-[26px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[140px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[194px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -right-[2.5px] top-[150px] w-[3.5px] h-[64px] rounded-r-md z-10" style={{ background: "linear-gradient(270deg,#6e695f,#35322d)" }} />
            {/* chamfer — polished edge that catches light */}
            <div className="w-full h-full rounded-[51.5px]" style={{
              background: "linear-gradient(148deg, rgba(255,255,255,0.75), rgba(255,255,255,0.08) 18%, rgba(0,0,0,0.35) 55%, rgba(255,255,255,0.28) 85%, rgba(255,255,255,0.55))",
              padding: 1.5,
            }}>
              <div className="w-full h-full rounded-[50px] bg-[#0a0908]" style={{ padding: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9)" }}>
              <div className="relative w-full h-full rounded-[43px] overflow-hidden bg-white"
                style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5)" }}>
                <MockScreen />
                {/* angle-reactive sheen (opacity static — no animation fighting state) */}
                <div className="absolute inset-0 pointer-events-none z-20" style={{
                  background: `linear-gradient(${(105 + tilt.y * 1.5)}deg, transparent 30%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.08) 50%, transparent 60%)`,
                }} />
                <div className="absolute inset-0 pointer-events-none z-20" style={{
                  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 0 30px rgba(0,0,0,0.16)",
                  borderRadius: "inherit",
                }} />
                <Island />
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————————— 03 dark studio ————————— */

function PhoneDarkStudio() {
  return (
    <div className="relative flex flex-col items-center" style={{ width: 320 }}>
      {/* halo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(200,240,74,0.16), transparent 62%)", filter: "blur(10px)" }} />

      <div style={{ perspective: 1400 }}>
        <div className="relative preserve-3d" style={{
          width: 288, height: 600,
          transform: "rotateY(17deg) rotateX(4deg) rotateZ(-0.5deg)",
          boxShadow: "-30px 50px 90px rgba(0,0,0,0.65)",
          borderRadius: 54,
        }}>
          {/* green rim on the facing edge */}
          <div className="absolute inset-0 rounded-[54px] pointer-events-none z-30" style={{
            boxShadow: "inset 2px 0 2px rgba(200,240,74,0.55), inset -2px 0 3px rgba(255,255,255,0.22), inset 0 2px 2px rgba(255,255,255,0.4)",
            borderRadius: 54,
          }} />
          {/* warm kicker on the far edge */}
          <div className="absolute inset-y-4 -right-[3px] w-[6px] rounded-full pointer-events-none z-30" style={{
            background: "linear-gradient(180deg, rgba(255,220,170,0.5), transparent 40%, transparent 60%, rgba(255,220,170,0.35))",
            filter: "blur(2px)",
          }} />

          <div className="absolute inset-0 rounded-[54px]" style={{
            background: "linear-gradient(140deg, #d9d4c7 0%, #6f6a5f 10%, #1c1a17 30%, #33302b 55%, #0a0908 75%, #57534a 100%)",
            padding: 2.5,
          }}>
            <div className="w-full h-full rounded-[51.5px] bg-black" style={{ padding: 8 }}>
              <div className="relative w-full h-full rounded-[43px] overflow-hidden bg-white">
                <MockScreen />
                <GlassOverlay strength={1.15} />
                <Island />
              </div>
            </div>
          </div>

          <div className="absolute -left-[3px] top-[110px] w-[3px] h-[26px] rounded-l-md" style={{ background: "#c8f04a", boxShadow: "0 0 8px rgba(200,240,74,0.9)" }} />
          <div className="absolute -left-[3px] top-[146px] w-[3px] h-[48px] rounded-l-md" style={{ background: "linear-gradient(90deg,#e8e4d8,#3a372f)" }} />
        </div>
      </div>

      {/* mirror floor reflection */}
      <div className="relative overflow-hidden pointer-events-none select-none" style={{
        width: 288, height: 120, marginTop: 14,
        transform: "scaleY(-1)",
        maskImage: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 85%)",
        WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 85%)",
        opacity: 0.22, filter: "blur(3px) saturate(0.9)",
      }}>
        <div className="rounded-[54px] overflow-hidden border border-white/10" style={{ width: 288, height: 600 }}>
          <MockScreen />
        </div>
      </div>
      <div className="w-[240px] h-[22px] rounded-[100%] -mt-[110px]" style={{ background: "rgba(0,0,0,0.7)", filter: "blur(18px)" }} />
    </div>
  );
}
