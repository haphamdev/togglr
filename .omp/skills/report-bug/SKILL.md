---
name: report-bug
description: File a structured bug report with reproduction steps and severity classification
roles: [qa]
trigger: User found a bug, wants to report a defect, or needs to document an issue
output-path: tasks/backlog/bug-{kebab-name}.md
---

# Report Bug

## When to use

- Documenting a bug found during testing
- Filing a defect report for a known issue
- Creating a trackable bug from user feedback
- Recording a regression found after a code change

## Process

### Phase 1: Context Gathering (Grill for Clarity)

Ask pointed questions one at a time. A bug report without clear reproduction steps is not actionable — grill until the bug is fully understood:

1. **What happened?** Ask: "What did you see? What did you expect to see instead?" Get the exact observed behavior and expected behavior.
2. **How to reproduce?** Ask for the exact steps to trigger the bug. Walk through them:
   - "What did you do first?"
   - "What data did you enter?"
   - "What did you click?"
   - If the steps are vague, push: "Can you be more specific? What exact value did you enter in that field?"
3. **How consistent?** Ask: "Does this happen every time, or intermittently?" If intermittent, ask about conditions that make it more or less likely.
4. **Environment?** Ask: "What environment, browser, OS, or device were you using? What user account or role?"
5. **Regression?** Ask: "Did this work before? If so, when did it stop working? Was there a recent deployment or change?"
6. **Impact?** Ask: "Who is affected — all users, specific roles, specific data? Is there a workaround?"
7. **Evidence?** Ask: "Do you have screenshots, error messages, or log output?" If they have error messages, read them — they often reveal the root cause area.
8. **Related artifacts?** Check if there's a related story, test case, or test plan. Link to them for traceability.

### Phase 2: Severity Classification

Classify the bug using the P0-P3 scale:

| Level | Name | Criteria | Examples |
|-------|------|----------|----------|
| P0 | Critical | Data loss, security vulnerability, system crash, complete feature failure with no workaround | Payment charged but order not created; user data exposed to other users; app crashes on launch |
| P1 | High | Major feature broken with no reasonable workaround, blocks a core user flow | Cannot submit a form that's required for the workflow; search returns wrong results |
| P2 | Medium | Feature broken but workaround exists, or non-core feature affected | Export works but produces wrong column headers; filter option missing but manual sorting works |
| P3 | Low | Cosmetic issue, minor inconvenience, edge case with minimal impact | Typo in error message; alignment off by a few pixels; tooltip shows wrong shortcut key |

Present the severity with justification. If uncertain between two levels, state both and ask the user to decide.

### Phase 3: Report Writing

Create the bug report file using the output template. Ensure:

- Reproduction steps are numbered and specific enough that someone unfamiliar can follow them
- Expected vs. actual behavior is crystal clear
- Environment details are complete
- The related story or test case is linked

### Phase 4: Deepening (Grill the Report)

After creating the report, review it for completeness:

1. **Reproducibility** — "Can someone who has never seen this bug follow these steps and reproduce it? Let me walk through them." Simulate following the steps literally.
2. **Root cause hints** — "Based on the error message and behavior, does this point to a specific component? Should we note that in the report to help the developer?"
3. **Scope** — "Is this isolated to this one scenario, or could it affect similar flows? Should we check related features?"
4. **Severity accuracy** — "Is the severity right? If this is P2, is there really a workaround? If P1, is it truly blocking?"
5. **Missing information** — "Would a developer need anything else to start fixing this? Specific test data? Database state? API request/response?"

Update the report as issues surface.

### Phase 5: Wrap-Up

1. Summarize: bug title, severity, affected area
2. Suggest next steps:
   - "Want to check if this affects other scenarios?" → suggest exploratory testing
   - "Should the test plan be updated?" → reference the related test plan
   - "Ready to assign to a developer?" → suggest updating the status

## Output Template

```markdown
---
title: "Bug: { Brief descriptive title }"
status: draft
owner: { QA name }
date: { YYYY-MM-DD }
parent: { stories/story-name.md or test-plans/plan-name.md }
severity: { P0 / P1 / P2 / P3 }
---

# Bug: { Brief descriptive title }

## Summary

{ One-sentence description of the bug }

## Severity: { P0 Critical / P1 High / P2 Medium / P3 Low }

**Justification:** { why this severity level }
**Workaround:** { none, or describe the workaround }

## Environment

- **Environment:** { staging / production / local }
- **Browser/Device:** { Chrome 120, iOS 17, etc. }
- **User role:** { admin / regular user / etc. }
- **Date found:** { YYYY-MM-DD }

## Reproduction Steps

1. { exact step }
2. { exact step }
3. { exact step }

**Reproducibility:** { always / intermittent (~X% of attempts) / once }

## Expected Behavior

{ what should happen }

## Actual Behavior

{ what actually happens — include error messages verbatim }

## Evidence

{ screenshots, log output, error messages — or "none available" }

## Regression

{ Yes — worked as of [date/version]. No — never worked. Unknown. }

## Related Artifacts

- Story: { link to related story }
- Test case: { link to related test case, if found during test execution }

## Notes

{ any additional context — root cause hints, related bugs, affected components }
```

## Constraints

- Always set status to `draft` on creation
- Link to related story or test case via `parent` frontmatter field
- Reproduction steps are mandatory — a bug without repro steps is not actionable
- Use the P0-P3 severity scale consistently with code review findings
- Include exact error messages verbatim — don't paraphrase
- State reproducibility — always, intermittent, or one-time
- Include environment details — bugs that only happen in one browser matter
- Note whether it's a regression — this affects priority
