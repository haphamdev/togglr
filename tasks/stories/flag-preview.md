---
title: Server-side flag preview / debugger
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/flag-authoring.md
size: M
---

# Server-side flag preview / debugger

## Story

As a Flag Administrator, I want to preview a flag against a sample context before saving, so that I can verify targeting matches what the SDK will serve.

## Acceptance Criteria

### AC1: Draft preview
- **Given** a draft config and a context
- **When** `POST …/preview {context, defaultValue, config}`
- **Then** it returns the `EvaluationResult` (`value`, `reason`) computed by eval-core.

### AC2: Saved preview
- **Given** `config` omitted
- **When** the flag is previewed
- **Then** it evaluates the saved config; an archived flag yields `reason: FLAG_NOT_FOUND`.

### AC3: Invalid draft
- **Given** a draft `config` that fails validation
- **When** the flag is previewed
- **Then** `400 CURIOUS_CAT`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Reason is the resolvable subset
- **Given** any preview request
- **When** the result is returned
- **Then** `reason ∈ {RULE_MATCH, ROLLOUT, DEFAULT, FLAG_OFF, FLAG_NOT_FOUND, MISSING_KEY}`; `SDK_NOT_READY` and `TYPE_MISMATCH` never appear (SDK-runtime-only). [api:788-789]

### AC5: SDK parity
- **Given** the same ruleset/config and the same context
- **When** evaluated via preview and via the SDK
- **Then** both return an identical `{value, reason}` (both call the shared `eval-core`). [ev:23-25]

### AC6: Unwrapped result shape
- **Given** a successful preview
- **When** the `200` body is returned
- **Then** it is `{ value, reason }` at the top level — an operation result, intentionally not wrapped in a resource envelope. [api:782-785]

### AC7: Preview is member-level
- **Given** a user with role `member` (read + preview)
- **When** they call `POST …/preview`
- **Then** the request is authorized (preview does not require `admin`). [api:765; api:77-79]

### AC8: Context supplied manually in the request body
- **Given** a preview request in Phase 1
- **When** the caller wants to test targeting
- **Then** the evaluation context is supplied manually in the request body (`context` field); there is no telemetry replay. [api:771]

### AC9: defaultValue is required
- **Given** a preview request body
- **When** `defaultValue` is omitted
- **Then** the response is `400 CLUMSY_OWL`. [api:772; api:73]

### AC10: No session
- **Given** a missing/invalid/expired session
- **When** the preview route is called
- **Then** the response is `401 SLEEPY_OWL`. [api:69]

### AC11: Not a member of the org
- **Given** an authenticated non-member of the target org
- **When** the preview route is called
- **Then** the response is `403 LONELY_OWL`. [api:71]

### AC12: Unknown flag or environment
- **Given** a `:flagKey` or `:envKey` absent within the caller's tenant
- **When** the preview route is called
- **Then** the response is `404 LOST_OWL`. [api:74]

## Notes

Parity with the SDK guaranteed by the shared engine. Depends on `flag-eval-core-engine`, `flag-config-edit`.

## Open Questions

- [x] How is the evaluation context supplied for the web preview/debugger? → **Manual attribute entry in the request body in Phase 1**; telemetry-replay of recent real contexts is deferred (no telemetry until Phase 3). (api:771; spec:356-357)
