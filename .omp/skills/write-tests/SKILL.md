---
name: write-tests
description: Write or improve tests for existing code — supports TDD, alongside, and backfill approaches
roles: [software-developer]
trigger: User wants to write tests, add test coverage, improve tests, or create test cases for code
output-path: null
---

# Write Tests

## When to use

- Adding tests for existing untested code (backfill)
- Writing tests first for new code (TDD)
- Writing tests alongside new implementation
- Improving test coverage for a specific module
- Writing regression tests after a bug fix

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the developer:**

1. **Read the source files.** Read the code to be tested. Understand what it does — all code paths, branches, error handlers, edge cases.
2. **Read existing tests.** Read existing test files in the project. Understand the testing framework, conventions, file structure, naming patterns, and mocking approach. Follow them exactly.
3. **Read test infrastructure.** Check for test helpers, fixtures, factories, test database setup, and shared utilities. These are tools to use, not reinvent.

**Brainstorm from what you read:**

4. **Analyze test needs.** Based on the source code and existing tests, identify:
   - The testing situation — backfill (no tests exist), TDD (code not written yet), or regression (bug fix) — based on whether tests already exist
   - Untested code paths — happy paths, branches, error handlers without coverage
   - Test cases grouped by: happy path, edge cases, error cases
   - What level of tests fits (unit, integration, or both) based on the code's dependencies and existing patterns

**Present your analysis with proposals:**

5. **Share and confirm.** Present the test cases you identified and suggest an approach — don't ask open-ended questions. The developer confirms, corrects, or adjusts scope.

   Example: "I've read the payment module at src/validators/payment.ts and existing tests in tests/validators/. The project uses Jest with describe/it blocks and mocks external services with jest.mock. The validation logic has no tests — the gateway integration has 2 tests covering happy path only. I'd suggest: unit tests for all 4 validation rules, integration tests for the gateway call including timeout and error responses, and a boundary test for the $10 minimum. Does this plan look right, or should we focus on a specific area first?"

### Phase 2: Test Planning

Before writing tests, identify the test cases:

**For backfill (existing code):**
1. Read the code and identify all code paths — happy paths, branches, error handlers
2. Check if any tests already exist — avoid duplicating coverage
3. Propose the test cases as a numbered list grouped by: happy path, edge cases, error cases
4. Ask the developer to confirm, add, or remove test cases

**For TDD (new code):**
1. Read the acceptance criteria and design doc
2. Write the test cases that define the expected behavior — these will fail initially
3. Each test should be specific enough that there's only one way to make it pass

**For regression (bug fix):**
1. Understand the bug — what was the input, what happened, what should have happened
2. Write a test that reproduces the bug with the exact failing scenario
3. Confirm the test fails before the fix, passes after

### Phase 3: Test Writing

**Principles:**
- **Test behavior, not implementation.** Test what the code does (inputs → outputs, side effects), not how it does it internally. Tests should survive refactoring.
- **Follow existing patterns.** Use the same framework, assertions, file structure, and naming as existing tests. Don't introduce new testing patterns.
- **Clear test names.** The test name should describe the expected behavior: `test_payment_fails_when_card_is_expired` not `test_payment_3`.
- **One assertion per concept.** Each test should verify one specific behavior. Multiple related assertions are fine, but testing unrelated things in one test is not.
- **Arrange-Act-Assert structure.** Set up the state, perform the action, check the result. Keep the three sections visually distinct.
- **Cover the edges.** For each happy path, add: invalid input, boundary values, null/empty, error conditions.
- **Avoid mocking unless necessary.** Prefer real objects and in-memory implementations. Only mock external services or when the real dependency is impractical in tests. Follow the project's existing approach to mocking.

### Phase 4: Verification

After writing the tests, do one thorough pass:

1. **Run all tests** — new and existing. Everything must pass.
2. **Verify tests can fail.** For key tests, temporarily flip an assertion or mutate the code to confirm the test actually catches failures. A test that always passes is worse than no test.
3. **Check for false positives.** Are there tests that pass because they're testing mocks instead of real behavior? Are assertions actually checking the right values?
4. **Coverage gaps** — Are there code paths without tests? What about the error handler on line X? What about the boundary condition when the list is empty?
5. **Test quality** — Would these tests still pass if the internals were refactored? Are we testing behavior or implementation details?
6. **Readability** — Can someone reading this test understand what behavior it verifies without reading the source code?
7. **Maintenance** — Are any tests fragile — would they break from unrelated changes? Are we over-mocking?
8. **Missing scenarios** — What would a creative user or attacker try that we haven't tested?

Address issues as they surface — add tests, adjust assertions, fix fragile patterns.

### Phase 5: Wrap-Up

1. Summarize test coverage added (count of tests, areas covered)
2. Note any areas that still lack coverage and why
3. Suggest next steps:
   - "Coverage is good — ready to implement" (if TDD)
   - "Ready for code review" → suggest the `code-review` skill
   - "Untestable areas need restructuring?" → suggest `refactor`
   - "Found bugs while writing tests?" → suggest `report-bug` or `debug`

## Constraints

- Follow existing test patterns and conventions — read existing tests before writing new ones
- Test behavior, not implementation details
- Cover both happy paths and edge cases
- Name tests clearly — the name should describe the expected behavior
- Run tests after writing — don't report done without verification
- Verify tests can fail — a test that never fails is not a test
- Don't introduce new testing frameworks or patterns without explicit developer approval
