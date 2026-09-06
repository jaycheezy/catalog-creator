import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the hosting story's seam: only src/lib/r2Client.ts may touch
// Cloudflare bindings or R2 SDK types for storage. Everything else goes
// through StoreBucket, so the app deploys on hosts without bindings.
const SRC = path.join(process.cwd(), "src");
const SEAM = path.join("src", "lib", "r2Client.ts");
const SKIP_BASENAMES = new Set(["fonts.ts"]);

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") && !SKIP_BASENAMES.has(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("storage seam boundary", () => {
  it("confines Cloudflare and R2 SDK references to the seam module", () => {
    const bindingImporters: string[] = [];
    const r2TypeUsers: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const relative = path.relative(process.cwd(), file);
      const source = fs.readFileSync(file, "utf8");
      if (/@opennextjs\/cloudflare|getCloudflareContext/.test(source)) bindingImporters.push(relative);
      if (/\bR2Bucket\b|\bR2Object\w*\b/.test(source)) r2TypeUsers.push(relative);
    }
    expect(bindingImporters).toEqual([SEAM]);
    expect(r2TypeUsers).toEqual([SEAM]);
  });
});
