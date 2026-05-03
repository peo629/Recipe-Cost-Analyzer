---
title: Smoke Tests
category: smoke
runner: tsx (direct)
command: pnpm test:smoke
last_updated: "2026-05-02"
---

# Smoke Tests

Live integration smoke tests that verify the AI and storage provider integrations are wired correctly end-to-end. Each script skips cleanly (exit 0, prints `SKIPPED`) when the required environment variables are absent, so they are safe to include in CI pipelines that don't have live credentials.

These are promoted and expanded versions of the original scripts in `lib/ai-provider/scripts/smoke.ts` and `lib/storage-provider/scripts/smoke.ts`.

## Test files

| File                  | Provider                                                    | Env vars required             | What it verifies                                                                                     |
| --------------------- | ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ai-provider.ts`      | Chat (replit/openai/openrouter) + Embedding (openai/voyage) | Depends on `AI_PROVIDER`      | One chat completion round-trip (ping → PONG); one embedding round-trip if embedding keys are present |
| `storage-provider.ts` | Replit App Storage / S3                                     | Depends on `STORAGE_PROVIDER` | put → get (round-trip body match) → signed URL → delete                                              |

---

### `ai-provider.ts`

**Chat smoke (always runs, may skip)**

- If `AI_PROVIDER=replit` and keys are missing → SKIPPED.
- If `AI_PROVIDER=openai` and `OPENAI_API_KEY` is missing → SKIPPED.
- If `AI_PROVIDER=openrouter` and `OPENROUTER_API_KEY` is missing → SKIPPED.
- Otherwise: sends a system + user message ("ping"), asserts a response is returned (any text), records model name and token usage.

**Embedding smoke (skips unless key present)**

- Skipped when neither `OPENAI_API_KEY` nor `VOYAGE_API_KEY` is set.
- Otherwise: embeds a short test string, asserts `dimensions > 0`, records model name and token usage.

**Exit behaviour**

- Exit 0 if all executed checks passed (skipped checks count as passing).
- Exit 1 if any check failed.

---

### `storage-provider.ts`

**Storage round-trip smoke**

- If `STORAGE_PROVIDER=replit` and `REPLIT_OBJECT_STORAGE_TOKEN` is missing → SKIPPED.
- If `STORAGE_PROVIDER=s3` and any of `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` are missing → SKIPPED.
- Otherwise:
  1. `putObject` — writes a unique test file with a known body.
  2. `getObject` — reads it back and asserts byte-for-byte equality.
  3. `getSignedUrl` — asserts a non-empty URL is returned.
  4. `deleteObject` — removes the test file (cleanup).

**Exit behaviour**

- Exit 0 if the round-trip passed or was skipped.
- Exit 1 if the round-trip failed at any step.
