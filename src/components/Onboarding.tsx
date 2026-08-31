"use client";

import { useEffect, useState } from "react";

const KEY = "catalog-forge-onboarding-dismissed-v1";

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 bg-zinc-900 text-white text-xs px-3 py-2 rounded-full shadow-lg">Show onboarding</button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-zinc-900 p-6 text-white">
          <div className="text-xs uppercase tracking-widest opacity-70">Catalog Forge • 30s start</div>
          <h2 className="text-xl font-semibold mt-1">Paste → Preview → Overlay → Feed</h2>
          <p className="text-sm opacity-80 mt-1">Like Marpipe but HTML-first, Cloudflare-native. Test with <span className="font-mono bg-white/20 px-1 rounded">store.gibun.at</span> (36 products).</p>
          <div className="flex gap-1.5 mt-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded ${step >= i ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-medium">1. Connect Shopify store</h3>
              <p className="text-sm text-zinc-600">We fetch <code className="bg-zinc-100 px-1 rounded text-xs">/products.json</code> — no API key. Try Gibun.</p>
              <div className="bg-zinc-50 border rounded-lg p-4 flex items-center gap-3">
                <div className="flex-1 font-mono text-sm bg-white border rounded px-3 py-2">https://store.gibun.at</div>
                <span className="text-green-600 text-sm">✓ 31 SKUs</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border rounded-lg p-3">
                  <div className="text-zinc-500">Before (plain feed)</div>
                  <div className="mt-2 h-24 bg-zinc-100 rounded flex items-center justify-center text-zinc-400">White packshot • 3000×3000</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Meta sees spreadsheet — low CTR</div>
                </div>
                <div className="border rounded-lg p-3 bg-violet-50 border-violet-200">
                  <div className="text-violet-700">After (enriched)</div>
                  <div className="mt-2 h-24 bg-zinc-900 rounded flex flex-col items-center justify-center text-white text-xs"><span>NOT MY DRAMA</span><span className="mt-1 bg-white text-black px-2 py-0.5 rounded-full text-[11px]">17.90 EUR</span></div>
                  <div className="text-[11px] text-violet-700 mt-1">Brand frame + price badge on every SKU</div>
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-medium">2. Lint feed (Validate)</h3>
              <p className="text-sm text-zinc-600">We flagged <strong>1 error</strong> in Gibun: “Not My Drama 200g Nachfüllpackung” missing <code className="bg-zinc-100 px-1 rounded text-xs">image_link</code>. Fix in Shopify before Meta will accept feed.</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <div className="font-mono text-xs">ERROR • Missing image_link — 1 / 31</div>
                <div className="text-xs text-red-700 mt-1">SEM003-NFP-AT-BIO-301 → Not My Drama 200g Nachfüllpackung — will be rejected</div>
              </div>
              <a href="/validate" className="inline-flex text-xs px-3 py-1.5 bg-zinc-900 text-white rounded">Open Validate →</a>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-medium">3. HTML Editor (no canvas lib)</h3>
              <p className="text-sm text-zinc-600">Drag product image, edit <code className="bg-zinc-100 px-1 rounded text-xs">{`{{title}} {{price}} {{discount_pct}}`}</code>, switch sizes 1:1 / 4:5 / 9:16. Pure DOM — exports to PNG via <code className="bg-zinc-100 px-1 rounded text-xs">next/og</code> and doubles as HTML5 ad.</p>
              <ul className="text-xs list-disc ml-5 text-zinc-700 space-y-1">
                <li>AI Assist: prompt “add red sale badge” → creates <code className="bg-zinc-100 px-1 rounded">{"{{discount_pct}}% OFF"}</code> layer</li>
                <li>Copy JSON → paste to ChatGPT/Claude → Import JSON</li>
                <li>Save to Server → template gets ID for feed</li>
              </ul>
              <a href="/editor" className="inline-flex text-xs px-3 py-1.5 bg-violet-600 text-white rounded">Open Editor →</a>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="font-medium">4. Enriched feed for Meta</h3>
              <p className="text-sm text-zinc-600">After Save, Editor shows <code className="bg-violet-100 px-1 rounded text-xs">/api/feed?domain=store.gibun.at&templateId=xxx</code>. Every <code className="bg-zinc-100 px-1 rounded text-xs">image_link</code> becomes <code className="bg-zinc-100 px-1 rounded text-xs">/api/render?templateId=xxx&handle=...</code> — Meta fetches server-rastered PNGs (cached 24h).</p>
              <div className="bg-zinc-900 text-zinc-100 rounded-lg p-3 font-mono text-xs break-all">https://catalog-forge/api/feed?domain=store.gibun.at&templateId=tpl_abc123</div>
              <div className="text-xs text-zinc-500">Paste into Commerce Manager → Data Sources → Data Feed → Scheduled Fetch (daily).</div>
            </div>
          )}
        </div>

        <div className="border-t p-4 flex items-center justify-between">
          <button onClick={dismiss} className="text-xs text-zinc-500 underline">Skip, don’t show again</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep((s) => s - 1)} className="px-3 py-1.5 border rounded text-xs">Back</button>}
            {step < 4 ? <button onClick={() => setStep((s) => s + 1)} className="px-4 py-1.5 bg-zinc-900 text-white rounded text-xs">Next →</button> : <button onClick={dismiss} className="px-4 py-1.5 bg-violet-600 text-white rounded text-xs">Start building →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
