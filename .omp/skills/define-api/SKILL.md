---
name: define-api
description: Define an API contract with endpoints, request/response shapes, and error codes
roles: [tech-lead]
trigger: User wants to define an API, create endpoints, write an API contract, or design an interface
output-path: docs/api/{kebab-name}.md
---

# Define API

## When to use

- Designing a new API or set of endpoints
- Documenting an existing API that lacks a formal contract
- Defining the interface between two systems or services

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts and codebase.

**Read these before engaging the Tech Lead:**

1. **Read the related design doc, spec, or story.** Understand the use cases the API must support — what user flows need what data, what operations are required.
2. **Read existing API contracts.** Check `docs/api/` for existing contracts. Understand the project's conventions — URL structure, naming style, pagination approach, error format, auth approach.
3. **Read the codebase.** Check for existing endpoints in the same domain, existing models and data structures, auth middleware patterns, and shared utilities (validation, serialization).

**Brainstorm from what you read:**

4. **Analyze the API needs.** Based on the spec, existing patterns, and codebase, identify:
   - The resources and operations needed to fulfill the spec's user flows
   - Conventions to follow based on existing API contracts (or flag if this is the first API)
   - Likely consumers based on the design doc and codebase context
   - Auth approach based on existing middleware patterns

**Present your analysis with proposals:**

5. **Share and confirm.** Present the resources, operations, and conventions you identified. Ask only what you can't determine from reading.

   Example: "I've read the checkout design doc and existing API contracts in docs/api/. The project uses RESTful conventions with cursor-based pagination and a standard error format (see docs/api/orders.md). Auth uses Bearer tokens via the auth middleware at src/middleware/auth.ts. The design doc describes 3 user flows that imply 4 endpoints: create payment, get payment status, list payments, and cancel payment. The primary consumer appears to be the React frontend. Any other consumers I should design for, and are there specific performance constraints?"

**Upstream artifact quality gate:**

6. **Check if there's enough to design against.** If there's no spec or design doc defining what the API should serve, **stop:** "There's no spec or design doc describing what this API needs to do. Designing an API without defined use cases means guessing at the contract. I'd suggest writing a spec first with `write-spec` or creating a design with `create-design`."

### Phase 2: Contract Design

Design the API using **markdown tables with JSON examples**.

**Process:**
1. Start by listing the resources and operations needed to fulfill the use cases from Phase 1
2. For each endpoint, define: method, path, description, request/response shapes, error codes
3. Propose the endpoint list to the Tech Lead for confirmation before detailing each one
4. Once confirmed, detail each endpoint using the format below

**Per-endpoint format:**

```markdown
### {METHOD} {path}

**Description:** {what this endpoint does}
**Auth:** {required auth, e.g., Bearer token, API key, none}

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| {field} | {type} | {yes/no} | {description} |

**Example request:**
{JSON example}

**Response ({status code}):**

| Field | Type | Description |
|-------|------|-------------|
| {field} | {type} | {description} |

**Example response:**
{JSON example}

**Errors:**

| Code | Error | Description |
|------|-------|-------------|
| {400} | {error_code} | {when this happens} |
| {401} | {error_code} | {when this happens} |
| {404} | {error_code} | {when this happens} |
```

**Design principles to follow:**
- Resource-oriented URLs with nouns, not verbs (`/payments`, not `/createPayment`)
- Consistent error format across all endpoints
- Explicit about required vs. optional fields
- Include pagination for list endpoints (describe the approach)
- Include rate limiting if applicable

### Phase 3: Deepening (Grill the Contract)

After drafting the contract, walk through each endpoint and grill:

1. **Completeness** — "Are there operations missing? Can consumers do everything they need with these endpoints?"
2. **Error cases** — "What other errors can occur? What if the referenced resource doesn't exist? What if there's a conflict? What about validation errors — are the error messages specific enough?"
3. **Consistency** — "Is the naming consistent across endpoints? Are similar fields named the same way everywhere? Is the error format the same?"
4. **Edge cases** — "What's the maximum payload size? What about empty lists vs. 404? How do partial updates work — PATCH semantics?"
5. **Versioning** — "How will this API evolve? Is there a versioning strategy? What's the backwards-compatibility expectation?"
6. **Consumer perspective** — "If I'm a frontend developer, can I build the UI from this contract alone? What information am I missing?"

Update the contract with refinements as answers come in.

### Phase 4: Wrap-Up

1. Summarize the API surface (number of endpoints, resources)
2. List any open design questions
3. Suggest next steps:
   - "Ready for consumer review?" → suggest sharing with frontend/mobile developers
   - "This API has design decisions worth recording" → suggest the `create-adr` skill
   - "API needs usage documentation or a guide?" → suggest `write-docs`
   - "Ready for implementation?" → suggest `break-task` or `implement`

## Output Template

```markdown
---
title: {API Name} Contract
status: draft
owner: {Tech Lead name}
date: {YYYY-MM-DD}
parent: {path to related design doc or spec}
---

# {API Name} API Contract

## Overview

What this API does, who consumes it, and what use cases it supports.

## Conventions

- **Base URL:** {base path}
- **Auth:** {authentication approach}
- **Error format:** All errors return `{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }`
- **Pagination:** {approach, e.g., cursor-based, offset-based}

## Endpoints

### {METHOD} {path}
(detailed per-endpoint sections as described above)

## Open Questions

- [ ] {Unresolved question}
```

## Constraints

- Always set status to `draft` on creation
- Link to parent design doc or spec via `parent` frontmatter field
- Include error responses for every endpoint, not just happy paths
- Be explicit about data types and required vs. optional fields
- Use consistent naming across all endpoints
- Include JSON examples for every request and response
- Do NOT implement — this skill produces contract documents only
- Don't design an API without defined use cases — if no spec or design exists, suggest creating one first
