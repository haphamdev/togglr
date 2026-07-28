---
name: code-review
description: Review code changes or a pull request with structured, severity-based feedback
roles: [software-developer, tech-lead]
trigger: User wants a code review, PR review, or feedback on code changes
output-path: null
---

# Code Review

## When to use

- Reviewing a pull request before merge
- Getting feedback on code changes before submitting a PR
- Reviewing specific files or a diff for quality issues

## Process

### Phase 1: Context Gathering

Read first, then ask only what you can't determine from the code.

**Read these before engaging the developer:**

1. **Read the changes.** Get the diff:
   - PR number → `gh pr diff` and `gh pr view` for description
   - Specific files → read those files
   - Uncommitted changes → `git diff`
2. **Read related artifacts.** Check the PR description, linked story or task in `tasks/`, related design doc in `docs/design/`, and acceptance criteria. Understand what the change is supposed to accomplish.
3. **Read surrounding code.** Read the full files that were changed (not just the diff lines) and related files that interact with the changed code. Understand the existing patterns and conventions.

**Brainstorm from what you read:**

4. **Analyze the change.** Based on the diff, artifacts, and surrounding code, identify:
   - The intent of the change — what problem it solves
   - Which review dimensions matter most (a payment endpoint gets security focus; a UI text change doesn't)
   - Files that might need changes but weren't touched
   - Whether the change includes tests proportional to the risk

**Present your analysis:**

5. **Share your focus and ask for specific concerns.** Tell the developer what you'll emphasize and why. Ask if there's anything specific they're worried about.

   Example: "This is a 150-line change adding a payment validation endpoint. It touches user input handling and database queries, so I'll weight security and correctness heavily. The design doc specifies three error scenarios — I'll check those are all covered. Any specific areas you'd like me to focus on?"

### Phase 2: Review

Evaluate across dimensions. Adapt emphasis based on what the change involves — a data-mutation endpoint gets heavier security scrutiny than a UI text change.

**Correctness:**
- Does the code do what the story/task says it should?
- Are there logic errors, off-by-one bugs, incorrect conditions?
- Are all acceptance criteria fulfilled?
- Are edge cases handled?

**Security:**
- Input validation — is user input sanitized?
- Authentication/authorization — are access controls correct?
- Data exposure — is sensitive data logged, leaked, or over-returned?
- Injection risks — SQL, command, XSS?

**Performance:**
- N+1 queries, unbounded loops, missing indexes?
- Unnecessary allocations or expensive operations in hot paths?
- Missing pagination for potentially large result sets?

**Reliability:**
- Error handling — are errors caught, logged, and handled appropriately?
- Failure modes — what happens when external services are down?
- Resource management — are connections, files, locks properly released?

**Test coverage:**
- Does the change include tests? Are new code paths tested?
- Do existing tests still cover the changed behavior, or were they silently invalidated?
- Were any tests removed or weakened? Is the removal justified?
- Are the tests verifying behavior or implementation details?

**Consistency:**
- Does it follow existing codebase patterns?
- Naming conventions, file structure, error handling approach?
- Does it introduce a new way of doing something that already has an established pattern?

**Maintainability:**
- Is the code readable? Would someone unfamiliar understand it?
- Is there unnecessary complexity that could be simplified?
- Any duplication that should be extracted?

**Scope completeness:**
- Are there related files that should have been changed but weren't?
- Are there migrations, config changes, or documentation updates that the code change implies but doesn't include?
- Does the change leave any half-finished work — new functions that aren't called, dead code from the old approach?

**Classify findings by severity:**

| Level | Name | Description | Action |
|-------|------|-------------|--------|
| P0 | Critical | Security vulnerability, data loss risk, correctness bug | Must fix before merge |
| P1 | High | Logic error, significant pattern violation, performance regression | Should fix before merge |
| P2 | Medium | Code smell, maintainability concern, missing edge case | Fix in this PR or create follow-up |
| P3 | Low | Naming, minor style suggestion | Optional improvement |

### Phase 3: Summary

Present findings in this structure:

```
## Code Review: {PR title or change description}

**Files reviewed:** {count} files, {lines} lines changed
**Focus areas:** {which dimensions were emphasized and why}
**Overall assessment:** APPROVE / REQUEST CHANGES / COMMENT

---

### P0 — Critical
(none or list)

### P1 — High
1. **{file:line}** — {brief title}
   - Issue: {description of the problem}
   - Impact: {what goes wrong if not fixed}
   - Fix: {concrete suggestion}

### P2 — Medium
...

### P3 — Low
...

---

### Strengths
- {what's done well — reinforces good patterns}

### Summary
{Brief overall assessment and key takeaways}
```

**Drive resolution on critical and high findings:**

Walk through P0 and P1 findings one at a time:
- "This endpoint doesn't validate the user ID parameter — an attacker could access other users' data. Here's how I'd fix it: [concrete code suggestion]. Does this approach work?"
- "This query doesn't have a LIMIT — if the table grows, this will time out. Should we add pagination, or is the data set guaranteed to be small?"

Push for resolution on each finding — either fix it, explicitly defer it, or explain why it's not actually an issue.

### Phase 4: Wrap-Up

1. Summarize: how many findings per severity, overall verdict
2. If APPROVE — note any caveats or things to watch in production
3. If REQUEST CHANGES — list the must-fix items clearly
4. Suggest next steps based on findings:
   - "Code smells worth addressing?" → suggest the `refactor` skill
   - "Missing test coverage?" → suggest the `write-tests` skill
   - "Found a bug in existing code (not introduced by this PR)?" → suggest the `report-bug` skill
   - "Design gaps surfaced during review?" → suggest the `create-design` skill

## Constraints

- This is a read-only advisory skill — do not modify code directly unless the developer asks for help fixing
- Organize findings by severity, not by file
- Always include file path and line reference for each finding
- Suggest concrete fixes, not vague advice ("add validation" → show the validation code)
- Focus on real issues — skip stylistic nitpicks unless they indicate deeper problems
- Judge against project conventions, not abstract ideals
- Give strengths alongside issues — good patterns deserve recognition
- If the code is solid, say so — don't manufacture findings
