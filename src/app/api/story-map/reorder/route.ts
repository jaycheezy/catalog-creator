import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  applySliceOrder,
  generateStoryMap,
  readStoryMap,
  readStoryMapFiles,
} from "../../../../../scripts/story-map-content.mjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Slice order is saved from local dev only — edit each slice's index.md frontmatter (order) to reorder it in this build.",
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
  const { order } = (body ?? {}) as { order?: unknown };
  if (!Array.isArray(order) || !order.every((id): id is string => typeof id === "string")) {
    return NextResponse.json({ error: "Body needs an order field: string array of slice ids" }, { status: 400 });
  }
  const root = process.cwd();
  try {
    readStoryMap(root);
  } catch (error) {
    return NextResponse.json({ error: `Story map is currently invalid: ${(error as Error).message}` }, { status: 409 });
  }
  const before = readStoryMapFiles(root);
  let result;
  try {
    result = applySliceOrder(before, order);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  if (!result.changed.length) return NextResponse.json({ moved: false, changed: [] });
  const previous = new Map(
    result.changed.map((filePath) => [filePath, before.find((file) => file.path === filePath)?.source ?? ""] as const),
  );
  try {
    for (const filePath of result.changed) {
      const updated = result.files.find((file) => file.path === filePath);
      if (!updated) throw new Error(`Reorder produced no file for ${filePath}`);
      fs.writeFileSync(path.join(root, filePath), updated.source);
    }
    generateStoryMap(root);
  } catch (error) {
    try {
      for (const [filePath, source] of previous) {
        if (source) fs.writeFileSync(path.join(root, filePath), source);
      }
    } catch {
      /* Rollback is best-effort; report the original failure. */
    }
    return NextResponse.json({ error: `Could not save the slice order: ${(error as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ moved: true, changed: result.changed });
}
