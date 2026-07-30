---
title: Scaffold React SPA shell with routing and styling
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-web-shell.md
sequence: 1
---

# Scaffold React SPA shell with routing and styling

## What

Stand up the `apps/web` React SPA: a Vite + React Router app that renders the
persistent app layout (header/sidebar shell + navigation) and a routed content
outlet, with Tailwind and shadcn/ui wired and usable. This is the visual/structural
skeleton; providers, API client, and auth routing land in the sibling tasks (seq 2, 3).

## Why

Fulfills foundation-web-shell AC1 (Vite + React Router SPA renders the app layout and
navigation on `pnpm dev`). Establishes the layout + routing frame that AC2/AC4
(auth-aware routing) and AC3/AC6 (providers, async states) plug into.

## How

- Create `apps/web` as a workspace package (`pnpm` workspace member, per
  `docs/design/architecture-overview.md:82` — pure client SPA: Vite + React Router +
  TanStack Query + Tailwind + shadcn/ui, no SSR/BFF). TypeScript strict.
- Vite React app entry (`index.html`, `src/main.tsx` mounting `<App/>` into `#root`).
- React Router: a `RouterProvider`/`createBrowserRouter` tree with a root layout route
  (`src/app/layout.tsx` — persistent shell: top bar + left nav + `<Outlet/>`), an index
  dashboard placeholder route, and a `login` route skeleton (target for the seq-3 redirect).
- Tailwind: `tailwind.config.ts` + `postcss` config + a base stylesheet with the Tailwind
  directives imported in `main.tsx`; confirm a utility class renders.
- shadcn/ui: initialize the component setup (`components.json`, `lib/utils.ts` `cn` helper,
  Tailwind theme tokens) and vendor at least one primitive (e.g. `Button`) used in the
  layout nav to prove the pipeline.
- Navigation links use React Router `<Link>`/`<NavLink>` so client-side routing works with
  no full reload.
- Keep components presentational only here — no data fetching yet (that is seq 2/3).

## Verification

- `pnpm --filter web dev` serves the app; visiting `/` renders the layout shell with visible
  navigation and Tailwind styling applied; clicking a nav link changes the routed content
  without a full-page reload; `/login` renders the login skeleton.
- Test to write (component/integration, React Testing Library): render the router at `/`,
  assert the layout landmarks + nav links are present; navigate to a second route and assert
  the outlet content swaps; assert a shadcn `Button` renders (styling pipeline wired). Medium
  granularity — one render/navigation test covering layout + routing.

## Notes

- Depends on `foundation-scaffold-monorepo` (workspace + tooling must exist first).
- Do not wire providers/API client/auth here — seq 2 adds TanStack Query + typed API client
  + no-op SSE placeholder; seq 3 adds the `/auth/me` bootstrap and protected-route redirects.
- Stack pinned by `docs/design/architecture-overview.md:82` and AGENTS.md (Biome is the only
  linter/formatter — no ESLint/Prettier config in `apps/web`).
