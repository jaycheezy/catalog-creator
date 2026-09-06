// Spike only: accepts synthetic embedded PNGs. Not a production image loader.
import { Worker } from "node:worker_threads";
import { timingSafeEqual } from "node:crypto";
import type { Template } from "@/editor/types";
import type { FeedRow } from "@/lib/facebook";
import { SIZE_PRESETS } from "@/editor/types";

export type RenderJob = {
  schemaVersion: 1; rendererVersion: 1; requestId: string;
  template: Template; product: FeedRow; width: number; height: number;
};
export const LIMITS = { jsonBytes: 1024 * 1024, pngBytes: 4 * 1024 * 1024,
  layers: 100, deadlineMs: 12000, concurrency: 1, queue: 0, imagePixels: 16000000 };
const privateHeaders = { "Cache-Control": "private, no-store" };
function failure(status: number, code: string, retryable = false) {
  return Response.json({ code, message: code.replaceAll("_", " ").toLowerCase(), retryable },
    { status, headers: { ...privateHeaders, ...(status === 429 ? { "Retry-After": "1" } : {}) } });
}
function validJob(value: unknown): value is RenderJob {
  if (!value || typeof value !== "object") return false;
  const job = value as RenderJob;
  if (job.schemaVersion !== 1 || job.rendererVersion !== 1 || !/^[a-zA-Z0-9-]{1,64}$/.test(job.requestId ?? "")) return false;
  const t = job.template;
  const p = job.product;
  if (!t || !p || !Array.isArray(t.layers) || t.layers.length > LIMITS.layers ||
      !SIZE_PRESETS.some(size => size.id === t.sizeId && size.width === job.width && size.height === job.height) ||
      t.width !== job.width || t.height !== job.height) return false;
  if (![p.id, p.title, p.price, p.description, p.brand, p.image_link].every(x => typeof x === "string")) return false;
  // Prevent arbitrary network/style input in this synthetic-only PoC.
  if (/url\s*\(/i.test(JSON.stringify(t))) return false;
  if (t.layers.some(l => !l || ![l.x,l.y,l.w,l.h,l.rotation,l.z].every(Number.isFinite) ||
      l.w < 0 || l.h < 0 || !l.style || !["text","shape","badge","product-image"].includes(l.type))) return false;
  if (p.image_link !== "") {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.image_link)) return false;
    const bytes = Buffer.from(p.image_link.split(",")[1], "base64");
    if (bytes.length < 24 || bytes.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" ||
        bytes.toString("ascii",12,16) !== "IHDR") return false;
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width * height > LIMITS.imagePixels) return false;
  }
  return true;
}

export function createRenderer(options: { token: string; workerPath: string; deadlineMs?: number }) {
  let worker: Worker | undefined;
  let busy = false;
  let maxActive = 0;
  let terminations = 0;
  const expected = Buffer.from(`Bearer ${options.token}`);
  async function POST(req: Request): Promise<Response> {
    if (!options.token) return failure(503, "RENDER_CONFIG_MISSING");
    const supplied = Buffer.from(req.headers.get("Authorization") ?? "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return failure(401, "UNAUTHORIZED");
    if (req.method !== "POST") return failure(405, "METHOD_NOT_ALLOWED");
    if (!req.headers.get("Content-Type")?.startsWith("application/json")) return failure(415, "JSON_REQUIRED");
    if (busy) return failure(429, "CAPACITY", true);
    busy = true; maxActive = 1;
    const started = performance.now();
    const deadline = started + (options.deadlineMs ?? LIMITS.deadlineMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const jobPromise = (async (): Promise<Response> => {
        reader = req.body?.getReader();
        if (!reader) return failure(400, "INVALID_JSON");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > LIMITS.jsonBytes) { await reader.cancel(); return failure(413, "PAYLOAD_TOO_LARGE"); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        if (performance.now() >= deadline || req.signal.aborted) return failure(504, "DEADLINE", true);
        let job: unknown;
        try { job = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { return failure(400, "INVALID_JSON"); }
        if (!validJob(job)) return failure(422, "INVALID_JOB");
        worker ??= new Worker(options.workerPath);
        const current = worker;
        return new Promise<Response>((resolve) => {
          const onError = () => { current.removeAllListeners("message"); current.removeListener("error", onError); current.removeListener("exit", onError); worker = undefined; resolve(failure(503, "RASTER_FAILED", true)); };
          current.once("error", onError);
          current.once("exit", onError);
          current.once("message", (result) => {
            current.removeAllListeners("message"); current.removeListener("error", onError); current.removeListener("exit", onError);
            if (result.error) { resolve(failure(503, "RASTER_FAILED", true)); return; }
            const bytes = Buffer.from(result.bytes);
            if (bytes.length > LIMITS.pngBytes) { resolve(failure(413, "PNG_TOO_LARGE")); return; }
            if (bytes.length < 24 || bytes.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" ||
                bytes.readUInt32BE(16) !== job.width || bytes.readUInt32BE(20) !== job.height) {
              resolve(failure(503, "INVALID_PNG")); return;
            }
            resolve(new Response(bytes, { headers: { ...privateHeaders, "Content-Type": "image/png",
              "X-Renderer-Version": "1", "X-Request-Id": job.requestId,
              "X-Spike-Render-Ms": String(result.renderMs), "X-Spike-Cpu-Ms": String(result.cpuMs),
              "X-Spike-Rss-Bytes": String(result.rssBytes) } }));
          });
          current.postMessage(job);
        });
      })();
      const interrupted = new Promise<Response>((resolve) => {
        abort = () => resolve(failure(499, "CANCELLED", true));
        req.signal.addEventListener("abort", abort, { once: true });
        timer = setTimeout(() => resolve(failure(504, "DEADLINE", true)), Math.max(1, deadline - performance.now()));
      });
      const response = await Promise.race([jobPromise, interrupted]);
      if (response.status === 504 || response.status === 499) {
        await reader?.cancel().catch(() => undefined);
        // Terminate the CPU worker, not just the response Promise.
        const active = worker; worker = undefined;
        if (active) { terminations++; await active.terminate(); }
      }
      return response;
    } finally {
      clearTimeout(timer);
      if (abort) req.signal.removeEventListener("abort", abort);
      busy = false;
    }
  }
  return { POST, stats: () => ({ active: Number(busy), maxActive, queued: 0, terminations }),
    close: async () => { await worker?.terminate(); worker = undefined; } };
}
