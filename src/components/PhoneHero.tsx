"use client";

import { useState } from "react";

/* ————————— PhoneHero ————————— */
/* The approved 3D hero phone (lab variation 02, as shipped on the homepage).
   True 3D slab — front / back / core / 4 edge walls — with the photoreal
   titanium recipe on the front face. Screen content (incl. the homepage
   carousel track) renders inside untouched; every overlay above the screen
   is pointer-events-none so swipes, taps and scroll all pass through.
   Single source of truth: used by both `/` and `/phone-lab`. */

const W = 288;
const H = 600;
const T = 18;
const HALF = T / 2;

export function PhoneHero({
  children,
  light,
  fidelity = "production",
}: {
  children: React.ReactNode;
  /** Orbiting key light (degrees, −70…70). Overrides the tilt-derived sheen
      angle and steadies the floor shadow while the phone tilts beneath it —
      light decoupled from object. Omit for today's tilt-derived behavior. */
  light?: { orbit: number };
  /** "atelier" switches on the macro finish details (wrap bands, protruding
      buttons, refraction ring). Default "production" is pixel-identical. */
  fidelity?: "production" | "atelier";
}) {
  // Near-level rest tilt: bottom edge stays shut (its face + interior reveal
  // grow fast with downward angle); hover still adds ±5° of life.
  const [tilt, setTilt] = useState({ x: 1, y: -14 });
  const [dragging, setDragging] = useState(false);
  const sheenAngle = light ? 105 + light.orbit * 1.2 : 105 + tilt.y * 1.5;
  const shadowAx = light ? 14 + light.orbit * 0.5 : 16 + tilt.y * 1.6;
  const shadowCx = light ? 10 + light.orbit * 0.35 : 10 + tilt.y * 1.2;
  return (
    <div
      className="relative shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
      style={{ perspective: 2000, width: 340, height: 656 }}
      onMouseMove={(e) => {
        if (dragging) return; // freeze while swiping the carousel — otherwise
        // the phone chases the cursor mid-drag and the image seems to jump
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
      {/* two-layer floor shadow, key light top-left: wide faint ambient ramp
          + tighter core that breathes in sync with the 7s levitation bob.
          Opacity-only animation so it never fights the tilt transform. */}
      <div className="absolute bottom-0 left-1/2 w-[240px] h-[26px] rounded-[100%] pointer-events-none"
        style={{ background: "rgba(25,23,18,0.16)", filter: "blur(26px)", transform: `translateX(calc(-50% + ${shadowAx}px))` }} />
      <div className="absolute bottom-2 left-1/2 w-[160px] h-[11px] rounded-[100%] pointer-events-none"
        style={{ background: "#191712", opacity: 0.3, filter: "blur(9px)", transform: `translateX(calc(-50% + ${shadowCx}px))`, animation: "phone-shadow-breathe 7s ease-in-out infinite" }} />

      {/* gentle levitation — half-distance bob so the phone never reads as jumping */}
      <div style={{ animation: "phone-floaty 7s ease-in-out infinite" }}>
        {/* TILT only — driven by hover state */}
        <div className="preserve-3d relative" style={{
          width: W, height: H,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(1deg)`,
          transition: "transform 280ms ease-out",
        }}>
          {/* back plate (dark titanium + camera plateau), inset so it never
              peeks past the front silhouette in corners */}
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

          {/* solid core — fills the slab so corner seams never see through.
              Height 96% (top-anchored): a full-height core's dark bottom/right
              edge projects past the front silhouette under perspective and reads
              as extra chin — pulled up it hides behind the opaque front face.
              Walls stay as-is: they land on the full-size front/back faces, and
              the full-height back plate still backs every corner gap, so no
              see-through lines can open at the bottom or right. */}
          <div className="absolute rounded-[54px] pointer-events-none" style={{
            inset: 0,
            height: "96%",
            transform: "translateZ(0)",
            background: "linear-gradient(150deg,#2e2c28,#131211 55%,#232120)",
          }} />

          {/* edge walls (straight sections only — clear of the corner radius,
              ends faded via mask so highlights dissolve into the curves.
              Side walls flush with the body (nothing past the silhouette at
              rest — hover rotation still reveals the edge faces dynamically) */}
          <div className="absolute" style={{
            top: 58, bottom: 58, right: "0px", width: T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, #6b665c 18%, #2b2925 60%, #0f0e0c 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            {/* atelier: power button with a real protruding side profile */}
            {fidelity === "atelier" && (
              <div className="absolute rounded-[2px]" style={{ left: 6, top: 92, width: 6, height: 62, transform: "translateZ(5px)", background: "linear-gradient(180deg,#7d776c,#2c2a26)", boxShadow: "0 0 2px rgba(0,0,0,0.6)" }} />
            )}
          </div>
          <div className="absolute" style={{
            top: 58, bottom: 58, left: "0px", width: T,
            transform: "rotateY(90deg)",
            background: "linear-gradient(90deg, #0f0e0c 0%, #2b2925 55%, #57534a 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
            maskImage: "linear-gradient(180deg, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
          }}>
            <div className="absolute left-0 right-0" style={{ top: 24, height: 3, background: "#b9b2a2", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            <div className="absolute left-0 right-0" style={{ bottom: 24, height: 3, background: "#8f887a", boxShadow: "0 1px 1px rgba(0,0,0,0.45)" }} />
            {/* atelier: mute + volume with real protruding side profiles */}
            {fidelity === "atelier" && (<>
              <div className="absolute rounded-[2px]" style={{ left: 6, top: 46, width: 6, height: 26, transform: "translateZ(-5px)", background: "linear-gradient(180deg,#7d776c,#2c2a26)", boxShadow: "0 0 2px rgba(0,0,0,0.6)" }} />
              <div className="absolute rounded-[2px]" style={{ left: 6, top: 82, width: 6, height: 48, transform: "translateZ(-5px)", background: "linear-gradient(180deg,#7d776c,#2c2a26)", boxShadow: "0 0 2px rgba(0,0,0,0.6)" }} />
            </>)}
          </div>
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
          {/* bottom wall — top 96% (not 100%): at 100% the wall's dark band
              hangs ~9px past the body and reads as chin; tucked up it hides
              behind the opaque front face */}
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

          {/* front face — photoreal titanium: unibody + chamfer + gasket */}
          <div className="absolute inset-0 rounded-[54px] brushed" style={{
            transform: `translateZ(${HALF}px)`,
            background: "linear-gradient(148deg, #9a9488 0%, #4c4841 12%, #211f1c 28%, #3d3a35 48%, #131211 66%, #5c5850 84%, #2c2a26 100%)",
            padding: 2.5,
            boxShadow: "14px 26px 44px -10px rgba(25,23,18,0.32)",
          }}>
            {/* antenna bands */}
            <div className="absolute left-[52px] top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute right-[52px] top-0 w-[36px] h-[3px] rounded-full bg-[#b9b2a2] z-20" style={{ boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
            <div className="absolute left-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            <div className="absolute right-[52px] -bottom-0 w-[36px] h-[3px] rounded-full bg-[#8f887a] z-20" />
            {/* atelier: wrap-around corner segments, tangent to the curve so
                they hug the titanium instead of stabbing past the edge */}
            {fidelity === "atelier" && (<>
              <div className="absolute left-[16px] top-[19px] w-[10px] h-[3px] rounded-full z-20" style={{ background: "#b9b2a2", transform: "rotate(-45deg)", boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
              <div className="absolute right-[16px] top-[19px] w-[10px] h-[3px] rounded-full z-20" style={{ background: "#b9b2a2", transform: "rotate(45deg)", boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)" }} />
              <div className="absolute left-[16px] bottom-[19px] w-[10px] h-[3px] rounded-full z-20" style={{ background: "#8f887a", transform: "rotate(45deg)" }} />
              <div className="absolute right-[16px] bottom-[19px] w-[10px] h-[3px] rounded-full z-20" style={{ background: "#8f887a", transform: "rotate(-45deg)" }} />
            </>)}
            {/* milled side buttons — crisp gradient tabs, ride the front plane
                so they tilt along (no shadow: it blurred onto the frame) */}
            <div className="absolute -left-[2.5px] top-[104px] w-[3.5px] h-[26px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[140px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -left-[2.5px] top-[194px] w-[3.5px] h-[48px] rounded-l-md z-10" style={{ background: "linear-gradient(90deg,#6e695f,#35322d)" }} />
            <div className="absolute -right-[2.5px] top-[150px] w-[3.5px] h-[64px] rounded-r-md z-10" style={{ background: "linear-gradient(270deg,#6e695f,#35322d)" }} />
            {/* chamfer — polished edge that catches light */}
            <div className="w-full h-full rounded-[51.5px]" style={{
              background: "linear-gradient(148deg, rgba(255,255,255,0.75), rgba(255,255,255,0.08) 18%, rgba(0,0,0,0.35) 55%, rgba(255,255,255,0.28) 85%, rgba(255,255,255,0.55))",
              padding: 1.5,
            }}>
              {/* gasket: 5px at the bottom (vs 8 elsewhere) so the white runs
                  taller and the bottom bezel stays slim */}
              <div className="w-full h-full rounded-[50px] bg-[#0a0908]" style={{ padding: "8px 8px 5px", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9)" }}>
                <div className="relative w-full h-full rounded-[43px] overflow-hidden bg-white flex flex-col min-h-0"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5)" }}>
                  {children}
                  {/* angle-reactive showroom sheen + curved-glass vignette */}
                  <div className="absolute inset-0 pointer-events-none z-20" style={{
                    background: `linear-gradient(${sheenAngle}deg, transparent 30%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.08) 50%, transparent 60%)`,
                  }} />
                  <div className="absolute inset-0 pointer-events-none z-20" style={{
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 0 30px rgba(0,0,0,0.16)",
                    borderRadius: "inherit",
                  }} />
                  {/* atelier: curved-glass refraction ring for bright content */}
                  {fidelity === "atelier" && (
                    <div className="absolute inset-0 pointer-events-none z-20" style={{
                      boxShadow: "inset 0 0 22px rgba(0,0,0,0.30), inset 0 0 5px rgba(255,255,255,0.40)",
                      borderRadius: "inherit",
                    }} />
                  )}
                  {/* dynamic island with lens glint */}
                  <div className="absolute top-[11px] left-1/2 -translate-x-1/2 w-[88px] h-[25px] bg-black rounded-full z-30 flex items-center justify-end pr-3 gap-1.5"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.5)" }}>
                    <span className="w-[9px] h-[9px] rounded-full relative overflow-hidden" style={{ background: "radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0a1628 45%, #000 70%)" }}>
                      <span className="absolute top-[1.5px] left-[1.5px] w-[2.5px] h-[2.5px] rounded-full bg-blue-400/80 blur-[0.5px]" />
                    </span>
                    <span className="w-[5px] h-[5px] rounded-full bg-[#1a1d22]" style={{ boxShadow: "inset 0 0 1px rgba(120,180,255,0.5)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
