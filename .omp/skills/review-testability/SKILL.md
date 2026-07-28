---
name: review-testability
description: Review stories, specs, or designs for testability — flag vague, unmeasurable, or untestable criteria
roles: [qa, software-developer, tech-lead]
trigger: User wants to review testability, check if something is testable, review acceptance criteria for testability, or assess test readiness
output-path: null
---

# Review Testability

## When to use

- Reviewing a story's acceptance criteria before development begins
- Checking if a spec's requirements can actually be verified
- Assessing whether a design provides adequate test hooks
- Preparing for test planning — identifying what's testable and what's not

## Process

### Phase 1: Context Gathering

Read first, then ask only what you can't determine from the artifacts and codebase.

**Read these before engaging the user:**

1. **Read the artifact to review.** Ask for the story, spec, or design doc. Read it thoroughly — understand every requirement and acceptance criterion.
2. **Read existing test files.** Explore the project's test files. Discover the testing framework, conventions, mock patterns, file structure, and what types of tests are used (unit, integration, e2e).
3. **Read test infrastructure.** Check for test helpers, fixtures, factories, test database setup, CI configuration. Understand what testing capabilities are available.
4. **Read related test plans or cases.** Check `docs/test-plans/` for existing coverage in this area.

**Brainstorm from what you read:**

5. **Analyze testability.** Based on the artifact, test infrastructure, and codebase, identify:
   - Which acceptance criteria are likely problematic — vague language, unmeasurable outcomes, hard-to-reproduce scenarios
   - What testing capabilities already exist — frameworks, mocking tools, test environments
   - Gaps between what the criteria require and what the test infrastructure supports

**Present your analysis:**

6. **Share and confirm.** Present what you found and what you'll focus on. Ask only about constraints not visible in the codebase.

   Example: "I've read the checkout story and the existing test suite. The project uses Jest with a test database for integration tests — mocking is available via jest.mock. The story has 6 acceptance criteria; 2 use vague language ('handles gracefully', 'performs well') that I'll flag. Any testing constraints I should know about beyond what I found?"

**AC quality gate:**

7. **Check if there are criteria to assess.** If the artifact has no acceptance criteria or measurable requirements, **stop:** "This artifact has no acceptance criteria or measurable requirements. There's nothing to assess for testability. I'd suggest defining requirements first with `detail-requirements` or writing a spec with `write-spec`."

### Phase 2: Testability Review

Evaluate each requirement and acceptance criterion against these dimensions:

**Measurability:**
- Is the expected outcome specific and quantifiable?
- "System should be fast" → NOT testable
- "Page loads in under 2 seconds for 95th percentile" → testable
- Flag vague qualifiers: "should handle gracefully", "user-friendly", "performant", "secure"

**Observability:**
- Can the expected result actually be seen, measured, or queried?
- Is the outcome visible in the UI, API response, database, or logs?
- Are there internal state changes that can't be observed externally?

**Reproducibility:**
- Can the test scenario be set up reliably?
- Are the preconditions achievable in a test environment?
- Does the scenario depend on timing, external services, or specific data that's hard to control?

**Isolation:**
- Can the feature be tested independently?
- Does the design allow mocking or stubbing external dependencies?
- Are there test hooks (configuration flags, dependency injection, test endpoints)?

**Automation potential:**
- Can this criterion be automated, or does it require manual judgment?
- If manual, what's the cost of repeated testing?
- Are there criteria that should be automated but the design makes it difficult?

**When reviewing a design doc, also check:**

1. **Dependency injection** — Can external services be swapped for test doubles?
2. **Seams** — Are there clear boundaries where test data can be injected?
3. **Observability hooks** — Does the design include logging, metrics, or events that tests can assert on?
4. **Test data management** — Can test data be created and cleaned up without affecting other tests?
5. **Feature flags** — Can the feature be toggled for testing without deploying to production?

### Phase 3: Summary

Present findings in this structure:

```
## Testability Review: {Feature/Story Name}

### Findings

| # | Criterion / Requirement | Issue | Severity | Suggestion |
|---|------------------------|-------|----------|------------|
| 1 | "System handles errors gracefully" | Vague — what does "gracefully" mean? | Blocking | Rewrite: "On API error, show error message X and log error to Y" |
| 2 | AC3: concurrent editing | No way to simulate in test env | High | Design needs a test hook for simulating concurrent access |
| 3 | "Performance should be acceptable" | No metric defined | Blocking | Define: "Response time < 500ms at P95 under 100 concurrent users" |

### Well-defined criteria
- AC1: Login with valid credentials → clear input, clear output
- AC2: Validation on empty fields → specific, observable

### Verdict
- TESTABLE / NEEDS REVISION / SIGNIFICANT GAPS
```

**After presenting, grill each blocking and high-severity finding:**

Walk through them one at a time:
- "This criterion says 'handles gracefully' — what specific behavior should the test verify? An error message? A retry? A redirect?"
- "This AC requires testing with 1000 concurrent users — does the test environment support that? If not, what's a realistic test condition?"

**Drive resolution using these lenses:**
1. **Completeness** — "Did we check every criterion, or are there implicit requirements that aren't written down but still need testing?"
2. **Risk assessment** — "For the untestable criteria — what's the risk if we can't verify them? Is that acceptable?"
3. **Test environment** — "Does the test environment support everything we need? Are there gaps that need to be addressed before testing starts?"
4. **Automation boundaries** — "Which criteria should definitely be automated? Which are acceptable as manual checks?"
5. **Upstream feedback** — "Should we send these findings back to the PO/PM/BA to rewrite the criteria? Or can we resolve them here?"

Push for resolution — either rewrite the criterion, acknowledge it's not testable and accept the risk, or change the design to make it testable.

### Phase 4: Wrap-Up

1. Summarize: count of criteria reviewed, blocking issues, well-defined criteria
2. List remaining items that need resolution
3. Suggest next steps:
   - "Criteria need rewriting?" → send findings back to PO/PM/BA, or suggest `detail-requirements`
   - "Design needs test hooks?" → suggest `create-design`
   - "Ready to plan tests?" → suggest `create-test-plan`
   - "Ready to write test cases?" → suggest `write-test-cases`

## Constraints

- This is an advisory skill — reports findings and suggests improvements, does not rewrite criteria directly
- Every finding must include a specific suggestion for how to make it testable
- Don't reject criteria that are testable but just difficult — flag the difficulty and let the team decide
- Focus on testability, not test design — this is about "can we test it?" not "how do we test it?"
- Severity levels: Blocking (cannot test at all), High (testable but significant effort or risk), Low (minor improvement suggested)
