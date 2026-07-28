---
name: verify-story
description: Verify an implementation against acceptance criteria plus exploratory testing
roles: [qa]
trigger: User wants to verify a story, check implementation, run acceptance tests, or confirm a feature works
output-path: null
---

# Verify Story

## When to use

- Checking that an implementation meets all acceptance criteria
- Running through test cases against a completed feature
- Performing final verification before marking a story as done
- Re-verifying after bug fixes

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts and codebase.

**Read these before engaging the user:**

1. **Read the story.** Ask for the story file path, or list stories in `tasks/stories/`. Read it thoroughly — understand every acceptance criterion, both PM-level and BA-enriched.
2. **Read related artifacts.** Find and read:
   - Test plan in `docs/test-plans/` (if one exists for this feature)
   - Test cases (if written)
   - Design doc (to understand intended behavior)
   - Business rules (to verify rule compliance)
3. **Check the story status.** If the status is `draft` or `todo`, flag it.
4. **Read the implementation.** Find and read the code that was built for this story. Understand what was actually implemented.
5. **Check for automated tests.** Read existing test files for this feature. If automated tests exist, run them — they catch regressions quickly.

**Brainstorm from what you read:**

6. **Analyze verification approach.** Based on the story, artifacts, and code, identify:
   - Verification method: test cases exist → verify against test cases. No test cases → verify against AC directly.
   - Preliminary AC mapping: which AC maps to which code, and any obvious gaps
   - Exploratory testing focus areas based on the implementation and risk

**Present your analysis:**

7. **Share and confirm.** Present what you found and propose the approach — don't ask open-ended questions.

   Example: "I've read the checkout story — it has 5 acceptance criteria plus 3 BA edge cases. The test plan exists with 8 test cases covering all AC. The implementation is at src/checkout/ and there are 12 automated tests that all pass. The story status is `in-progress`. I'll verify against the test cases since they exist, and run automated tests first. Where should I verify — local dev or staging?"

**Implementation readiness gate:**

8. **Check if there's something to verify.** If the story status is `draft` or `todo` and no implementation code exists, **stop:** "This story hasn't been implemented yet — there's nothing to verify. The status is still `draft`."

### Phase 2: AC Verification

Walk through every acceptance criterion explicitly. For each one:

1. **State the criterion** — quote it exactly from the story
2. **Describe how to verify** — what to check, what input to use, what to look for
3. **Record the result** — PASS, FAIL, or BLOCKED (can't verify due to environment/data issues)
4. **Capture evidence** — for failures, note the exact observed behavior vs. expected

Present results in a table:

```
| # | Acceptance Criterion | Result | Notes |
|---|---------------------|--------|-------|
| 1 | Given X, When Y, Then Z | PASS | Verified with test data A |
| 2 | Given X, When Y, Then Z | FAIL | Expected Z but got W |
| 3 | Given X, When Y, Then Z | BLOCKED | Staging environment down |
```

If test cases exist, also note which test case(s) covered each AC.

### Phase 3: Exploratory Testing

After AC verification, do a short exploratory pass. Try things the acceptance criteria didn't explicitly cover:

**Areas to explore:**
- **Unexpected inputs** — special characters, very long strings, empty values, SQL/script injection attempts
- **Rapid actions** — double-click submit, navigate away mid-action, refresh during processing
- **State variations** — what if the data was already deleted? Already processed? Modified by another user concurrently?
- **Browser/device behavior** — back button, bookmark the page, deep link to a state that requires prior steps
- **Error recovery** — what happens after an error? Can the user retry? Is the state consistent?
- **Permissions** — can a user without the right role access this? What do they see?

Record any findings as observations — these are not AC failures, but quality concerns:

```
| # | Observation | Severity | Recommendation |
|---|------------|----------|----------------|
| 1 | Double-clicking submit creates duplicate records | P1 | File bug |
| 2 | Error message shows raw stack trace | P2 | File bug |
| 3 | Works but the loading state is confusing | P3 | Note for improvement |
```

### Phase 4: Verdict

Based on AC verification and exploratory testing, deliver a verdict:

**PASS** — All acceptance criteria pass. Exploratory testing found no P0/P1 issues. Recommend updating story status to `done`.

**FAIL** — One or more acceptance criteria failed, or exploratory testing found P0/P1 issues. List what failed and recommend:
- Filing bug reports for each failure → suggest the `report-bug` skill
- Keeping the story status as `in-progress`
- Noting which criteria passed (partial credit — the developer doesn't need to redo everything)

**BLOCKED** — Cannot complete verification due to environment issues, missing test data, or dependencies. List what's blocking and what was verified so far.

**After delivering the verdict, grill the thoroughness:**

1. **AC coverage** — "Did we verify every criterion, or did we skip any? Are there criteria that were ambiguous — we said PASS but it could be interpreted differently?"
2. **Test depth** — "Did we test with realistic data? Production-like volumes? Multiple user roles?"
3. **Regression** — "Did this change break anything that used to work? Should we check related features?"
4. **Edge cases** — "The BA added edge case criteria — did we verify all of those too, or just the PM's happy-path criteria?"
5. **Exploratory completeness** — "Are there areas we didn't explore? What would a malicious user try? What about accessibility?"

Update the verdict if new findings emerge.

### Phase 5: Wrap-Up

1. Summarize: verdict, count of AC passed/failed/blocked, exploratory findings
2. If PASS:
   - "Ready to mark as done?" → suggest the `update-status` skill to change status to `done`
   - Note any P2/P3 exploratory findings as follow-up items
3. If FAIL:
   - List each failure with recommended action (bug report, clarification needed, etc.)
   - "Want to file bug reports?" → suggest the `report-bug` skill for each failure
4. If BLOCKED:
   - List blockers and who can resolve them
   - Note what was verified so far — don't lose the partial progress
5. Additional suggestions:
   - "Automated test coverage lacking for this feature?" → suggest `write-tests`
   - "AC was ambiguous during verification?" → suggest `detail-requirements` to clarify for future stories

## Constraints

- This is an advisory skill — reports findings and recommends status changes, does not change status directly
- Check every acceptance criterion explicitly — no skipping or summarizing
- Quote acceptance criteria exactly from the story — don't paraphrase
- Record PASS, FAIL, or BLOCKED for each criterion — no ambiguous results
- Always do the exploratory pass after AC verification — even if all ACs pass
- Exploratory findings are separate from AC results — don't mix them
- Use P0-P3 severity for exploratory findings — consistent with bug reports and code review
- If all ACs pass and no P0/P1 exploratory issues, the verdict is PASS — don't hold up delivery for P3 cosmetic issues
