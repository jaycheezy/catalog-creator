import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  applyStoryStatus,
  generateStoryMap,
  readStoryMapFiles,
} from "../../../../../scripts/story-map-content.mjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Story status changes are saved from local dev only — edit the story's Markdown frontmatter (status) to change it in this build.",
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
  const { id, status } = (body ?? {}) as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || typeof status !== "string" || !id || !status) {
    return NextResponse.json({ error: "Body needs string fields: id, status" }, { status: 400 });
  }
  let result;
  try {
    result = applyStoryStatus(readStoryMapFiles(process.cwd()), { id, status });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  if (!result.changed) return NextResponse.json({ changed: false, path: result.path });
  const updated = result.files.find((file) => file.path === result.path);
  if (!updated) return NextResponse.json({ error: "Status change produced no file" }, { status: 500 });
  try {
    fs.writeFileSync(path.join(process.cwd(), result.path), updated.source);
    generateStoryMap(process.cwd());
  } catch (error) {
    return NextResponse.json({ error: `Could not save the status: ${(error as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ changed: true, path: result.path, status });
}
