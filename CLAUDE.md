# Novera Mobility

Website for Novera Mobility, a fictional corporate car rental company (learning project, two-person team).
Frontend (`apps/web`, Next.js) is owned by G; backend (`apps/api`, NestJS) by the backend owner.
Primary language Turkish, English also shipped in v1.

## Source of truth

- Product scope, flows, design direction: docs/SPEC.md
- Technology decisions (ADRs), folder layout, workflow: docs/ARCHITECTURE.md
- Work items and their definition of done: docs/BACKLOG.md

If a request conflicts with these documents, stop and ask instead of picking a side.

## Commands

```bash
pnpm install        # install all workspaces
pnpm dev            # run every app in dev mode
pnpm lint           # eslint in every workspace
pnpm typecheck      # tsc in every workspace
pnpm build          # production build
pnpm --filter @novera/web <script>   # run a script in one workspace
```

## Rules

- No raw color, spacing or font values in components. Use design tokens only (defined in `apps/web/app/globals.css`, see SPEC §5).
  Tailwind's default palette, type scale, radii and shadows are disabled; available classes are the semantic ones, e.g. `bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `bg-primary`, `text-on-primary`, `border-border-strong`, `text-display`/`text-h1`…`text-label`, `rounded-control`/`rounded-card`/`rounded-media`. Breakpoints: base (375), `md:` (768), `xl:` (1280).
- No hardcoded UI text. Every user-facing string lives in `messages/tr.json` and `messages/en.json`.
- Mobile-first. Check every UI change at 375, 768 and 1280 px.
- Accessibility: WCAG 2.2 AA (contrast, 44px touch targets, visible focus, full keyboard support).
- Every data-driven view handles loading, empty and error states.
- Code, comments and commit messages in English. Comments explain why, not what.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Never push to `main`. One branch and one PR per issue; the PR body links the issue (`Closes #N`).
- Frontend tasks do not modify `apps/api`, backend tasks do not modify `apps/web`, unless the issue says so.
- Secrets never enter the repo. Add new variables to `.env.example` with an empty value.

## Before saying a task is done

Run `pnpm lint`, `pnpm typecheck` and `pnpm build` and show the output. For UI work, attach screenshots at 375 and 1280 px.
