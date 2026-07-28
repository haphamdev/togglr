---
name: implement
description: Implement a task — write code and tests following the design and acceptance criteria
roles: [software-developer]
trigger: User wants to implement a feature, build a task, code something, or write implementation
output-path: null
---

# Implement

## When to use

- Implementing a task from the backlog
- Writing code for a user story or design doc
- Building a feature end-to-end with tests

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the developer:**

1. **Read the task.** Open the task file from `tasks/backlog/` (or the story from `tasks/stories/`). Follow the `parent` frontmatter to the upstream story if this is a task broken out by `break-task`.
2. **Read upstream artifacts.** Find and read the related design doc in `docs/design/`, acceptance criteria (both PM-level and BA-enriched), and any business rules in `docs/specs/`. Understand what "done" looks like before asking anything.
3. **Read existing patterns.** Search the codebase for similar code. If the task adds an endpoint, find an existing endpoint. If it adds a model, find an existing model. Read the pattern — this is what the implementation should follow.

**Brainstorm from what you read:**

4. **Analyze gaps.** Based on the AC, design doc, and codebase patterns, identify:
   - Edge cases and error scenarios not explicitly covered by the AC
   - Decisions the design doc leaves open or doesn't address
   - Testing strategy — what level of tests (unit, integration, both) and which cases to cover
   - Anything that seems ambiguous or contradictory between upstream artifacts

**Present your analysis with proposals:**

5. **Share and confirm.** Present what you found and what you think the approach should be. Propose edge cases, suggest a testing strategy, flag gaps — don't ask open-ended questions. The developer confirms, corrects, or adds to your proposals.

   Example: "The AC covers happy path and card-declined. Based on the design doc, I think we also need to handle card-expiry and gateway-timeout — the checkout endpoint handles timeouts with a 30s deadline. For testing, I'd suggest unit tests for validation and integration tests for the gateway call. Does this look right?"

**AC quality gate:**

6. **Check AC clarity before proceeding.** Review the acceptance criteria gathered in steps 1-2. If any of the following are true, **stop and suggest the `detail-requirements` skill before implementing:**
   - Acceptance criteria are missing entirely
   - Criteria use vague language ("handles gracefully", "works correctly", "is performant") without defining what that means
   - The happy path is defined but error and edge cases are not covered

   Explain what's missing: "The AC says 'user can submit the form' but doesn't specify what happens when validation fails, when the server is unreachable, or when the user submits twice. I'd suggest running `detail-requirements` to close these gaps before implementing — otherwise we'll be guessing at edge case behavior."

### Phase 2: Implementation (Adaptive)

**Assess complexity** before choosing the approach:

**Direct execution** (for simple, pattern-following tasks):
- The task follows an established pattern in the codebase
- No architectural decisions needed
- Read the pattern, implement following it, write tests, verify

**Plan-then-execute** (for anything involving decisions):
- Propose the approach before writing code:
  - What files will be created or modified
  - What pattern from the existing codebase to follow
  - How to handle error cases
  - What tests to write
- Wait for developer approval, then implement

**Implementation principles:**
- **Follow existing patterns.** Read how similar things are done in the project. Don't introduce new patterns without discussion.
- **Incremental.** If the task was broken down by `break-task`, follow its sub-steps in sequence — each has its own verification. If this is a single task, use the acceptance criteria as increments: implement AC1, verify, then AC2, verify. Run tests after each increment.
- **Write tests alongside.** For each piece of functionality, write the test that verifies it. Follow the developer's preferred approach (TDD, alongside, or after) from Phase 1.
- **Handle errors deliberately.** When the AC or design doc defines expected error behavior, implement it specifically. For errors not covered by upstream artifacts, use a sensible fallback — a generic error handler is fine when specific behavior hasn't been decided. Flag these for the developer to refine later if needed.
- **Trace to acceptance criteria.** Each piece of implementation should map to a specific AC. When you complete a piece, note which AC it satisfies — this creates the traceability used during verification.
- **Reference upstream artifacts.** When making implementation choices, reference the design doc or business rules that informed the decision. If no upstream artifact covers a decision, flag it for the developer rather than deciding silently.

### Phase 3: Verification

After implementation is complete, do one thorough pass:

1. **Run all tests** — new tests and existing tests. Everything must pass.
2. **Self-review the diff** — look at the complete set of changes as a reviewer would:
   - Any files changed that shouldn't be?
   - Any debug code or TODOs left in?
   - Are all error paths handled?
   - Do the changes match the acceptance criteria?
3. **Walk through each acceptance criterion** — explicitly verify that the implementation fulfills each one:
   - "AC1 says Given X, When Y, Then Z — here's where that's implemented: [file:line]"
   - Flag any acceptance criteria that aren't fully covered
4. **Probe failure modes** — what happens under conditions the AC didn't specify? Slow dependencies, service timeouts, malformed input beyond what was anticipated? Fix if warranted.
5. **Check test quality** — are the tests verifying behavior, not implementation details? Would they survive a refactoring of internals? Adjust if not.
6. **Check operational completeness** — does anything beyond code need updating? Configuration, environment variables, documentation, database migrations? Handle any gaps.

Address issues as they surface — fix the code, add tests, update configuration.

### Phase 4: Wrap-Up

1. Summarize what was implemented and how it maps to acceptance criteria
2. List any deviations from the original task or design
3. Note if any issues were discovered that affect other tasks or stories
4. Suggest next steps:
   - "Ready to update the task status?" → suggest the `update-status` skill
   - "Want a code review before committing?" → suggest the `code-review` skill
   - "Tests need more coverage?" → suggest the `write-tests` skill for edge case coverage or integration tests
   - "Move to the next task?" → reference the next task in the sequence

   If tests were deferred or skipped during implementation, recommend `write-tests` before moving forward.

## Constraints

- Follow existing codebase patterns and conventions — read before writing
- Write tests alongside implementation (or before, based on developer preference)
- The developer stays in control of architectural decisions — propose, don't decide
- Reference upstream task/story for traceability
- Run tests after implementation — don't report done without verification
- Don't introduce new libraries, patterns, or abstractions without explicit developer approval
- Don't implement against vague acceptance criteria — if AC is unclear or missing, suggest `detail-requirements` first
