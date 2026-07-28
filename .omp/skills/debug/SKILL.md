---
name: debug
description: Systematically debug a problem — reproduce, isolate, root-cause, fix, and verify
roles: [software-developer]
trigger: User wants to debug, troubleshoot, fix a bug, figure out why something is failing, or investigate unexpected behavior
output-path: null
---

# Debug

## When to use

- Something isn't working as expected during development
- A test is failing and the cause isn't obvious
- Unexpected behavior that needs investigation
- A bug reported by QA or users that needs diagnosis

## Process

### Phase 1: Reproduce

Understand the symptoms, then read the relevant code before asking more.

**Get the symptoms first:**

1. **What's happening?** Ask: "What did you observe? What did you expect instead?" Get the exact error message, unexpected output, or incorrect behavior. Identify the code area or feature involved.

**Read before asking more:**

2. **Read the relevant code.** Once symptoms point to a code area, read proactively before asking further questions:
   - Read the code path in the affected area
   - Read error messages and stack traces (if shared)
   - Check recent git changes in the area — `git log` for the affected files
   - Read related tests — do they cover this scenario?

**Ask informed follow-up questions:**

3. **Fill gaps from what you couldn't determine by reading.** Ask only what you still need:
   - Reproduction steps — "What exact steps trigger this?" (if not obvious from the error)
   - Environment — "Local dev, staging, production?" (if it matters for this type of bug)
   - What's been tried — avoid repeating work the developer already did

   Skip questions the reading already answered — e.g., if `git log` shows a recent change to the affected file, don't ask "what changed recently?"

   Example: "I see the 500 is coming from line 42 in payment.ts — a null reference on `user.paymentMethod`. There was a commit yesterday that refactored the user model. The test for this endpoint still passes but it mocks the user object, so it wouldn't catch a real schema change. Can you reproduce this every time, or is it intermittent?"

### Phase 2: Isolate

Narrow down the cause systematically:

1. **Read the error** — Start with error messages, stack traces, and log output. They often point directly to the problem area.
2. **Trace the flow** — Read the code path from entry point to failure. Identify where the actual behavior diverges from expected behavior.
3. **Form hypotheses** — Based on the code reading, propose 2-3 possible causes, ranked by likelihood. Explain the reasoning for each.
4. **Narrow down** — For each hypothesis:
   - What evidence would confirm or rule it out?
   - Can we add a log statement, check a value, or write a minimal test to verify?
5. **Bisect if needed** — If the bug is a regression: identify which change introduced it using git history.

Present the isolation findings: "I believe the bug is in {file:line} because {reasoning}. Here's why the other hypotheses are less likely."

### Phase 3: Root Cause

Once the location is identified, explain the root cause clearly:

- **What's happening:** the specific code path that produces the wrong behavior
- **Why it's happening:** the underlying reason (wrong assumption, missing check, race condition, etc.)
- **When it was introduced:** if identifiable from git history

Ask the user to confirm the diagnosis before proceeding to fix.

### Phase 4: Fix

1. **Propose the fix** — Explain what to change and why. If there are multiple approaches, present them with trade-offs.
2. **Implement** — Make the minimal change that fixes the root cause. Don't fix adjacent issues in the same change.
3. **Write a regression test** — Create a test that:
   - Reproduces the exact bug scenario
   - Fails without the fix (verify this)
   - Passes with the fix
4. **Run all tests** — Ensure the fix doesn't break anything else.

### Phase 5: Verification

After the fix is implemented, do one thorough pass:

1. **Reproduce the original steps** — Confirm the bug no longer occurs with the exact reproduction steps from Phase 1.
2. **Check related scenarios** — Test nearby functionality that might be affected by the change.
3. **Review the diff** — Is the fix minimal and focused? Any unintended side effects?
4. **Pattern check** — Could this same bug exist elsewhere in the codebase? Search for similar code patterns that might have the same issue. Fix if found.
5. **Root cause depth** — Is this a symptom of a deeper problem? Is there an architectural issue that made this bug easy to introduce? Flag if so.
6. **Prevention** — Should we add defensive checks, better error messages, or type constraints to prevent this class of bug? Add if warranted.
7. **Test coverage** — Was there a missing test that should have caught this? Are there related scenarios that need test coverage beyond the regression test? Add if needed.

Address issues as they surface — fix the code, add tests, flag architectural concerns.

### Phase 6: Wrap-Up

1. Summarize: what the bug was, root cause, what was fixed
2. Note the regression test that was added
3. Suggest next steps:
   - "Ready for code review?" → suggest the `code-review` skill
   - "Found a deeper issue?" → suggest filing it as a separate task
   - "Want to file a bug report for tracking?" → suggest the `report-bug` skill
   - "Fix revealed missing test coverage?" → suggest `write-tests`
   - "Root cause is architectural?" → suggest `refactor` for structural fixes

## Constraints

- Always reproduce the bug before attempting to fix — never fix blindly
- Explain the root cause before proposing a fix — the user should understand what went wrong
- Make minimal fixes — don't refactor surrounding code in the same change
- Always write a regression test — a bug without a test will come back
- Run all tests after fixing — don't report done without verification
- If the bug can't be reproduced, say so — don't pretend to fix something you can't verify
