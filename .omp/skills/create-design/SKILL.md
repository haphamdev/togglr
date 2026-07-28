---
name: create-design
description: Write a technical design document for a feature, system, or architecture change
roles: [tech-lead]
trigger: User wants to write a technical design, system design, design doc, or architecture proposal
output-path: docs/design/{kebab-name}.md
---

# Create Design

## When to use

- Designing the technical approach for a new feature
- Proposing an architecture change or system restructuring
- Documenting a significant technical decision before implementation

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the Tech Lead:**

1. **Read the spec and stories.** Find the related spec in `docs/specs/` and stories in `tasks/stories/`. Understand the problem, goals, and user flows before thinking about solutions.
2. **Read the codebase for current state.** Explore the code in the relevant area — understand how the system works today, what exists, what's missing, and what the integration points are (other services, databases, external APIs).
3. **Read existing design docs.** Check `docs/design/` for related designs, prior decisions, and established architectural patterns. Check for ADRs that constrain the design space.

**Brainstorm from what you read:**

4. **Analyze the design space.** Based on the spec and codebase reading, identify:
   - What the design needs to address — the key problems and decisions
   - The current architecture in the relevant area — what exists and how it works
   - Integration points found in the codebase — what the new design must interact with
   - Which areas are highest-risk (novel integration, data migration, security-sensitive) vs. lowest-risk (follows established pattern)

**Present your analysis with proposals:**

5. **Share what you found and ask what you can't determine from reading.** Present the current state, integration points, and key design questions you identified. Then ask for what requires the Tech Lead's knowledge:
   - Non-functional requirements — push for concrete numbers ("under 200ms p99" not "fast")
   - Constraints — tech stack limitations, timeline pressure, team expertise, budget, compliance
   - Known contention — approaches the team has already debated or disagreements to resolve

   Example: "I've read the spec and explored the codebase. The current checkout flow is a synchronous endpoint at `src/api/checkout.ts` that calls the payment gateway directly. Integration points: user service (auth), inventory service (stock check), and Stripe (payment). The spec asks for async processing, which is a significant departure from the current sync pattern. The main design questions seem to be: message queue choice, idempotency handling, and failure/retry strategy. What are the latency targets and throughput expectations? Any constraints or approaches the team has already discussed?"

**Spec quality gate:**

6. **Check if there's enough to design against.** If there's no spec or the spec is too vague to derive requirements from, **stop and suggest writing one first:** "There's no spec defining what this design should achieve. I'd suggest writing one first with the `write-spec` skill — a design without clear requirements risks solving the wrong problem."

### Phase 2: Drafting

Use **adaptive depth** — invest design effort proportional to risk and uncertainty. High-risk areas (new integrations, data migrations, security-sensitive flows) get detailed treatment. Low-risk areas following established patterns get a one-liner reference.

**Process:**
1. **Propose 2-3 approaches** before writing the full design. For each, give a one-paragraph summary with key pros/cons. Ask the Tech Lead which direction to pursue.
2. Once the approach is chosen, create the file at `docs/design/{kebab-name}.md` using the output template.
3. Use diagrams (ASCII or Mermaid) for architecture and data flow — a diagram is worth a thousand words.
4. For each component or decision in the design, calibrate depth:
   - **High risk / novel** → detailed: data model, error handling, failure modes, rollback
   - **Low risk / established pattern** → brief: "Follows the existing [pattern] as in [reference]"
5. Keep the design to 2-5 pages. If it's longer, the scope may be too broad — suggest splitting.

### Phase 3: Deepening (Grill the Design)

After drafting, walk through the design section by section and grill:

1. **Problem & Goals** — "Does this design actually solve the problem from the spec? Are we solving the right problem, or a convenient one?"
2. **Proposed Solution** — "What are the weakest parts of this design? Where would it break first under load? What would you change if you had twice the timeline?"
3. **Data Model** — "Are these the right entities? What happens to this data over time — does it grow unbounded? Are there privacy/retention concerns?"
4. **System Interactions** — "What happens when service X is down? What's the failure mode — graceful degradation or hard failure? Do we need retries, circuit breakers, fallbacks?"
5. **Alternatives** — "Is there a simpler approach we dismissed too quickly? What would we do differently if we were starting from scratch?"
6. **Security** — "What's the attack surface? Who can access this? What data is sensitive?"
7. **Operational** — "How do we know this is working in production? What metrics do we watch? How do we debug issues? How do we roll back?"

Update the design doc with refined content as answers come in.

### Phase 4: Wrap-Up

1. Summarize the key decisions and their rationale
2. List any remaining open questions
3. Suggest next steps:
   - "This design has key decisions worth recording" → suggest the `create-adr` skill
   - "This design defines API interfaces" → suggest the `define-api` skill
   - "Ready for peer review?" → suggest changing status to `in-review`
   - "Ready to break into implementation tasks?" → suggest involving a developer with the `break-task` skill

## Output Template

```markdown
---
title: {Design Title}
status: draft
owner: {Tech Lead name}
date: {YYYY-MM-DD}
parent: {path to related spec or story}
---

# {Design Title}

## Overview

What is being designed and why. One paragraph linking back to the product need.

## Goals & Non-Goals

### Goals
- {technical goal 1}
- {technical goal 2}

### Non-Goals
- {what this design explicitly does not address}

## Current State

How things work today in the relevant area. What exists, what's missing, what's broken.

## Proposed Solution

### Architecture

{ASCII or Mermaid diagram showing components, data flow, and interactions}

### Components

#### {Component 1}
- **Responsibility:** {what it does}
- **Interfaces:** {how other components interact with it}
- **Key decisions:** {important implementation choices}

### Data Model

{Schema changes, new entities, relationships. Use a diagram or table.}

### Error Handling & Failure Modes

| Failure Scenario | Impact | Mitigation |
|-----------------|--------|------------|
| {what fails} | {what happens} | {how we handle it} |

## Alternatives Considered

### {Alternative 1}
- **Approach:** {description}
- **Rejected because:** {reason}

## Security Considerations

{Auth, data exposure, attack surface, sensitive data handling}

## Testing Strategy

{What to test at which level — unit, integration, e2e. What's hard to test and how to address it.}

## Rollout Plan

{How to deploy safely — feature flags, phased rollout, rollback procedure}

## Open Questions

- [ ] {Unresolved question}
```

## Constraints

- Always set status to `draft` on creation
- Link to parent spec or story via `parent` frontmatter field
- Always present 2-3 approaches with trade-offs before committing to one
- Use diagrams for architecture and data flow — prose alone is insufficient
- Document decisions and their rationale explicitly
- Calibrate depth to risk — don't over-design low-risk areas
- Keep to 2-5 pages; suggest splitting if larger
- Do NOT implement — this skill produces documents only
