# Railway deployment

This monorepo deploys to Railway as **two services** sharing one Postgres
database. GitHub auto-deploy is wired up via the Railway UI; every push
to your production branch triggers a new build for both services.

```
┌────────────────┐       HTTPS / cookies (cross-site)       ┌────────────────┐
│  recipe-coster │ ───────────────────────────────────────► │   api-server   │
│   (Vite SPA)   │                                          │  (Express API) │
└────────────────┘                                          └────────┬───────┘
                                                                     │
                                                                     ▼
                                                            ┌────────────────┐
                                                            │   Postgres     │
                                                            │ (Railway addon)│
                                                            └────────────────┘
```

## One-time Railway project setup

1. Create a Railway project and add the **Postgres** plugin (already done).
2. Add a service from your GitHub repo. Name it **`api`**.
3. In **Service → Settings**:
   - **Root Directory**: leave empty (we build from the repo root).
   - **Config-as-Code Path**: `railway.api.json`.
   - **Watch Paths** (optional, saves builds): `artifacts/api-server/**`, `lib/**`, `package.json`, `pnpm-lock.yaml`, `nixpacks.toml`, `railway.api.json`.
4. Repeat steps 2–3 for a second service named **`web`**, using
   **`railway.web.json`** and watch paths `artifacts/recipe-coster/**`,
   `lib/api-client-react/**`, `package.json`, `pnpm-lock.yaml`,
   `nixpacks.toml`, `railway.web.json`.
5. In **each service → Settings → Networking → Public Networking**, click
   **Generate Domain**. You'll get something like
   `lerepertoire-api-production.up.railway.app` for the API service and
   `lerepertoire-production.up.railway.app` for the web service.
6. Set environment variables on each service (see below).
7. Push to your production branch — Railway will build and deploy
   automatically. Subsequent pushes auto-deploy ("OTA").

## Environment variables

Use Railway's **Reference Variables** (`${{Postgres.DATABASE_URL}}`,
`${{api.RAILWAY_PUBLIC_DOMAIN}}`, etc.) where indicated to avoid copying
values around.

### Service: `api` (api-server)

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Required. |
| `PORT` | _(set by Railway, do not override)_ | The api-server reads this and binds to it. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference Variable. |
| `SESSION_SECRET` | _(generate a 32-byte random hex)_ | Required for cookie signing. |
| `CORS_ORIGINS` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | Comma-separated list of allowed SPA origins. |
| `COOKIE_SAMESITE` | `none` | Required because the SPA and the API are on different domains. The cookie is also `Secure` automatically. |
| `AI_PROVIDER` | `openai` _(or `openrouter`)_ | The Replit AI proxy is not available off-Replit. |
| `OPENAI_API_KEY` | _your key_ | Required when `AI_PROVIDER=openai`. |
| `OPENROUTER_API_KEY` | _your key_ | Required when `AI_PROVIDER=openrouter`. |
| `EMBEDDING_PROVIDER` | `voyage` _(or `openai`)_ | Voyage is cheaper for embeddings; falls back to OpenAI if `VOYAGE_API_KEY` is absent. |
| `VOYAGE_API_KEY` | _your key_ | Required when `EMBEDDING_PROVIDER=voyage`. |
| `STORAGE_PROVIDER` | `s3` | Replit App Storage is not available off-Replit. |
| `AWS_REGION` | _e.g. `us-east-1`_ | |
| `AWS_S3_BUCKET` | _your bucket name_ | |
| `AWS_ACCESS_KEY_ID` | _your key_ | |
| `AWS_SECRET_ACCESS_KEY` | _your secret_ | |
| `AWS_S3_ENDPOINT` | _(optional)_ | Set for non-AWS S3 (R2 / MinIO / B2). |
| `AWS_S3_FORCE_PATH_STYLE` | `true` | Only required for MinIO / B2. |
| `GOOGLE_CLIENT_ID` | _(optional)_ | Required only for Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | _(optional)_ | Required only for Google sign-in. |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api/auth/google/callback` | Must match the Google Cloud console exactly. |

Healthcheck path: `/api/healthz` (configured in `railway.api.json`).

### Service: `web` (recipe-coster)

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | _(set by Railway, do not override)_ | Vite preview reads this. |
| `BASE_PATH` | `/` | Defaults to `/` when unset; explicit is fine. |
| `VITE_API_BASE_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` | **Build-time** variable (Vite inlines it into the bundle). Changing it requires a redeploy of the `web` service. |

Healthcheck path: `/` (configured in `railway.web.json`).

## How auto-deploy works

Once both services are connected to your GitHub repo, Railway listens
for pushes to the configured branch (default: `main`). Every push triggers
a build of any service whose **Watch Paths** match a changed file. Builds
for unaffected services are skipped, saving time and money.

To pause auto-deploy temporarily, switch each service's **Deploy Trigger**
to "Manual" in **Service → Settings**.

## Local sanity checks before pushing

```bash
# 1. Typecheck the whole monorepo.
pnpm typecheck

# 2. Build the two production services exactly the way Railway will.
pnpm --filter @workspace/api-server... run build
pnpm --filter @workspace/recipe-coster... run build

# 3. Smoke-test the AI and storage providers against your prod env vars.
AI_PROVIDER=openai OPENAI_API_KEY=... \
  pnpm --filter @workspace/ai-provider smoke

STORAGE_PROVIDER=s3 AWS_REGION=... AWS_S3_BUCKET=... \
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  pnpm --filter @workspace/storage-provider smoke
```

## Database migrations on Railway

Drizzle currently uses `drizzle-kit push`, which runs in this Replit
workspace against the dev DB. For production, run the same `push`
against `${{Postgres.DATABASE_URL}}` either:

- **From your laptop**, by exporting `DATABASE_URL` to the Railway prod
  URL and running `pnpm --filter @workspace/db run push`.
- **As a Railway one-off command**, via `railway run pnpm --filter @workspace/db run push` from the Railway CLI with the prod environment selected.

We do **not** run migrations automatically inside the api-server build to
avoid clobbering prod schema on a routine deploy. Promote schema changes
deliberately.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| SPA loads, but every API call returns `403 CORS_ORIGIN_NOT_ALLOWED` | `CORS_ORIGINS` on api missing the web domain. | Set `CORS_ORIGINS=https://<web-domain>`. |
| API calls succeed but the user is logged out on every request | Cookies dropped because `SameSite=lax` cross-site. | Set `COOKIE_SAMESITE=none` on the api service. |
| Web build succeeds but API calls hit the wrong host | `VITE_API_BASE_URL` not set at build time, or set in the api service instead of the web service. | Set it on the **web** service and trigger a redeploy. |
| `Server listening port=undefined` and crash | `PORT` overridden manually. | Remove the override; Railway injects it. |
| Build fails on `setupObjectStorage()` reference | Replit storage code path triggered. | Set `STORAGE_PROVIDER=s3` and the AWS\_\* vars. |
