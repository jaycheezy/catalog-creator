import type { CatalogPublicationRecord } from "./catalogPublication";
import { publicationKey } from "./catalogPublication";
import { asDurableStorageError, getTemplatesBucket } from "./durableStorage";

const localPath = "/tmp/catalog-forge-publications.json";
const keyFor = (id: string) => publicationKey(id);

async function readLocal(id: string): Promise<CatalogPublicationRecord | null> {
  try {
    const fs = await import("fs/promises");
    const all = JSON.parse(await fs.readFile(localPath, "utf8")) as Record<string, CatalogPublicationRecord>;
    return all[id] ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw asDurableStorageError("Reading the local publication store", error);
  }
}

async function writeLocal(record: CatalogPublicationRecord): Promise<void> {
  try {
    const fs = await import("fs/promises");
    let all: Record<string, CatalogPublicationRecord> = {};
    try {
      all = JSON.parse(await fs.readFile(localPath, "utf8")) as Record<string, CatalogPublicationRecord>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    all[record.projectId] = record;
    const temporaryPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(all));
    await fs.rename(temporaryPath, localPath);
  } catch (error) {
    throw asDurableStorageError("Saving the local publication record", error);
  }
}

export async function getPublicationRecord(projectId: string): Promise<CatalogPublicationRecord | null> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      const object = await bucket.get(keyFor(projectId));
      return object ? (JSON.parse(await object.text()) as CatalogPublicationRecord) : null;
    }
    return readLocal(projectId);
  } catch (error) {
    throw asDurableStorageError("Reading the publication record from durable storage", error);
  }
}

/**
 * Persist the whole record in one object update so readers never observe a
 * half-published release. R2 object writes are atomic; callers build the
 * complete next record (active snapshot plus attempt) before calling.
 */
export async function savePublicationRecord(record: CatalogPublicationRecord): Promise<void> {
  try {
    const bucket = await getTemplatesBucket();
    if (bucket) {
      await bucket.put(keyFor(record.projectId), JSON.stringify(record), {
        httpMetadata: { contentType: "application/json" },
      });
      return;
    }
    await writeLocal(record);
  } catch (error) {
    throw asDurableStorageError("Saving the publication record to durable storage", error);
  }
}
