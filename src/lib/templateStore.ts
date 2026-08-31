// Simple template store — R2 when available on Cloudflare, fallback to file + global for local dev
import type { Template } from "@/editor/types";

declare global {
  var __CF_TEMPLATES__: Map<string, Template> | undefined;
}

function getMemory(): Map<string, Template> {
  if (!globalThis.__CF_TEMPLATES__) globalThis.__CF_TEMPLATES__ = new Map<string, Template>();
  return globalThis.__CF_TEMPLATES__;
}

async function getEnv(): Promise<Record<string, unknown> | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = (mod as unknown as { getCloudflareContext: () => { env: Record<string, unknown> } }).getCloudflareContext();
    return ctx?.env ?? null;
  } catch {
    return null;
  }
}

function getBucket(env: Record<string, unknown> | null, name: string): unknown | null {
  if (!env) return null;
  return (env[name] as unknown) ?? null;
}

// File fallback for local edge runtime isolates (Next dev edge has no shared memory)
async function fileFallbackSave(template: Template): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = "/tmp/catalog-forge-templates.json";
    let all: Record<string, Template> = {};
    try {
      const text = await fs.readFile(path, "utf-8");
      all = JSON.parse(text);
    } catch {}
    all[template.id] = template;
    await fs.writeFile(path, JSON.stringify(all));
  } catch {}
}

async function fileFallbackGet(id: string): Promise<Template | null> {
  try {
    const fs = await import("fs/promises");
    const text = await fs.readFile("/tmp/catalog-forge-templates.json", "utf-8");
    const all = JSON.parse(text) as Record<string, Template>;
    return all[id] ?? null;
  } catch {
    return null;
  }
}

async function fileFallbackList(): Promise<Template[]> {
  try {
    const fs = await import("fs/promises");
    const text = await fs.readFile("/tmp/catalog-forge-templates.json", "utf-8");
    const all = JSON.parse(text) as Record<string, Template>;
    return Object.values(all);
  } catch {
    return [];
  }
}

export async function saveTemplate(template: Template): Promise<void> {
  getMemory().set(template.id, template);
  await fileFallbackSave(template);
  try {
    const env = await getEnv();
    const bucket = getBucket(env, "TEMPLATES_BUCKET") as { put: (k: string, v: string, o: unknown) => Promise<void> } | null;
    if (bucket) {
      await bucket.put(`templates/${template.id}.json`, JSON.stringify(template), {
        httpMetadata: { contentType: "application/json" },
      });
    }
  } catch (e) {
    console.warn("saveTemplate R2 failed, using memory/file", e);
  }
}

export async function getTemplate(id: string): Promise<Template | null> {
  const mem = getMemory().get(id);
  if (mem) return mem;
  const file = await fileFallbackGet(id);
  if (file) {
    getMemory().set(id, file);
    return file;
  }
  try {
    const env = await getEnv();
    const bucket = getBucket(env, "TEMPLATES_BUCKET") as { get: (k: string) => Promise<{ text: () => Promise<string> } | null> } | null;
    if (bucket) {
      const obj = await bucket.get(`templates/${id}.json`);
      if (obj) {
        const text = await obj.text();
        const parsed = JSON.parse(text) as Template;
        getMemory().set(id, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn("getTemplate R2 failed", e);
  }
  return null;
}

export async function listTemplates(): Promise<Template[]> {
  const fileList = await fileFallbackList();
  if (fileList.length) return fileList;
  try {
    const env = await getEnv();
    const bucket = getBucket(env, "TEMPLATES_BUCKET") as { list: (o: unknown) => Promise<{ objects: { key: string }[] }>; get: (k: string) => Promise<{ text: () => Promise<string> } | null> } | null;
    if (bucket) {
      const listed = await bucket.list({ prefix: "templates/" });
      const out: Template[] = [];
      for (const obj of listed.objects) {
        const got = await bucket.get(obj.key);
        if (got) out.push(JSON.parse(await got.text()) as Template);
      }
      if (out.length) return out;
    }
  } catch {}
  return Array.from(getMemory().values());
}

export function decodeTemplateParam(param: string | null): Template | null {
  if (!param) return null;
  try {
    const json = Buffer.from(param, "base64").toString("utf-8");
    return JSON.parse(json) as Template;
  } catch {
    return null;
  }
}
