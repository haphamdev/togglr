---
title: Scaffold the pnpm monorepo & workspaces
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: M
---

# Scaffold the pnpm monorepo & workspaces

## Story

As a developer, I want a pnpm-workspaces monorepo with the five packages and strict TypeScript, so that API, web, and SDK share code and types without publishing.

## Acceptance Criteria

### AC1: Install & link
- **Given** a clean checkout
- **When** `pnpm install` runs
- **Then** `apps/api`, `apps/web`, `packages/sdk`, `packages/shared-types`, `packages/eval-core` install and cross-link via the workspace.

### AC2: Strict TS
- **Given** the root tsconfig
- **When** any package builds
- **Then** TypeScript `strict` is enabled and inherited by every package.

### AC3: Workspace import
- **Given** the workspaces
- **When** a package imports `@togglr/shared-types`
- **Then** it resolves from the local workspace (no registry publish).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Idempotent install
- **Given** a checked-out repo with the committed `pnpm-lock.yaml`
- **When** `pnpm install` is run a second time against the unchanged lockfile
- **Then** the install completes with no lockfile changes and deterministic resolution (re-running produces an identical `node_modules`).

### AC5: Acyclic dependency graph
- **Given** the five workspace packages
- **When** the dependency graph is inspected
- **Then** `shared-types` and `eval-core` are leaves, `apps/api` never imports `packages/sdk`, and `packages/sdk` never imports `apps/api` — the graph stays acyclic. [arch:87-102]

### AC6: Pinned toolchain
- **Given** the root `package.json`
- **When** a developer or CI runs `pnpm install`
- **Then** the Node and pnpm versions are pinned via `packageManager`/`engines`, so installs reproduce across machines.

## Notes

First epic story; everything else depends on it.

## Open Questions

