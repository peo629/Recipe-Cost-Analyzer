export interface PutObjectOptions {
  /** MIME type of the object body (e.g. "image/jpeg"). */
  contentType?: string;
  /** Optional cache-control header to attach to the stored object. */
  cacheControl?: string;
  /** Object metadata as plain key/value pairs. */
  metadata?: Record<string, string>;
}

export interface ListEntry {
  key: string;
  size?: number;
  lastModified?: Date;
}

export interface StorageProvider {
  name: "replit" | "s3";
  /** Underlying bucket / namespace identifier (for logging / debugging only). */
  bucket: string;
  putObject(
    key: string,
    body: Buffer | Uint8Array | string,
    opts?: PutObjectOptions,
  ): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  /** Presigned URL valid for `ttlSeconds` for browser-direct GET. */
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  list(prefix?: string): Promise<ListEntry[]>;
}
