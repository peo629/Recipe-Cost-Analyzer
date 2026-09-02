import { Router, type IRouter, raw } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, recipesTable, ingredientsTable } from "@workspace/db";
import { getStorageProvider } from "@workspace/storage-provider";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

/**
 * GET /api/storage/objects/:key
 *
 * Provider-agnostic object bridge. The Replit provider returns this
 * URL from `getSignedUrl()` because the underlying SDK doesn't expose
 * presigned URLs; the S3 provider returns a real presigned URL and
 * never hits this route. Either way, the browser uses the URL the
 * same way.
 */
router.get("/storage/objects/:key", async (req, res): Promise<void> => {
  const key = decodeURIComponent(req.params.key);
  try {
    const provider = await getStorageProvider();
    const buf = await provider.getObject(key);
    // Best-effort content type from extension; the provider doesn't
    // surface stored content-type metadata in its current interface.
    const ext = key.split(".").pop()?.toLowerCase();
    const ct =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buf);
  } catch (err) {
    req.log?.warn({ err, key }, "storage: object fetch failed");
    res.status(404).json({ error: "Object not found" });
  }
});

interface ImageOwnerConfig {
  table: typeof recipesTable | typeof ingredientsTable;
  prefix: "recipes" | "ingredients";
  notFound: string;
}

const RECIPE_CFG: ImageOwnerConfig = {
  table: recipesTable,
  prefix: "recipes",
  notFound: "Recipe not found",
};
const INGREDIENT_CFG: ImageOwnerConfig = {
  table: ingredientsTable,
  prefix: "ingredients",
  notFound: "Ingredient not found",
};

async function uploadOwnerImage(
  cfg: ImageOwnerConfig,
  ownerId: number,
  body: Buffer,
  contentType: string,
  log: { warn: (...a: unknown[]) => void } | undefined,
): Promise<{ status: number; payload: unknown }> {
  if (!ALLOWED_MIME.has(contentType)) {
    return {
      status: 415,
      payload: { error: `Unsupported content-type: ${contentType}` },
    };
  }
  if (body.length === 0) {
    return { status: 400, payload: { error: "Empty body" } };
  }
  if (body.length > MAX_IMAGE_BYTES) {
    return { status: 413, payload: { error: "Image too large" } };
  }

  const [existing] = await db
    .select()
    .from(cfg.table)
    .where(eq(cfg.table.id, ownerId));
  if (!existing) return { status: 404, payload: { error: cfg.notFound } };

  const provider = await getStorageProvider();
  const key = `${cfg.prefix}/${ownerId}/${randomUUID()}.${extFromMime(contentType)}`;

  await provider.putObject(key, body, {
    contentType,
    cacheControl: "private, max-age=300",
  });

  // Best-effort cleanup of the previous image; never fail the upload
  // because of it.
  const prevKey = (existing as { imageKey: string | null }).imageKey;
  if (prevKey && prevKey !== key) {
    try {
      await provider.deleteObject(prevKey);
    } catch (err) {
      log?.warn({ err, prevKey }, "storage: failed to delete previous image");
    }
  }

  await db
    .update(cfg.table)
    .set({ imageKey: key })
    .where(eq(cfg.table.id, ownerId));

  const url = await provider.getSignedUrl(key, 3600);
  return { status: 200, payload: { imageKey: key, imageUrl: url } };
}

async function deleteOwnerImage(
  cfg: ImageOwnerConfig,
  ownerId: number,
): Promise<{ status: number; payload?: unknown }> {
  const [existing] = await db
    .select()
    .from(cfg.table)
    .where(eq(cfg.table.id, ownerId));
  if (!existing) return { status: 404, payload: { error: cfg.notFound } };

  const prevKey = (existing as { imageKey: string | null }).imageKey;
  if (prevKey) {
    try {
      const provider = await getStorageProvider();
      await provider.deleteObject(prevKey);
    } catch {
      // swallow — DB is the source of truth for the pointer
    }
    await db
      .update(cfg.table)
      .set({ imageKey: null })
      .where(eq(cfg.table.id, ownerId));
  }
  return { status: 204 };
}

const rawImage = raw({ type: "image/*", limit: MAX_IMAGE_BYTES });

router.post("/recipes/:id/image", rawImage, async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
  const result = await uploadOwnerImage(
    RECIPE_CFG,
    id,
    req.body as Buffer,
    ct,
    req.log,
  );
  res.status(result.status).json(result.payload);
});

router.delete("/recipes/:id/image", async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await deleteOwnerImage(RECIPE_CFG, id);
  if (result.status === 204) {
    res.sendStatus(204);
    return;
  }
  res.status(result.status).json(result.payload);
});

router.post(
  "/ingredients/:id/image",
  rawImage,
  async (req, res): Promise<void> => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
    const result = await uploadOwnerImage(
      INGREDIENT_CFG,
      id,
      req.body as Buffer,
      ct,
      req.log,
    );
    res.status(result.status).json(result.payload);
  },
);

router.delete("/ingredients/:id/image", async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await deleteOwnerImage(INGREDIENT_CFG, id);
  if (result.status === 204) {
    res.sendStatus(204);
    return;
  }
  res.status(result.status).json(result.payload);
});

/**
 * Helper used by recipes/ingredients formatters to attach a fresh
 * signed URL for the stored image, if any.
 */
export async function resolveImageUrl(
  imageKey: string | null | undefined,
): Promise<string | null> {
  if (!imageKey) return null;
  try {
    const provider = await getStorageProvider();
    return await provider.getSignedUrl(imageKey, 3600);
  } catch {
    return null;
  }
}

export default router;
