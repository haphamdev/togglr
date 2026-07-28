---
title: Segments & Advanced Targeting
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Segments & Advanced Targeting

## Business Value

Targeting power and reuse: instead of re-typing the same conditions across many flags,
admins define a **reusable named segment** once (e.g. `beta-users`, `internal-staff`) and
reference it from any flag's rules — change the segment once, every flag using it updates.
Paired with an expanded operator library, this makes complex targeting maintainable
rather than copy-pasted, and keeps rule definitions DRY across a growing flag set.

## Scope

### Included

- **Project-scoped reusable segments:** define once, reference across all environments in
  the project; editing a segment updates every flag rule that references it.
- Segment CRUD + management UI.
- Rules can reference a segment as a condition (in-segment / not-in-segment).
- Expanded targeting-operator library beyond the MVP core (`equals`/`not-equals`/`in`/
  `not-in`): e.g. string `contains`/`starts-with`/`ends-with`, numeric comparisons,
  semver comparison — final set per the open question.
- `eval-core` engine + ruleset-shape support for resolving segment references and new
  operators (SDK and server-side preview stay in sync via the shared engine).

### Excluded

- The MVP rule engine and core operators (Flag Authoring epic).
- Audit/rollback of segment changes beyond the standard audit plumbing.
- Approval workflows.

## Dependencies

- **Platform Foundation** — `eval-core`, shared-types.
- **Flag Authoring** — extends the rule model; rules gain a segment-reference condition type.
- **Ruleset Delivery & Contract** — extends the ruleset shape to carry segment definitions.
- **`eval-core` (shared engine)** — must resolve segment references and new operators
  locally; SDK and server preview both consume it (ruleset carries segment definitions).
- **Auth & Sessions** + **Org Workspace & Isolation** — segments are org/project-scoped
  and RLS-enforced; management is role-gated.

## Acceptance Criteria (Epic-Level)

- An admin can define a project-scoped segment and reference it from multiple flags'
  rules; editing the segment changes evaluation for all referencing flags.
- The expanded operators evaluate correctly and identically in the SDK and server-side
  preview.
- The ruleset payload carries segment definitions so the SDK resolves references locally
  (no per-evaluation network call).
- Referenced-attribute-missing behavior is defined (a context lacking a segment's
  attribute does not match the segment).

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] Final expanded operator set (string ops? numeric comparisons? semver?).
- [ ] Segment composition: can a segment reference another segment (nesting), or flat only?
- [ ] Segment size/among-flags usage limits.
- [ ] How segment changes surface in analytics/audit (which flags were effectively affected).
