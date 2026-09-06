import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { template } from "./fixtures/catalog";

const cloudflare = vi.hoisted(() => ({
  bucket: null as null | {
    get: (key: string) => Promise<{ text: () => Promise<string> } | null>;
    put: (key: string, value: string) => Promise<unknown>;
    list: () => Promise<{ objects: Array<{ key: string }>; truncated: false }>;
  },
  error: null as Error | null,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (cloudflare.error) throw cloudflare.error;
    return { env: { TEMPLATES_BUCKET: cloudflare.bucket } };
  },
}));

import { DurableStorageError, getTemplatesBucket } from "@/lib/durableStorage";
import { getTemplate, saveTemplate } from "@/lib/templateStore";

beforeEach(() => {
  cloudflare.bucket = null;
  cloudflare.error = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("durable template saves", () => {
  it("propagates an R2 write failure instead of falling back to local state", async () => {
    cloudflare.bucket = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => { throw new Error("R2 unavailable"); }),
      list: vi.fn(async () => ({ objects: [], truncated: false as const })),
    };

    await expect(saveTemplate(template)).rejects.toMatchObject({
      name: "DurableStorageError",
      retryable: true,
    });
    expect(cloudflare.bucket.put).toHaveBeenCalledOnce();
  });

  it("reads the latest R2 revision on every request", async () => {
    let stored = JSON.stringify({ ...template, name: "Revision one", revision: 1 });
    cloudflare.bucket = {
      get: vi.fn(async () => ({ text: async () => stored })),
      put: vi.fn(async (_key, value) => { stored = value; }),
      list: vi.fn(async () => ({ objects: [], truncated: false as const })),
    };

    expect((await getTemplate(template.id))?.revision).toBe(1);
    stored = JSON.stringify({ ...template, name: "Revision two", revision: 2 });
    expect(await getTemplate(template.id)).toMatchObject({ name: "Revision two", revision: 2 });
    expect(cloudflare.bucket.get).toHaveBeenCalledTimes(2);
  });

  it("refuses a production file fallback when the R2 context is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    cloudflare.error = new Error("No Cloudflare context");

    await expect(getTemplatesBucket()).rejects.toBeInstanceOf(DurableStorageError);
  });
});
