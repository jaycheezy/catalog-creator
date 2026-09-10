import type { CatalogPublicationRecord, PublicationAttempt } from "./catalogPublication";
import { publicationKey } from "./catalogPublication";
import { asDurableStorageError, getTemplatesBucket } from "./durableStorage";

const localPath = "/tmp/catalog-forge-publications.json";
const keyFor = (id: string) => publicationKey(id);
const MAX_CONDITIONAL_ATTEMPTS = 4;

export class PublicationWriteConflictError extends Error {
  readonly code = "PUBLICATION_CONFLICT";

  constructor(readonly currentRevision: number) {
    super("A newer project revision is already published. Reload before publishing again.");
    this.name = "PublicationWriteConflictError";
  }
}

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

let localMutationTail: Promise<void> = Promise.resolve();

function attemptIsAtLeastAsRecent(
  candidate: PublicationAttempt,
  baseline: PublicationAttempt,
): boolean {
  return candidate.attemptedRevision > baseline.attemptedRevision || (
    candidate.attemptedRevision === baseline.attemptedRevision &&
    candidate.attemptedAt >= baseline.attemptedAt
  );
}

async function mutateLocal(
  projectId: string,
  mutate: (current: CatalogPublicationRecord) => CatalogPublicationRecord,
): Promise<CatalogPublicationRecord> {
  const previous = localMutationTail;
  let release = () => {};
  localMutationTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const current = (await readLocal(projectId)) ?? {
      schemaVersion: 1,
      projectId,
      active: null,
      lastAttempt: null,
    };
    const next = mutate(current);
    if (next !== current) await writeLocal(next);
    return next;
  } finally {
    release();
  }
}

/**
 * Atomically update one publication record. R2/S3 conditional puts prevent a
 * failed or older request from replacing a publication written concurrently.
 */
async function mutatePublicationRecord(
  projectId: string,
  mutate: (current: CatalogPublicationRecord) => CatalogPublicationRecord,
): Promise<CatalogPublicationRecord> {
  try {
    const bucket = await getTemplatesBucket();
    if (!bucket) return mutateLocal(projectId, mutate);
    const key = keyFor(projectId);
    for (let attempt = 0; attempt < MAX_CONDITIONAL_ATTEMPTS; attempt++) {
      const object = await bucket.get(key);
      const current = object
        ? JSON.parse(await object.text()) as CatalogPublicationRecord
        : { schemaVersion: 1 as const, projectId, active: null, lastAttempt: null };
      const next = mutate(current);
      if (next === current) return current;
      if (object && !object.etag) {
        throw new Error("Publication storage did not provide an ETag for a guarded update.");
      }
      const written = await bucket.put(key, JSON.stringify(next), {
        httpMetadata: { contentType: "application/json" },
        onlyIf: object
          ? { etagMatches: object.etag! }
          : { etagDoesNotMatch: "*" },
      });
      if (written) return next;
    }
    throw new Error("Publication record kept changing during the guarded update.");
  } catch (error) {
    if (error instanceof PublicationWriteConflictError) throw error;
    throw asDurableStorageError("Updating the publication record", error);
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
  if (record.active) {
    await activatePublicationRecord(record);
    return;
  }
  const lastAttempt = record.lastAttempt;
  if (lastAttempt?.status === "failed") {
    await recordPublicationFailure(record.projectId, { ...lastAttempt, status: "failed" });
    return;
  }
  await mutatePublicationRecord(record.projectId, (current) =>
    current.active || current.lastAttempt ? current : record,
  );
}

/** Activate a snapshot without allowing an older request to replace a newer one. */
export async function activatePublicationRecord(record: CatalogPublicationRecord): Promise<CatalogPublicationRecord> {
  if (!record.active) throw new Error("An active publication snapshot is required.");
  return mutatePublicationRecord(record.projectId, (current) => {
    const currentRevision = current.active?.projectRevision ?? -1;
    const nextRevision = record.active!.projectRevision;
    if (currentRevision > nextRevision) throw new PublicationWriteConflictError(currentRevision);
    // Publishing the same saved project revision is idempotent. Keep its
    // original timestamp and bytes instead of churning the public record.
    if (currentRevision === nextRevision && current.active) return current;
    // Activation and attempt history advance independently. A publish that
    // started from an older draft may still complete after a newer draft's
    // failed attempt; activate its valid snapshot without erasing that newer
    // diagnostic from the editor's reopen state.
    const lastAttempt = current.lastAttempt && record.lastAttempt &&
      attemptIsAtLeastAsRecent(current.lastAttempt, record.lastAttempt)
      ? current.lastAttempt
      : record.lastAttempt;
    return { ...record, lastAttempt };
  });
}

/** Record a deterministic failed attempt while preserving any newer active snapshot. */
export async function recordPublicationFailure(
  projectId: string,
  attempt: PublicationAttempt & { status: "failed" },
): Promise<CatalogPublicationRecord> {
  return mutatePublicationRecord(projectId, (current) => {
    if ((current.active?.projectRevision ?? -1) >= attempt.attemptedRevision) return current;
    const last = current.lastAttempt;
    if (last && attemptIsAtLeastAsRecent(last, attempt)) return current;
    return { ...current, lastAttempt: attempt };
  });
}
