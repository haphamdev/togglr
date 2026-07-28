---
name: write-test-cases
description: Write detailed step-by-step test cases from a test plan or user story
roles: [qa]
trigger: User wants to write test cases, test scenarios, or create specific tests from a plan
output-path: docs/test-plans/{kebab-name}-cases.md
---

# Write Test Cases

## When to use

- Creating detailed test cases from a test plan
- Writing test scenarios for specific acceptance criteria
- Documenting manual or automated test steps
- Adding test cases for a newly discovered edge case

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts.

**Read these before engaging the QA lead:**

1. **Read the test plan or story.** Find and read the test plan from `docs/test-plans/` or the story from `tasks/stories/`. Understand the acceptance criteria, risk levels, and test areas.
2. **Read existing test cases.** Check `docs/test-plans/` for test cases already written for this area. Understand what coverage exists and avoid duplicating work.
3. **Read business rules docs.** Check `docs/specs/` for business rules — boundary conditions and edge cases are often documented there.
4. **Read the codebase.** Explore the relevant code — validation logic and error handling inform what negative test cases are needed.

**Brainstorm from what you read:**

5. **Analyze test case needs.** Based on the test plan, AC, business rules, and code reading, identify:
   - Which AC still needs test cases — map AC to existing coverage
   - Negative and boundary cases suggested by business rules (e.g., "$10 minimum order" → test at $9.99, $10.00, $10.01)
   - Error handling paths from the code that need corresponding test cases
   - Execution method based on project testing conventions and test plan guidance
   - Priority based on the test plan's risk assessment

**Present your analysis with proposals:**

6. **Share and confirm.** Present the test scenarios you identified and propose scope, priority, and execution method — don't ask open-ended questions.

   Example: "I've read the test plan and existing cases. The plan classifies payment validation as high-risk. There are already 3 positive cases covering the happy path — we need negative and boundary cases. The business rules doc specifies a $10 minimum order and card expiry validation — those need explicit boundary tests. For execution, the project uses Playwright for e2e and the test plan suggests these cases should be automated. Does this scope and approach look right?"

**Test plan quality gate:**

7. **Check if there's enough to write cases against.** If there's no test plan and no story with clear AC, **stop:** "There's no test plan or acceptance criteria to write cases against. I'd suggest creating a test plan first with `create-test-plan`, or at least detailing the AC with `detail-requirements`."

### Phase 2: Case Design

Before writing detailed cases, identify the test scenarios:

1. **Map acceptance criteria** — each AC must have at least one test case
2. **Add negative cases** — for each happy path, identify what should fail:
   - Invalid input (wrong type, too long, missing required fields)
   - Unauthorized access (wrong role, expired session)
   - System errors (service down, timeout, database error)
3. **Add boundary cases** — min/max values, empty lists, single item, exactly-at-limit
4. **Add state cases** — what happens if the data is in an unexpected state (already deleted, already processed, concurrent modification)
5. **Group by test area** — align with the test plan's areas and risk levels

Present the scenario list (one line per case) and ask the user to confirm, add, or remove before writing the full cases.

### Phase 3: Case Writing

Write each test case with this structure:

```
### TC-{number}: {Descriptive title}

**Priority:** P0 / P1 / P2 / P3
**Type:** Positive / Negative / Boundary / Regression
**Related AC:** {which acceptance criterion this verifies}

**Preconditions:**
- {what must be true before starting}

**Steps:**
1. {exact action — specific input values, specific buttons}
2. {next action}
3. {next action}

**Expected Result:**
- {what should happen — specific output values, specific state changes}

**Notes:**
- {any additional context, test data specifics, or automation hints}
```

**Writing principles:**
- **One scenario per case.** Don't test multiple things in one case — a failure should pinpoint exactly what broke.
- **Specific data, not placeholders.** Write "Enter email: test@example.com" not "Enter a valid email." Specific values make cases reproducible and catch data-dependent bugs.
- **Observable results.** Expected results must be things you can actually see or verify — a message, a state change, a database record. Not internal implementation details.
- **Independent cases.** Each case should be executable without depending on another case's output. Restate preconditions rather than saying "after TC-03."
- **Priority matches risk.** High-risk areas get P0/P1 cases; low-risk areas get P2/P3 cases. Align with the test plan's risk assessment.

### Phase 4: Deepening (Grill the Cases)

After presenting the test cases, walk through them and grill:

1. **Coverage gaps** — "Every acceptance criterion has at least one test case. But what about the negative cases? What happens if the user submits the form twice? What about concurrent users editing the same record?"
2. **Data gaps** — "Are the test data values realistic? Do they cover boundary conditions — empty string, maximum length, special characters, Unicode?"
3. **Missing error paths** — "What if the API returns a 500? What if the network drops mid-request? What if the user's session expires during this flow?"
4. **Regression risk** — "Does this change affect any existing behavior that isn't covered by these cases? Should we add regression cases?"
5. **Testability** — "Can each expected result actually be verified? Is there a case where we'd need to check the database or logs directly?"
6. **Priority accuracy** — "Are the P0 cases truly critical? Are there P2 cases that should be P1?"

Add, refine, or remove cases as issues surface.

### Phase 5: Wrap-Up

1. Summarize: count of cases by priority and type (positive/negative/boundary)
2. Map cases back to acceptance criteria — confirm full coverage
3. Note any cases that require special setup or data that doesn't exist yet
4. Suggest next steps:
   - "Ready to execute?" → note which cases to run first (P0, then P1)
   - "Found a bug during case design?" → suggest the `report-bug` skill
   - "Cases need automation?" → suggest involving a developer
   - "Found gaps in the test plan?" → suggest updating the test plan with `create-test-plan`
   - "AC is insufficient for comprehensive cases?" → suggest `detail-requirements`

## Output Template

```markdown
---
title: "Test Cases: { Feature or Story Name }"
status: draft
owner: { QA name }
date: { YYYY-MM-DD }
parent: { test-plans/plan-name.md or stories/story-name.md }
---

# Test Cases: { Feature or Story Name }

## Coverage Map

| Acceptance Criterion | Test Cases |
|---------------------|------------|
| { AC 1 } | TC-01, TC-02 |
| { AC 2 } | TC-03 |

## Test Cases

### TC-01: { Descriptive title }

**Priority:** P0 / P1 / P2 / P3
**Type:** Positive / Negative / Boundary / Regression
**Related AC:** { which acceptance criterion this verifies }

**Preconditions:**
- { what must be true before starting }

**Steps:**
1. { exact action — specific input values, specific buttons }
2. { next action }
3. { next action }

**Expected Result:**
- { what should happen — specific output values, specific state changes }

**Notes:**
- { any additional context, test data specifics, or automation hints }
```

## Constraints

- Always set status to `draft` on creation
- Link to parent test plan or story via `parent` frontmatter field
- Every acceptance criterion must have at least one test case
- Include both positive and negative test cases — negative cases often find more bugs
- Use specific test data values, not vague descriptions
- Each case must be independently executable — no hidden dependencies between cases
- Priority must align with risk assessment from the test plan
- Expected results must be observable and verifiable
- Don't write cases against vague AC — if AC is unclear, suggest `detail-requirements` first
