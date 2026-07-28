---
name: create-test-plan
description: Create a risk-based test plan for a feature or user story
roles: [qa]
trigger: User wants to create a test plan, testing strategy, or plan testing for a feature
output-path: docs/test-plans/{kebab-name}.md
---

# Create Test Plan

## When to use

- Planning testing for a new feature or epic
- Creating a test strategy before implementation begins
- Defining test scope and approach for a release

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts.

**Read these before engaging the QA lead:**

1. **Read the feature artifacts.** Find and read the spec, acceptance criteria, business rules, and design doc for the feature being tested. Understand the full scope and expected behavior.
2. **Read existing test plans.** Check `docs/test-plans/` for test plans covering related areas. Understand what testing patterns are already established and what coverage exists.
3. **Read the codebase for change scope.** Explore the code being changed to understand complexity, integration points, and areas that might be affected by the change.

**Brainstorm from what you read — including risk assessment:**

4. **Classify feature areas by risk.** Based on what was read, assess each area using these factors:
   - **User impact** — how many users affected, how severe the impact
   - **Complexity** — how many components involved, how many integration points
   - **Change scope** — new code vs. modified code, size of the change
   - **Historical issues** — has this area been buggy before?
   - **Data sensitivity** — does it handle financial, personal, or regulated data?

   Classify each area:

   | Level | Testing depth |
   |-------|--------------|
   | High risk | Thorough testing — cover all paths, edge cases, negative scenarios, boundary values |
   | Medium risk | Standard testing — happy paths, key edge cases, error handling |
   | Low risk | Smoke testing — verify basic functionality works |

5. **Propose test approach per area.** Based on the risk classification, suggest:
   - What test types apply per area (functional, integration, performance, security, accessibility, compatibility)
   - Environment and test data requirements identified from reading
   - Whether this is a new feature, a change to existing behavior (needs regression), or a fix

**Present your analysis with proposals:**

6. **Share the risk assessment and test approach.** Present the risk classification table and proposed test types. The QA lead confirms, adjusts risk levels, or adds areas.

   Example: "I've read the spec and design doc. Here's my risk assessment:

   | Area | Risk | Rationale |
   |------|------|-----------|
   | Payment validation | High | Handles financial data, external gateway integration |
   | Order confirmation UI | Medium | User-facing but follows existing pattern |
   | Admin notification | Low | Internal only, no data sensitivity |

   For the high-risk area, I'd suggest functional + integration + security testing. Medium gets functional + key edge cases. Low gets smoke testing. The design doc mentions a staging Stripe sandbox — we'll need test API keys. Does this risk assessment match your view? Any areas I'm over- or under-weighting?"

**AC quality gate:**

7. **Check AC clarity before planning tests.** If acceptance criteria are vague or missing, **stop and suggest detailing them first:** "The AC says 'payment works correctly' but doesn't define success criteria. A test plan built on vague AC produces vague tests. I'd suggest running `detail-requirements` to specify the expected behaviors first."

### Phase 2: Plan Writing

Create the test plan file with the output template. For each test area:

1. State what's being tested and why it's at that risk level
2. List the test types that apply (functional, integration, etc.)
3. Define entry criteria (what must be true before testing starts)
4. Define exit criteria (what must be true before testing is done)
5. Note any assumptions, dependencies, or risks to the testing itself

### Phase 3: Deepening (Grill the Plan)

After presenting the test plan, walk through it and grill:

1. **Coverage** — "Does this plan cover all the acceptance criteria? Let me map each AC to a test area." Walk through the mapping explicitly.
2. **Depth calibration** — "Now that we see the full plan, is the testing depth right for each area? Are we over-testing anything low-risk, or under-testing anything that's actually high-risk?"
3. **Missing scenarios** — "What about negative testing — what should NOT happen? What about cross-feature interactions? What about data migration or backwards compatibility?"
4. **Environment gaps** — "Can we actually test this in the available environments? Do we need specific test data that doesn't exist yet?"
5. **Entry/exit criteria** — "Are the entry criteria realistic? Are the exit criteria specific enough to know when we're done?"
6. **Regression** — "What existing features could this change break? Do we need regression test cases beyond the feature scope?"

Update the plan as issues surface.

### Phase 4: Wrap-Up

1. Summarize the plan: scope, risk areas, test types, key risks
2. Suggest next steps:
   - "Ready to write test cases?" → suggest the `write-test-cases` skill
   - "Found gaps in the acceptance criteria?" → suggest `detail-requirements`
   - "Need a design doc for a complex area?" → suggest `create-design`
   - "Need more detail on the business rules?" → suggest involving a BA

## Output Template

```markdown
---
title: "Test Plan: { Feature Name }"
status: draft
owner: { QA name }
date: { YYYY-MM-DD }
parent: { specs/feature-name.md or stories/story-name.md }
---

# Test Plan: { Feature Name }

## Overview

{ Brief description of what's being tested and why }

## Risk Assessment

| Area | Risk Level | Rationale |
|------|-----------|-----------|
| { area } | High / Medium / Low | { why this risk level } |

## Scope

### In Scope

- { what will be tested }

### Out of Scope

- { what will NOT be tested and why }

## Test Approach

### { Test Area 1 — e.g., Payment Validation }

**Risk:** High
**Test types:** Functional, Integration
**Focus:** { what to concentrate on }
**Key scenarios:**
- { scenario 1 }
- { scenario 2 }

### { Test Area 2 }

...

## Entry Criteria

- { what must be true before testing starts }

## Exit Criteria

- { what must be true before testing is complete }

## Environment and Test Data

- **Environment:** { where testing happens }
- **Test data:** { what data is needed, how to set it up }
- **Prerequisites:** { any setup steps }

## Risks and Dependencies

- { risks to the testing itself — environment instability, missing test data, etc. }

## Open Questions

- { unresolved questions that could affect the test plan }
```

## Constraints

- Always set status to `draft` on creation
- Link to parent story or spec via `parent` frontmatter field
- Classify risk explicitly for every test area — no implicit "test everything equally"
- Always include entry and exit criteria
- Map acceptance criteria to test areas — nothing should be untested without an explicit reason
- Focus effort on high-risk areas — don't spend equal time on everything
- Don't plan tests against vague acceptance criteria — if AC is unclear, suggest `detail-requirements` first
