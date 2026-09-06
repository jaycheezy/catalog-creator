export class DurableStorageError extends Error {
  readonly code = "DURABLE_STORAGE_FAILED";
  readonly retryable = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DurableStorageError";
  }
}

import { getStoreBucket, type StoreBucket } from "./r2Client";

function localFallbackEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    process.env.CATALOG_FORGE_ALLOW_LOCAL_STORAGE === "true"
  );
}

export function isLocalFallbackEnabled(): boolean {
  return localFallbackEnabled();
}

/**
 * Resolve the shared template/project bucket for this request. Prefers the
 * S3-compatible R2 configuration (Netlify production), then the Cloudflare
 * binding (Worker deployments), then null for the local file fallback.
 * Production without any configured storage throws instead of pretending.
 */
export async function getTemplatesBucket(): Promise<StoreBucket | null> {
  try {
    const bucket = await getStoreBucket("templates");
    if (bucket) return bucket;
  } catch (error) {
    if (!localFallbackEnabled()) {
      throw new DurableStorageError("Durable storage is unavailable. Retry the save when R2 is available.", {
        cause: error,
      });
    }
    return null;
  }

  if (localFallbackEnabled()) return null;
  throw new DurableStorageError("R2 storage is not configured. The design was not saved.");
}

/**
 * Resolve the render-asset bucket for this request. Same precedence as the
 * templates bucket. Development and tests fall back to a memory adapter
 * resolved by the caller; production callers receive a DurableStorageError.
 */
export async function getRendersBucket(): Promise<StoreBucket | null> {
  try {
    const bucket = await getStoreBucket("renders");
    if (bucket) return bucket;
  } catch (error) {
    if (!localFallbackEnabled()) {
      throw new DurableStorageError("Durable render storage is unavailable. Retry the request when R2 is available.", {
        cause: error,
      });
    }
    return null;
  }

  if (localFallbackEnabled()) return null;
  throw new DurableStorageError("R2 render storage is not configured. Rendered images cannot be cached.");
}

export function durableStorageMessage(error: unknown): {
  error: string;
  code: string;
  retryable: boolean;
} {
  if (error instanceof DurableStorageError) {
    return { error: error.message, code: error.code, retryable: error.retryable };
  }
  return {
    error: "Durable storage did not confirm the save. Your draft is still available; retry the save.",
    code: "DURABLE_STORAGE_FAILED",
    retryable: true,
  };
}

export function asDurableStorageError(action: string, error: unknown): DurableStorageError {
  if (error instanceof DurableStorageError) return error;
  return new DurableStorageError(`${action} failed. Your draft was not marked as saved; retry the save.`, {
    cause: error,
  });
}
