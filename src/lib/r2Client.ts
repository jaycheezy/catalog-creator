// Single R2 access seam for hosting story c-external-render-service.
//
// Resolution order per bucket: S3-compatible environment variables (Netlify
// production) → Cloudflare binding (Worker deployments, rollback) → null,
// in which case callers use their local fallback. Only this module may import
// the S3 client or Cloudflare context for storage; everything else goes
// through StoreBucket. An automated test pins that boundary.

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StoreObject = {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  customMetadata?: Record<string, string>;
};

export type StoreBucketPutOptions = {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

export type StoreBucket = {
  get(key: string): Promise<StoreObject | null>;
  put(key: string, body: string | Uint8Array | ArrayBuffer, options?: StoreBucketPutOptions): Promise<void>;
  list(prefix: string): Promise<string[]>;
};

export type BucketName = "templates" | "renders";

type S3Settings = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function s3Settings(bucketEnv: string): S3Settings | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env[bucketEnv];
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

class S3StoreBucket implements StoreBucket {
  private readonly client: S3Client;
  constructor(private readonly settings: S3Settings) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    });
  }

  async get(key: string): Promise<StoreObject | null> {
    let response;
    try {
      response = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }));
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return {
      arrayBuffer: async () => copyBytes(bytes),
      text: async () => new TextDecoder().decode(bytes),
      // S3 normalizes user metadata keys to lowercase; our keys already are.
      customMetadata: response.Metadata ? { ...response.Metadata } : undefined,
    };
  }

  async put(key: string, body: string | Uint8Array | ArrayBuffer, options?: StoreBucketPutOptions): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.settings.bucket,
      Key: key,
      Body: typeof body === "string" ? body : new Uint8Array(body instanceof ArrayBuffer ? body : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
      ContentType: options?.httpMetadata?.contentType,
      Metadata: options?.customMetadata,
    }));
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({
        Bucket: this.settings.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }));
      for (const object of page.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
}

class R2StoreBucket implements StoreBucket {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string): Promise<StoreObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      arrayBuffer: async () => copyBytes(new Uint8Array(await object.arrayBuffer())),
      text: async () => object.text(),
      customMetadata: object.customMetadata ? { ...object.customMetadata } : undefined,
    };
  }

  async put(key: string, body: string | Uint8Array | ArrayBuffer, options?: StoreBucketPutOptions): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: options?.httpMetadata?.contentType ? { contentType: options.httpMetadata.contentType } : undefined,
      customMetadata: options?.customMetadata,
    });
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix, cursor });
      keys.push(...page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
}

export async function getStoreBucket(name: BucketName): Promise<StoreBucket | null> {
  const settings = s3Settings(name === "templates" ? "R2_TEMPLATES_BUCKET" : "R2_RENDERS_BUCKET");
  if (settings) return new S3StoreBucket(settings);
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const bucket = getCloudflareContext().env[name === "templates" ? "TEMPLATES_BUCKET" : "RENDERS_BUCKET"];
    if (bucket) return new R2StoreBucket(bucket as R2Bucket);
  } catch {
    // No Cloudflare runtime: callers fall back to local storage or fail.
  }
  return null;
}
