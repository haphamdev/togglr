---
title: Flag editor form (default, rules, rollout, toggle, save)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 3
---

# Flag editor form

## What

The core editor: edit a flag's default value, ordered targeting rules, rollout %, and enabled toggle,
then save via the config API sending the optimistic `expectedConfigVersion`; map validation errors to
inline field errors.

## Why

Fulfils flag-editor-ui AC2 (edit + save via config API), AC5 (send `expectedConfigVersion` = last
loaded version), AC6 (400 CURIOUS_CAT -> inline field errors, not a banner), AC7 (rule order = eval
order, first match wins), AC8 (rollout percentage 0..100 + `bucketBy` defaulting to `key`).

## How

- Load via `useFlagConfig(...)`; keep the loaded `configVersion` and send it as `expectedConfigVersion`
  on save via `useUpdateFlagConfig(...)` (sequence 1).
- Rules editor: ordered list (add/remove/reorder); the displayed order IS the persisted order = the
  evaluation order (AC7). Each rule = conditions (attribute/operator/values) + a result (`variation`,
  or `rollout` with `percentage` 0..100 and `bucketBy` default `key`, AC8). Use shadcn
  `Input`/`Select`/`Button`.
- On a `400 CURIOUS_CAT` (`ApiError`), map to inline errors on the offending rule/field (AC6) rather
  than a global alert — derive the field from the response.
- Toggle `enabled`; edit the default value (boolean MVP).

## Verification

- Component test: editing default/rules/rollout + save calls the mutation with the right body incl.
  `expectedConfigVersion`; the rollout input rejects <0 / >100 and defaults `bucketBy` to `key`; a
  simulated 400 CURIOUS_CAT renders an inline field error (not a banner); reordering rules persists the
  order.
- `pnpm --filter @togglr/web typecheck` green.

## Notes

- Concurrent-edit (409) handling is sequence 4; the preview panel is sequence 5 — keep this task to the
  edit + save + validation surface.
- Server validation is authoritative (`assertValidRules` -> CURIOUS_CAT); client checks are UX only.
