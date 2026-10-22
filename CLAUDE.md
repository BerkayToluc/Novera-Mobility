# Novera Mobility

Website for Novera Mobility, a fictional corporate car rental company (learning project, two-person team).
v1 is live (web on Vercel, API on Render, PostgreSQL on Neon). v2 is in progress.
Roles (since 22 Oct 2026): **G** is the Product/Project Manager (opens issues, accepts and merges PRs);
**Berkay** is the full-stack developer and writes all code, in both `apps/web` (Next.js) and `apps/api` (NestJS).
Primary language Turkish, English shipped as well. Docs are in Turkish; code is in English.

## Source of truth

- Map of all docs: docs/README.md
- Product scope and acceptance flows: docs/SPEC.md (v2)
- Design system and tokens: docs/DESIGN.md
- Architecture decisions (ADRs), folder layout: docs/ARCHITECTURE.md
- Known findings and quality gates: docs/QUALITY.md
- Admin panel and customer fleet panel: docs/ADMIN.md, docs/FLEET.md
- Work items, order and process: docs/BACKLOG.md, docs/ROADMAP.md, docs/WORKFLOW.md
- The task itself: the issue, whose full text is in docs/issues/V2-xx-*.md
- v1 documents (detailed v1 page specs, old backlog): docs/archive/v1/ (reference only)

If a request conflicts with these documents, stop and ask instead of picking a side.
Work only on the issue at hand; report anything else you find as a QUALITY.md finding or a suggested issue.

## Commands

```bash
pnpm install        # install all workspaces
pnpm dev            # run every app in dev mode
pnpm lint           # eslint in every workspace
pnpm typecheck      # tsc in every workspace
pnpm test           # unit tests (Vitest in apps/web, Jest in apps/api)
pnpm --filter @novera/web test:e2e   # Playwright; needs `pnpm build` first
pnpm build          # production build
pnpm --filter @novera/web gen:api    # regenerate web API types from docs/api/openapi.yaml
pnpm --filter @novera/web <script>   # run a script in one workspace
```

## Rules

- No raw color, spacing or font values in components. Use design tokens only (defined in `apps/web/app/globals.css`, see docs/DESIGN.md).
  Tailwind's default palette, type scale, radii and shadows are disabled; available classes are the semantic ones, e.g. `bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `bg-primary`, `text-on-primary`, `border-border-strong`, `text-display`/`text-h1`…`text-label`, `rounded-control`/`rounded-card`/`rounded-media`. Breakpoints: base (375), `md:` (768), `xl:` (1280).
- No hardcoded UI text. Every user-facing string lives in `messages/tr/<feature>.json` and `messages/en/<feature>.json` (one file per feature, registered in `i18n/messages.ts`).
- Mobile-first. Check every UI change at 375, 768 and 1280 px.
- Accessibility: WCAG 2.2 AA (contrast, 44px touch targets, visible focus, full keyboard support).
- Every data-driven view handles loading, empty and error states.
- API: every endpoint validates its input with a zod schema, sits under a rate limit, and has authorization tests (ARCHITECTURE ADR-26, ADR-27). `/admin/*` needs 401/403 tests; `/fleet/*` needs "other company's record is 404" tests.
- A change to an endpoint updates `docs/api/openapi.yaml` in the same PR. Business rules are also enforced by database constraints where possible.
- Tests: a new endpoint gets unit + HTTP tests; a new screen gets at least one Playwright test.
- Code, comments and commit messages in English. Comments explain why, not what.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Never push to `main`. One branch and one PR per issue, branched from the latest `main`; the PR body links the GitHub issue (`Closes #N`, or `Refs #N` for partial work). The GitHub number is in docs/BACKLOG.md's mapping table, not the `V2-xx` id.
- An issue is a vertical slice: API, database, UI, translations and tests land in the same PR.
- Secrets never enter the repo, the chat or screenshots. Add new variables to `.env.example` with an empty value.
- Large visual changes are proposed to G with screenshots before they are built.

## Before saying a task is done

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` and show the output. For UI work, attach screenshots at 375 and 1280 px (admin screens also 768).
Tick every acceptance criterion in the issue and say how it was checked. Update the finding's status in docs/QUALITY.md if the issue closes one.
Report with three lists: done / not done / not verified. Never present unverified work as verified.
