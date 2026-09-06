import type { Template } from "@/editor/types";
import { asDurableStorageError, getTemplatesBucket } from "./durableStorage";

const localPath = "/tmp/catalog-forge-templates.json";
const keyFor = (id: string) => `templates/${id}.json`;

async function readLocalTemplates(): Promise<Record<string, Template>> {
  const fs = await import("fs/promises");
  try {
    return JSON.parse(await fs.readFile(localPath, "utf8")) as Record<string, Template>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw asDurableStorageError("Reading the local template store", error);
  }
}

// File fallback for local edge runtime isolates (Next dev edge has no shared memory)
async function fileFallbackSave(template: Template): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const all = await readLocalTemplates();
    all[template.id] = template;
    const temporaryPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(all));
    await fs.rename(temporaryPath, localPath);
  } catch (error) {
    throw asDurableStorageError("Saving the local template", error);
  }
}

async function fileFallbackGet(id: string): Promise<Template | null> {
  return (await readLocalTemplates())[id] ?? null;
}

async function fileFallbackList(): Promise<Template[]> {
  return Object.values(await readLocalTemplates());
}

export async function saveTemplate(template: Template): Promise<void> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      await bucket.put(keyFor(template.id), JSON.stringify(template), {
        httpMetadata: { contentType: "application/json" },
      });
      return;
    }
    await fileFallbackSave(template);
  } catch (error) {
    throw asDurableStorageError("Saving the template to durable storage", error);
  }
}

export async function getTemplate(id: string): Promise<Template | null> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      const object = await bucket.get(keyFor(id));
      return object ? JSON.parse(await object.text()) as Template : null;
    }
    return fileFallbackGet(id);
  } catch (error) {
    throw asDurableStorageError("Reading the template from durable storage", error);
  }
}

export async function listTemplates(): Promise<Template[]> {
  try {
    const bucket = await getTemplatesBucket();
    if (!bucket) return fileFallbackList();

    const keys = await bucket.list("templates/");
    const objects = await Promise.all(keys.map((key) => bucket.get(key)));
    const templates = await Promise.all(
      objects
        .filter((object) => object !== null)
        .map(async (object) => JSON.parse(await object.text()) as Template)
    );
    return templates;
  } catch (error) {
    throw asDurableStorageError("Listing templates from durable storage", error);
  }
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
