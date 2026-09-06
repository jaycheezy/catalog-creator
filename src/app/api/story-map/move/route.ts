import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import steps from "@/story-map/steps.json";
import {
  applyStoryMove,
  generateStoryMap,
  readStoryMap,
  readStoryMapFiles,
} from "../../../../../scripts/story-map-content.mjs";

export const runtime = "nodejs";

const stepIds = (steps as { id: string }[]).map((step) => step.id);

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Story moves are saved from local dev only — edit the story's Markdown frontmatter (slice/step) to move it in this build.",
      },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id, slice, step } = (body ?? {}) as { id?: unknown; slice?: unknown; step?: unknown };
  if (typeof id !== "string" || typeof slice !== "string" || typeof step !== "string" || !id || !slice || !step) {
    return NextResponse.json({ error: "Body needs string fields: id, slice, step" }, { status: 400 });
  }
  const root = process.cwd();
  let catalog;
  try {
    catalog = readStoryMap(root);
  } catch (error) {
    return NextResponse.json({ error: `Story map is currently invalid: ${(error as Error).message}` }, { status: 409 });
  }
  let result;
  try {
    result = applyStoryMove(readStoryMapFiles(root), { id, slice, step }, {
      steps: stepIds,
      sliceIds: catalog.slices.map((entry) => entry.id),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  if (!result.changed) return NextResponse.json({ moved: false, path: result.path });
  const moved = result.files.find((file) => file.path === result.path);
  if (!moved) return NextResponse.json({ error: "Move produced no file" }, { status: 500 });
  const previous = readStoryMapFiles(root).find((file) => file.path === result.prevPath);
  try {
    fs.writeFileSync(path.join(root, result.path), moved.source);
    if (result.prevPath !== result.path) fs.unlinkSync(path.join(root, result.prevPath));
    generateStoryMap(root);
  } catch (error) {
    try {
      if (previous) fs.writeFileSync(path.join(root, result.prevPath), previous.source);
      if (result.prevPath !== result.path && fs.existsSync(path.join(root, result.path))) {
        fs.unlinkSync(path.join(root, result.path));
      }
    } catch {
      /* Rollback is best-effort; report the original failure. */
    }
    return NextResponse.json({ error: `Could not save the move: ${(error as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ moved: true, path: result.path, prevPath: result.prevPath });
}
