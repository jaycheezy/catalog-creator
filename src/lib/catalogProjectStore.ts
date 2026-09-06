import type { CatalogProject } from "./catalogProject";
import { asDurableStorageError, getTemplatesBucket } from "./durableStorage";

const localPath = "/tmp/catalog-forge-projects.json";
const keyFor = (id: string) => `catalog-projects/${id}.json`;

async function readLocal(id: string): Promise<CatalogProject | null> {
  try {
    const fs = await import("fs/promises");
    const all = JSON.parse(await fs.readFile(localPath, "utf8")) as Record<string, CatalogProject>;
    return all[id] ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw asDurableStorageError("Reading the local catalog project store", error);
  }
}

async function writeLocal(project: CatalogProject): Promise<void> {
  try {
    const fs = await import("fs/promises");
    let all: Record<string, CatalogProject> = {};
    try {
      all = JSON.parse(await fs.readFile(localPath, "utf8")) as Record<string, CatalogProject>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    all[project.id] = project;
    const temporaryPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(all));
    await fs.rename(temporaryPath, localPath);
  } catch (error) {
    throw asDurableStorageError("Saving the local catalog project", error);
  }
}

export async function saveCatalogProject(project: CatalogProject): Promise<void> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      await bucket.put(keyFor(project.id), JSON.stringify(project), {
        httpMetadata: { contentType: "application/json" },
      });
      return;
    }
    await writeLocal(project);
  } catch (error) {
    throw asDurableStorageError("Saving the catalog project to durable storage", error);
  }
}

export async function getCatalogProject(id: string): Promise<CatalogProject | null> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      const object = await bucket.get(keyFor(id));
      return object ? JSON.parse(await object.text()) as CatalogProject : null;
    }
    return readLocal(id);
  } catch (error) {
    throw asDurableStorageError("Reading the catalog project from durable storage", error);
  }
}
