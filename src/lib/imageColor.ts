/* Tiny average-color sampler (living-glow features). Reads a 24px thumbnail —
   microseconds of work — and never throws: tainted canvases (no CORS from
   the image host) simply yield null so callers keep their fallback. */

export function sampleImageColor(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1;
    }
    return `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`;
  } catch {
    return null;
  }
}
