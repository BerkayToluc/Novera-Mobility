# Novera Mobility

Website for Novera Mobility, a fictional corporate and individual car rental company founded in 2003. Built as a learning project by a two-person team working asynchronously.

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Frontend: Next.js (App Router), TypeScript, Tailwind CSS |
| `apps/api` | Backend: NestJS, PostgreSQL, Prisma (not set up yet) |
| `docs/` | SPEC (product), ARCHITECTURE (decisions), BACKLOG (work items) |

## Getting started

Requirements: Node.js 22 or newer (see `.nvmrc`) and pnpm (`corepack enable` installs the pinned version).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Workflow

Work is tracked as GitHub issues on the project board. Each issue gets its own branch (`feat/…`, `fix/…`, `chore/…`) and a pull request reviewed by the other teammate. Nothing is pushed to `main` directly. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#çalışma-düzeni).
