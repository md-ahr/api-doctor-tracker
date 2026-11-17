# Deploy the API on Cloudflare

The API runs as a **Cloudflare Container** (Node 22 + Express) behind a **Worker** that forwards HTTPS traffic. **MongoDB Atlas** is the database; you do not run MongoDB locally or in the container image. The Worker passes your Atlas connection string and other secrets into the container at boot.

## Prerequisites

- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) via this repo (`npm install`)
- Docker running locally for `wrangler deploy` (builds the container image only — not MongoDB)
- An Atlas cluster and `mongodb+srv://…` URI with a database user that can read and write `doctor_tracker`
- Cloudflare account with Containers enabled on your plan

## One-time setup

1. Log in:

   ```bash
   npx wrangler login
   ```

2. Set **secrets** on the Worker (not in `wrangler.jsonc`):

   ```bash
   npx wrangler secret put MONGODB_URI
   npx wrangler secret put JWT_ACCESS_SECRET
   npx wrangler secret put FRONTEND_ORIGIN
   ```

   Optional:

   ```bash
   npx wrangler secret put APP_TIMEZONE
   npx wrangler secret put LOG_LEVEL
   ```

   `JWT_ACCESS_SECRET` must be at least 32 characters. `FRONTEND_ORIGIN` is the live portal URL with **no** trailing slash (CORS and refresh cookies). Paste the same Atlas URI you use in `.env` for local dev.

3. In **MongoDB Atlas → Network Access**, allow the API to connect from the internet. For Cloudflare Containers, **Allow access from anywhere** (`0.0.0.0/0`) is the usual choice because egress IPs are not fixed. Restrict by IP only if you know the egress pattern you need.

4. Seed Atlas once from your laptop (optional demo data):

   ```bash
   cp .env.example .env   # MONGODB_URI = Atlas only
   npm run seed           # admin
   npm run seed:all       # demo doctors / patients
   ```

## Deploy

From the API repository root:

```bash
npm run build
npm run deploy:cf
```

The first deploy builds the Docker image and can take several minutes. The `*.workers.dev` URL may respond before container instances are ready; wait a few minutes if you see errors, then retry.

Check:

```bash
curl -s "https://doctor-tracker-api.<your-subdomain>.workers.dev/api/v1/health"
```

## Scripts

| Script                      | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `npm run deploy:cf`         | Build image and deploy Worker + container                    |
| `npm run deploy:cf:dry-run` | Package without uploading (CI smoke)                         |
| `npm run cf:typegen`        | Regenerate `worker-configuration.d.ts` after binding changes |

## Local API dev (Atlas only)

You do **not** need a local MongoDB daemon. Point `.env` at Atlas and run:

```bash
npm run dev
```

To exercise the Worker + container stack locally (Docker required for the container image, still using Atlas via `.dev.vars`):

```bash
cp .dev.vars.example .dev.vars
npm run dev:cf
```

## GitHub Actions (CI/CD)

Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

| Trigger                         | What runs                                             |
| ------------------------------- | ----------------------------------------------------- |
| Pull request                    | **check** only (format, lint, typecheck, test, build) |
| Push to `main` / `master`       | **check**, then **deploy-cloudflare** if check passes |
| **Actions → CI → Run workflow** | Same as push (check + deploy)                         |

The runner has Docker; `wrangler deploy` builds the container image in CI.

### Repository secrets (GitHub)

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret                  | Purpose                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with **Workers Scripts Edit**, **Containers Edit**, and account read |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → right sidebar, or `wrangler whoami`                                                                                              |

Optional: create a GitHub **environment** named `production` for deploy approvals or protection rules (the workflow uses `environment: production`).

### Worker secrets (Cloudflare — not GitHub)

Set once on the Worker (`wrangler secret put` or dashboard). Deploy reuses them; CI does not overwrite them unless you add extra steps:

- `MONGODB_URI`, `JWT_ACCESS_SECRET`, `FRONTEND_ORIGIN` (and optional `APP_TIMEZONE`, `LOG_LEVEL`)

## Frontend on Cloudflare

Deploy the Next.js portal with [OpenNext on Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) when the frontend app exists. Set `NEXT_PUBLIC_API_URL` (or your env name) to the Worker URL above.

## Rollback

```bash
npx wrangler rollback
```

See [rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) — container images and data are not rolled back with Worker code alone.
