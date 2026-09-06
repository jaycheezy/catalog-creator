// Baseline is the current application renderer, not the service implementation.
import { ImageResponse } from "next/og";
import { renderTemplateElement } from "@/editor/renderElement";
import { interFonts } from "@/editor/fonts";
import type { RenderJob } from "./route";
export async function reference(job: RenderJob) {
  return new Uint8Array(await new ImageResponse(renderTemplateElement(job.template, job.product), {
    width: job.width, height: job.height, fonts: interFonts(),
  }).arrayBuffer());
}
export { SIZE_PRESETS } from "@/editor/types";
export { adaptTemplateToSize } from "@/editor/autoLayout";
