# OnGem money core

Multi-entity business accounts, a double-entry ledger, payments and cards for OnGem, built
against a mock Banking-as-a-Service provider. Take-home exercise for the OnGem Founding Engineer role.

> Status: **step 1 — pipeline and health checks.** Money features land next.

## Live
- URL: _added after first deploy_
- Health: `/healthz` (liveness) · `/readyz` (database reachable; used by Render to gate deploys)

## Local setup
Requires Node 24 (`nvm use`), pnpm via corepack (`corepack enable pnpm`), and Docker (OrbStack or Docker Desktop).

```bash
cp .env.example .env && docker compose up -d && pnpm install && pnpm dev
```

API on http://localhost:3000.

| Command | What it does |
|---|---|
| `pnpm dev` | Run with hot reload |
| `pnpm lint` / `pnpm typecheck` | ESLint (strict, type-aware) / TypeScript |
| `pnpm test` | Vitest, including tests against a real Postgres container |
| `pnpm build` | Compile to `dist/` |
| `pnpm spec:validate` | Validate OpenSpec specs and changes |

## Delivery pipeline
Every push runs GitHub Actions (`.github/workflows/ci.yml`):

1. **quality** — lint, typecheck, OpenSpec validation
2. **test** — full test suite against real Postgres (Testcontainers)
3. **security** — `pnpm audit` (high/critical fails the build) and gitleaks secret scan; CodeQL runs separately
4. **build** — production Docker image

On `main`, once all four pass, **deploy** triggers Render's deploy hook for that exact commit
and waits until `/readyz` reports the new version. Render's own auto-deploy is off, so nothing
reaches production without passing CI. Infrastructure is declared in `render.yaml`.

## Configuration
All configuration comes from environment variables, validated at startup (`apps/api/src/config.ts`).
See `.env.example`. No secrets are committed; production values live in Render and GitHub secrets.

## How this repo is worked on
Behavior is specified first in `openspec/` (proposals, specs with WHEN/THEN scenarios, tasks),
reviewed, then implemented. Agent instructions are in `CLAUDE.md`.
