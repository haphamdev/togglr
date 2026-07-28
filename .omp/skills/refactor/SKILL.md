---
name: refactor
description: Improve code structure without changing behavior — extract, simplify, deduplicate, reorganize
roles: [software-developer, tech-lead]
trigger: User wants to refactor, clean up code, improve code structure, extract a module, simplify, or reduce duplication
output-path: null
---

# Refactor

## When to use

- Improving code structure to make it easier to understand or extend
- Extracting common logic into shared utilities
- Simplifying overly complex functions or classes
- Reducing duplication across the codebase
- Reorganizing code to better match the project's architecture
- Preparing code for a new feature (make the change easy, then make the easy change)

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the developer:**

1. **Read the code to refactor.** Read the specific code area thoroughly — understand what it does, how it's structured, and why it might be structured that way.
2. **Read callers and dependents.** Find everything that uses this code. Understand the contracts — what callers expect, what APIs are public, what would break if the interface changed.
3. **Read existing tests.** Read the test files covering this code. Understand what's tested, what's not, and the testing approach used.
4. **Read surrounding patterns.** Search the codebase for similar code. How are equivalent modules structured? What patterns does the project use? This informs what the refactored code should look like.

**Brainstorm from what you read:**

5. **Analyze refactoring opportunities.** Based on what was read, identify:
   - Specific problems: duplication, complexity, inconsistency with surrounding patterns, dead code, unclear naming
   - Test coverage status — is it safe to refactor?
   - A proposed scope and approach based on the code and surrounding patterns
   - Constraints from callers and public APIs

**Present your analysis with proposals:**

6. **Share and confirm.** Present what you found and propose a refactoring direction — don't ask open-ended questions. The developer confirms, corrects, or adjusts scope.

   Example: "I've read the payment validation module and its 3 callers. The module has 2 functions over 200 lines each with duplicated validation logic — the same card-expiry check appears in 3 places. Tests cover the happy path but not error branches. The surrounding codebase uses a validator pattern (see src/validators/order.ts) that this module doesn't follow. I'd suggest extracting the shared validations and aligning with the validator pattern. What's driving this refactoring — is it the duplication, or are you preparing for a specific change? And are there callers or APIs that must stay the same?"

**Test coverage quality gate:**

7. **Check if tests exist.** If the code has no test coverage, **stop:** "This code has no test coverage. Refactoring without tests is risky — I'd suggest writing tests first with `write-tests` to establish a safety net before restructuring anything."

### Phase 2: Plan

Before changing anything, propose the refactoring approach:

1. **Identify the specific improvements:**
   - Extract method/function — long functions split into focused pieces
   - Extract module/class — responsibilities separated
   - Rename — unclear names replaced with descriptive ones
   - Simplify conditional — nested if/else replaced with early returns, guard clauses, or polymorphism
   - Remove duplication — similar code consolidated into a shared utility
   - Move code — logic relocated to where it belongs architecturally
   - Remove dead code — unused functions, unreachable branches

2. **Propose the order:**
   - Safest changes first (renames, dead code removal)
   - Then structural changes (extract, move)
   - Riskiest changes last (simplification of complex logic)

3. **Identify verification points:**
   - Which tests to run after each step
   - What behavior to manually verify

Present the plan and wait for approval before proceeding.

### Phase 3: Execute

Implement the refactoring incrementally:

1. **One change at a time** — Make a single, focused refactoring step
2. **Run tests after each step** — All tests must pass before proceeding to the next change
3. **Keep behavior identical** — If tests start failing, stop and investigate. The purpose is to change structure, not behavior
4. **Track what changed** — Note each refactoring step so the changes can be reviewed

**Principles:**
- **No behavior changes.** If a bug is found during refactoring, note it and fix it in a separate change. Don't mix refactoring with bug fixes.
- **Follow existing patterns.** If the codebase uses a specific approach for similar code, follow it. Don't introduce a new pattern unless discussing it first.
- **Preserve the public interface.** Internal restructuring is fine; changing how callers interact with the code requires discussion.
- **Small steps.** Each step should be independently reviewable and reversible.

### Phase 4: Verification

After all refactoring steps are complete, do one thorough pass:

1. **Run the full test suite** — everything must pass
2. **Review the complete diff** — look at all changes together:
   - Is the code actually clearer?
   - Are there any accidental behavior changes?
   - Did we introduce any new coupling?
3. **Compare before and after** — for key functions, verify the logic is functionally equivalent
4. **Check callers** — verify that all callers of the refactored code still work correctly
5. **Far enough?** — "Is the code now easy to understand and extend? Or did we stop short — are there more improvements that would help?"
6. **Too far?** — "Did we over-abstract? Is the new structure simpler than the old one, or just different? Fewer layers is usually better."
7. **Clarity** — "Would someone reading this code for the first time understand it? Is the intent clear from the names and structure?"
8. **Consistency** — "Does the refactored code match patterns used elsewhere in the codebase? Did we create an inconsistency?"

Make additional changes if issues surface.

### Phase 5: Wrap-Up

1. Summarize: what was refactored, what approach was used, what improved
2. List any issues found during refactoring that need separate attention
3. Suggest next steps:
   - "Want a code review?" → suggest the `code-review` skill
   - "Found a bug during refactoring?" → suggest the `debug` skill or `report-bug` skill
   - "Tests are missing?" → suggest the `write-tests` skill
   - "Refactoring revealed architectural issues?" → suggest `create-design`
   - "Ready to commit?" → note that refactoring should be committed separately from feature work

## Constraints

- Tests must exist before refactoring starts — if not, suggest `write-tests` first
- No behavior changes — refactoring changes structure, not function. If tests fail, stop and investigate
- One change at a time — run tests after each step
- Don't mix refactoring with feature work or bug fixes — keep them in separate commits
- Follow existing codebase patterns — don't introduce new patterns without discussion
- Get approval on the plan before starting — especially for larger refactoring
- Preserve public interfaces unless explicitly agreed to change them
