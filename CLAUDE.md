# CLAUDE.md — OnGem money core

Instructions for AI agents working in this repo. Read this before changing anything.

## What this is
OnGem's money core: multi-entity business accounts (UAE/AED, US/USD), a double-entry ledger,
inbound payments, outbound transfers and virtual cards, built against a mock BaaS provider.
Production-readiness beats breadth: correct, secure, tested, observable, auto-deployed.

## Layout
- `apps/api` — Fastify service. `src/<module>/` per domain (ledger, entities, transfers, webhooks,
  cards, provider, mock-provider, http). SQL migrations in `apps/api/migrations/`.
- `apps/web` — Vite + React + Tailwind v4 + shadcn/ui. Built to static files served by the API.
- `packages/shared` — Zod schemas and types used by both apps.
- `openspec/` — specs (`specs/`) and change proposals (`changes/`). Source of truth for behavior.

## Commands
Node 24 via nvm (`nvm use`), pnpm via corepack.
- `pnpm dev` — API + web with hot reload (needs `docker compose up -d` for Postgres)
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
- `pnpm migrate` — apply migrations · `pnpm spec:validate` — validate OpenSpec

## Workflow
1. Behavior changes start as an OpenSpec change (`/opsx:propose`). The human reviews the spec
   before implementation. Do not implement from a proposal that has not been approved.
2. Implement with `/opsx:apply`: one task at a time; write the scenario's test with the code.
3. Before checking off a task: `pnpm lint && pnpm typecheck && pnpm test` must pass.
4. Small commits referencing the change id, e.g. `feat(transfers): idempotent create [add-outbound-transfers]`.

## Money rules (non-negotiable)
- Amounts are integer minor units (`bigint` in SQL, `bigint`/string at the edges). Never floats,
  never `Number` for money arithmetic. Always carry the currency.
- Balances are derived from the ledger. Never store or UPDATE a mutable balance column as truth.
- Ledger entries are append-only. Postings in a journal entry sum to zero per currency.
  Corrections are new entries, never edits.
- Any code that changes balances or holds runs in one DB transaction and locks the wallet row
  (`SELECT ... FOR UPDATE`) before reading available balance.
- Outbound money movement requires an idempotency key; the same key with a different body is a 409.
- Webhooks: verify HMAC-SHA256 over the raw body with a timing-safe compare before parsing;
  dedupe on provider event id inside the same transaction as the effect.
- Card authorization must answer within 2s; on internal timeout or error, decline (fail closed).

## Isolation rules
- Every business table has `entity_id`. Every repository function takes an entity context;
  never query business tables without it.
- Postgres RLS is enabled as defense in depth (`SET LOCAL app.entity_id`). Do not bypass it.
- A resource from another entity returns 404 (not 403), so IDs don't leak existence.

## Provider boundary
- Core code depends only on the `BankingProvider` interface in `apps/api/src/provider/`.
- `apps/api/src/mock-provider/` is an external system: the core talks to it only over HTTP and
  must never import from it.

## Code style
- TypeScript strict. Validate all input at the edge with Zod schemas from `packages/shared`.
- Throw typed domain errors; the HTTP layer maps them to problem+json. No bare `catch {}`.
- Log with the request logger (`req.log`), structured fields, never secrets, card numbers or
  full webhook bodies.
- Prefer plain functions and SQL over abstractions. No ORM.

## Tests
- Tests run against a real Postgres (Testcontainers), not mocks of the database.
- Priorities: anything that can lose money (double spend, double credit, overdraw, wrong
  balance) or leak data across entities. Every such OpenSpec scenario has a named test.

## Don't
- Don't add dependencies without a reason; pin versions and check peer compatibility.
- Don't commit secrets or `.env` files. Config comes from environment variables (see `.env.example`).
- Don't weaken a test to make it pass. If a test looks wrong, stop and flag it to the human.
