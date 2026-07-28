---
name: assess-tech-debt
description: Evaluate code areas for technical debt — classify, prioritize, and recommend action
roles: [tech-lead, software-developer]
trigger: User wants to assess tech debt, evaluate code quality, check if code is maintainable, decide whether to rewrite or extend, review code health, or asks about build vs buy
output-path: null
---

# Assess Tech Debt

## When to use

- Evaluating whether a module or service needs refactoring
- Deciding between extending existing code vs. rewriting
- Planning a tech debt reduction initiative
- Investigating why a codebase area is difficult to work with
- Responding to "this code is messy" or "should we rewrite this?"

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the code and git history.

**Read these before engaging the developer:**

1. **Read the code area.** Read the specific module, service, or directory the user references. If they gave a specific path, read it. If vague, ask for the area first. Understand the structure, patterns, and complexity.
2. **Read test files.** Find and read tests covering this area. Understand what's tested, what's not, the testing approach, and test health (brittle? slow? testing implementation details?).
3. **Check git history.** Look at churn — which files changed most often, recent changes, and commit patterns. High churn often indicates debt. Check if this area has been refactored before.
4. **Read dependency files.** Check package.json, requirements.txt, or equivalent for outdated or vulnerable dependencies relevant to this area.

**Brainstorm from what you read:**

5. **Analyze preliminary debt signals.** Based on the code, tests, and history, identify:
   - Early debt signals: duplication, complexity, missing tests, outdated dependencies, inconsistent patterns
   - Test coverage status — is this area well-tested or risky to change?
   - Git churn patterns — which files change together, which change most often
   - A preliminary assessment of the area's health

**Present your analysis with proposals:**

6. **Share and confirm.** Present what you found and propose the assessment focus — don't ask open-ended questions.

   Example: "I've read the payment processing module at src/payments/. It has 4 files totaling ~800 lines. Test coverage exists for the main flow but not error paths. Git history shows processor.ts has been modified 23 times in 3 months — high churn. The validation logic is duplicated between processor.ts and webhook-handler.ts. Dependencies include stripe@8.x (current is 14.x). What's driving this assessment — are you experiencing specific pain, or is this a proactive health check? And are there areas that can't be changed (external contracts, etc.)?"

**Code existence quality gate:**

7. **Check if there's code to assess.** If no code exists in the specified area (empty directory, no matching files), **stop:** "I can't find any code at {path}. Can you point me to the correct location?"

### Phase 2: Analysis

Read the code systematically and evaluate across debt categories:

**Architectural debt:**
- Tight coupling between modules that should be independent
- Missing or wrong abstractions — code doing too much or in the wrong place
- Circular dependencies
- Inconsistent patterns — same problem solved differently in different places
- Violations of the project's own architecture (if documented)

**Code quality debt:**
- Duplication — similar logic repeated in multiple places
- Complexity — functions or classes that are too long, too nested, or do too many things
- Naming — unclear variable/function/class names that obscure intent
- Dead code — unused functions, unreachable branches, commented-out code

**Dependency debt:**
- Outdated libraries with known vulnerabilities
- Dependencies that are no longer maintained
- Over-reliance on a single dependency for critical functionality
- Version conflicts or pinned versions that block upgrades

**Test debt:**
- Missing test coverage for critical paths
- Brittle tests that break on unrelated changes
- Slow test suite that discourages running tests
- Tests that test implementation details instead of behavior

**Documentation debt:**
- Missing or outdated documentation for complex logic
- No onboarding path for new developers
- Undocumented configuration or environment requirements

For each area, note specific examples with file paths and line numbers.

### Phase 3: Classification

Classify each finding using the P0-P3 scale:

| Level | Criteria | Example |
|-------|----------|---------|
| P0 Critical | Active risk — security vulnerability, data corruption risk, or blocking team velocity | Outdated auth library with known CVE |
| P1 High | Significant drag — measurably slowing development, causing recurring bugs, or blocking planned work | Every feature change requires modifying 5+ files due to tight coupling |
| P2 Medium | Notable friction — makes code harder to understand or maintain, but workarounds exist | Duplicated validation logic in 3 places — works but drifts over time |
| P3 Low | Minor irritant — cosmetic or stylistic issues that don't materially affect velocity | Inconsistent naming conventions across older modules |

For each finding, estimate effort to fix: Small (hours), Medium (days), Large (weeks).

Present as a summary:

```
## Tech Debt Assessment: {Area Name}

### Summary
- **Scope:** {what was assessed}
- **Overall health:** {one-sentence assessment}
- **Critical items:** {count}
- **Total findings:** {count}

### Findings

| # | Category | Finding | Severity | Effort | Recommendation |
|---|----------|---------|----------|--------|----------------|
| 1 | Architectural | Tight coupling between X and Y | P1 | Medium | Extract interface, decouple |
| 2 | Test | No tests for payment flow | P1 | Medium | Add integration tests before next change |
| 3 | Dependency | Library Z has known CVE | P0 | Small | Upgrade immediately |
```

### Phase 4: Prioritization

Recommend what to address first, based on:

1. **Risk x Effort** — High risk, low effort items first (quick wins)
2. **Blocking planned work** — Debt that blocks upcoming features gets priority
3. **Compounding** — Debt that makes other debt worse (e.g., missing tests make refactoring risky)

Present a prioritized action plan:
- **Fix now** — P0 items and quick-win P1s
- **Plan for next sprint** — remaining P1s and strategic P2s
- **Track for later** — P2s and P3s that aren't urgent

**After presenting the prioritized plan, grill the assessment:**

1. **Debt vs. design choice** — "Is this really debt, or is it a deliberate trade-off that still makes sense? What's the cost of NOT fixing it?"
2. **Root cause** — "Why did this debt accumulate? Is there a process issue (no code review? no testing requirement?) that will cause it to recur?"
3. **Impact accuracy** — "Am I right that this is P1? Has it actually caused bugs or slowdowns, or does it just look bad?"
4. **Effort accuracy** — "Is my effort estimate realistic? Are there hidden dependencies that make this harder than it looks?"
5. **Opportunity cost** — "If we spend a sprint on this, what feature work are we not doing? Is the trade-off worth it?"

Update the assessment and prioritization as new information surfaces.

### Phase 5: Wrap-Up

1. Summarize: top findings, recommended action plan, estimated total effort
2. Suggest next steps:
   - "Ready to start fixing?" → suggest the `refactor` skill for code changes
   - "Need to upgrade a dependency?" → suggest creating a task with `break-task`
   - "Want to document the decision?" → suggest the `create-adr` skill
   - "Need to address test gaps?" → suggest the `write-tests` skill
   - "Want a second opinion on specific code areas?" → suggest `code-review`
   - "Debt is causing active bugs?" → suggest `debug` or `report-bug`

## Constraints

- Present evidence, not opinions — every finding needs a specific code example
- Use P0-P3 severity consistently with other framework skills
- Don't conflate "different style" with "tech debt" — only flag things that materially affect maintainability, velocity, or risk
- Estimate effort realistically — don't minimize or maximize
- Acknowledge trade-offs — fixing debt has opportunity cost; make that visible
- This is the analysis skill — recommend `refactor` for execution
- Read the code and git history before asking questions — come with preliminary findings, not empty-handed
