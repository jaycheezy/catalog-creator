import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const s3 = vi.hoisted(() => ({
  sent: [] as { name: string; input: Record<string, unknown> }[],
  getHandler: null as null | ((input: Record<string, unknown>) => unknown),
  putHandler: null as null | ((input: Record<string, unknown>) => unknown),
  listPages: [] as Record<string, unknown>[],
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      s3.sent.push({ name: this.constructor.name, input });
    }
  }
  class S3Client {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      if (command.constructor.name === "GetObjectCommand" && s3.getHandler) return s3.getHandler(command.input);
      if (command.constructor.name === "PutObjectCommand" && s3.putHandler) return s3.putHandler(command.input);
      if (command.constructor.name === "ListObjectsV2Command") {
        const token = command.input.ContinuationToken as string | undefined;
        const page = token ? s3.listPages[1] : s3.listPages[0];
        if (!page) throw new Error("no list page stubbed");
        return page;
      }
      throw new Error(`unexpected command ${command.constructor.name}`);
    }
  }
  return {
    S3Client,
    GetObjectCommand: class extends FakeCommand {},
    PutObjectCommand: class extends FakeCommand {},
    ListObjectsV2Command: class extends FakeCommand {},
  };
});

import { getStoreBucket } from "@/lib/r2Client";

const ENV = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_TEMPLATES_BUCKET: "templates-bucket",
  R2_RENDERS_BUCKET: "renders-bucket",
};

beforeEach(() => {
  s3.sent.length = 0;
  s3.getHandler = null;
  s3.putHandler = null;
  s3.listPages = [];
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S3-compatible R2 seam", () => {
  it("puts with content type and metadata against the configured endpoint", async () => {
    let putInput: Record<string, unknown> = {};
    s3.putHandler = async (input) => {
      putInput = input;
      return {};
    };
    const bucket = await getStoreBucket("templates");
    expect(await bucket!.put("templates/abc.json", JSON.stringify({ hello: "world" }), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { etag: '"abc"' },
      onlyIf: { etagMatches: '"previous"' },
    })).toBe(true);
    expect(putInput).toMatchObject({
      Bucket: "templates-bucket",
      Key: "templates/abc.json",
      ContentType: "application/json",
      Metadata: { etag: '"abc"' },
      IfMatch: '"previous"',
    });
    expect(s3.sent[0].name).toBe("PutObjectCommand");
  });

  it("reads bytes, text, and metadata, and maps missing keys to null", async () => {
    const bytes = new TextEncoder().encode("{\"rev\":2}");
    s3.getHandler = async (input) => {
      expect(input).toMatchObject({ Bucket: "renders-bucket", Key: "renders/v1/x.png" });
      return { Body: { transformToByteArray: async () => bytes }, ETag: '"stored"', Metadata: { etag: '"x.2.r1"' } };
    };
    const bucket = await getStoreBucket("renders");
    const object = await bucket!.get("renders/v1/x.png");
    expect(await object!.text()).toBe("{\"rev\":2}");
    expect([...new Uint8Array(await object!.arrayBuffer())]).toEqual([...bytes]);
    expect(object!.customMetadata).toEqual({ etag: '"x.2.r1"' });
    expect(object!.etag).toBe('"stored"');

    s3.getHandler = async () => {
      throw Object.assign(new Error("not found"), { name: "NoSuchKey" });
    };
    expect(await bucket!.get("renders/v1/missing.png")).toBeNull();
  });

  it("reports a lost S3 conditional write without treating it as storage failure", async () => {
    s3.putHandler = async () => {
      throw Object.assign(new Error("precondition failed"), { name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } });
    };
    const bucket = await getStoreBucket("templates");
    expect(await bucket!.put("catalog-publications/v1/p.json", "{}", {
      onlyIf: { etagDoesNotMatch: "*" },
    })).toBe(false);
    expect(s3.sent[0].input).toMatchObject({ IfNoneMatch: "*" });
  });

  it("lists paginated keys under a prefix", async () => {
    s3.listPages = [
      { Contents: [{ Key: "templates/a.json" }], IsTruncated: true, NextContinuationToken: "t" },
      { Contents: [{ Key: "templates/b.json" }, { Key: "other.json" }], IsTruncated: false },
    ];
    const bucket = await getStoreBucket("templates");
    expect(await bucket!.list("templates/")).toEqual(["templates/a.json", "templates/b.json", "other.json"]);
  });

  it("falls through without S3 configuration and requires complete credentials", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    expect(await getStoreBucket("templates")).toBeNull();
    for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
    expect(await getStoreBucket("renders")).toBeNull();
  });
});
