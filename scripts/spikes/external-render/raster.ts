// Isolated PoC raster worker: identical native Next engine/projection, no network.
import { parentPort } from "node:worker_threads";
import { ImageResponse } from "next/og";
import { renderTemplateElement } from "@/editor/renderElement";
import { interFonts } from "@/editor/fonts";
import type { RenderJob } from "./route";

globalThis.fetch = async () => { throw new Error("Network disabled in synthetic renderer spike"); };
parentPort!.on("message", async (job: RenderJob) => {
  const started = performance.now();
  const cpu = process.cpuUsage();
  try {
    const output = new ImageResponse(renderTemplateElement(job.template, job.product), {
      width: job.width, height: job.height, fonts: interFonts(),
    });
    const bytes = new Uint8Array(await output.arrayBuffer());
    const usage = process.cpuUsage(cpu);
    parentPort!.postMessage({ bytes, renderMs: performance.now() - started,
      cpuMs: (usage.user + usage.system) / 1000, rssBytes: process.memoryUsage().rss });
  } catch {
    parentPort!.postMessage({ error: true });
  }
});
