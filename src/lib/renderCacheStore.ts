// Versioned render-asset storage for story c-reliable-versioned-renders.
//
// Reads and writes immutable PNG bytes in RENDERS_BUCKET. Production always
// uses the binding; development and tests use a process-local memory adapter
// (never shipped as a success claim). The one RenderCacheResult union lets
// route tests assert hit, miss, unavailable, and write-failure paths.

import { DurableStorageError, getRendersBucket, isLocalFallbackEnabled } from "./durableStorage";
import { renderAssetEtag, renderAssetKey, type RenderAssetDescriptor, type RenderCacheResult } from "./renderCache";
import type { StoreBucket } from "./r2Client";

export type RenderBucket = StoreBucket;

const memory = new Map<string, { bytes: Uint8Array<ArrayBuffer>; etag: string }>();

/** Test-only reset for the development memory adapter. */
export function clearRenderMemoryForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("clearRenderMemoryForTests is test-only");
  memory.clear();
}

async function resolveBucket(explicit: RenderBucket | null | undefined): Promise<{ bucket: RenderBucket | null; explicit: boolean }> {
  // An explicit argument (including null) always wins so tests control the
  // seam; otherwise resolve the real binding, which throws in production
  // when R2 is unavailable.
  if (explicit !== undefined) return { bucket: explicit, explicit: true };
  return { bucket: await getRendersBucket(), explicit: false };
}

export async function readRenderAsset(
  descriptor: RenderAssetDescriptor,
  bucket?: RenderBucket | null,
): Promise<RenderCacheResult> {
  const key = renderAssetKey(descriptor);
  let resolved: RenderBucket | null;
  try {
    const outcome = await resolveBucket(bucket);
    resolved = outcome.bucket;
    if (!resolved && !outcome.explicit && isLocalFallbackEnabled()) {
      const cached = memory.get(key);
      return cached ? { kind: "hit", bytes: cached.bytes, etag: cached.etag } : { kind: "miss" };
    }
  } catch {
    return { kind: "unavailable" };
  }
  if (!resolved) return { kind: "unavailable" };
  try {
    const object = await resolved.get(key);
    if (!object) return { kind: "miss" };
    const bytes = new Uint8Array(await object.arrayBuffer());
    return { kind: "hit", bytes, etag: object.customMetadata?.etag ?? renderAssetEtag(descriptor) };
  } catch (error) {
    throw error instanceof DurableStorageError
      ? error
      : new DurableStorageError("Reading the cached render failed before rendering.", { cause: error });
  }
}

export async function writeRenderAsset(
  descriptor: RenderAssetDescriptor,
  bytes: Uint8Array<ArrayBuffer>,
  etag: string,
  bucket?: RenderBucket | null,
): Promise<void> {
  const key = renderAssetKey(descriptor);
  let resolved: RenderBucket | null;
  try {
    const outcome = await resolveBucket(bucket);
    resolved = outcome.bucket;
    if (!resolved) {
      if (!outcome.explicit && isLocalFallbackEnabled()) {
        memory.set(key, { bytes, etag });
        return;
      }
      throw new DurableStorageError("The RENDERS_BUCKET binding is missing. Rendered images cannot be cached.");
    }
  } catch (error) {
    throw error instanceof DurableStorageError
      ? error
      : new DurableStorageError("Storing the rendered image failed after rendering.", { cause: error });
  }
  try {
    await resolved.put(key, bytes, {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { etag },
    });
  } catch (error) {
    throw error instanceof DurableStorageError
      ? error
      : new DurableStorageError("Storing the rendered image failed after rendering.", { cause: error });
  }
}
