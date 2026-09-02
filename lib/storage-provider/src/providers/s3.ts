import type { ListEntry, PutObjectOptions, StorageProvider } from "../types.js";

/**
 * S3-compatible storage provider. Works against AWS S3 by default and any
 * S3-API-compatible service (Cloudflare R2, MinIO, Backblaze B2, your own
 * CDN edge) when `AWS_S3_ENDPOINT` is set.
 *
 * Required env: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY`. Optional: `AWS_S3_ENDPOINT`,
 * `AWS_S3_FORCE_PATH_STYLE` ("true" for MinIO/B2).
 */
export async function createS3StorageProvider(): Promise<StorageProvider> {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "STORAGE_PROVIDER=s3 requires AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
    );
  }
  const endpoint = process.env.AWS_S3_ENDPOINT || undefined;
  const forcePathStyle =
    (process.env.AWS_S3_FORCE_PATH_STYLE ?? "").toLowerCase() === "true" ||
    Boolean(endpoint);

  const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
  } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  async function streamToBuffer(
    stream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
      } else {
        const u8 = chunk as Uint8Array;
        chunks.push(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength));
      }
    }
    return Buffer.concat(chunks);
  }

  return {
    name: "s3",
    bucket,
    async putObject(key, body, opts: PutObjectOptions = {}) {
      let buf: Buffer;
      if (typeof body === "string") {
        buf = Buffer.from(body, "utf8");
      } else if (Buffer.isBuffer(body)) {
        buf = body;
      } else {
        buf = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
      }
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buf,
          ContentType: opts.contentType,
          CacheControl: opts.cacheControl,
          Metadata: opts.metadata,
        }),
      );
    },
    async getObject(key) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const body = res.Body as NodeJS.ReadableStream | undefined;
      if (!body)
        throw new Error(`S3 get returned empty body for key '${key}'.`);
      return streamToBuffer(body);
    },
    async getSignedUrl(key, ttlSeconds) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: ttlSeconds },
      );
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async list(prefix) {
      const res = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
      );
      return (res.Contents ?? []).map<ListEntry>((c) => ({
        key: c.Key ?? "",
        size: c.Size,
        lastModified: c.LastModified,
      }));
    },
  };
}
