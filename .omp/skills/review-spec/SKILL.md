---
name: review-spec
description: Review an existing product spec and provide structured feedback
roles: [product-owner]
trigger: User wants to review, critique, or give feedback on a product spec or PRD
output-path: null
---

# Review Spec

## When to use

- Reviewing a spec before approving it
- Providing feedback on a draft spec from another team member
- Checking a spec for completeness and clarity before handoff to PM

## Process

### Phase 1: Context Gathering

Read first, then ask only what you can't determine from the artifacts and codebase.

**Read these before engaging the user:**

1. **Read the spec.** Ask for the file path, or list available specs in `docs/specs/` for the user to pick. Read it thoroughly.
2. **Read parent artifacts.** Follow the `parent` field to any upstream artifact. Understand what prompted this spec.
3. **Read related specs.** Check `docs/specs/` for other specs in the same domain. Look for contradictions, overlap, or dependencies between them.
4. **Read business rules docs.** Check for business rules the spec references or should reference. Rules that aren't reflected in the spec are gaps.
5. **Read the codebase.** Explore the code in the area this spec covers. Understand what's already built vs. what the spec proposes — this reveals unstated assumptions, feasibility gaps, and potential conflicts with existing behavior.

**Brainstorm from what you read:**

6. **Analyze the spec.** Based on the spec, related artifacts, and codebase, identify:
   - Which review dimensions to emphasize — a spec for extending existing behavior gets heavier feasibility and consistency scrutiny
   - Potential gaps or contradictions spotted during reading
   - What looks solid — strengths to call out

**Present your analysis with a proposed focus:**

7. **Share and confirm.** Tell the user what you noticed and what you'll focus on. Ask if there are specific concerns.

   Example: "I've read the checkout spec and the related pricing rules doc. The spec proposes a new payment flow but doesn't mention the existing retry logic in src/payments/gateway.ts — that might conflict. I'll focus on completeness and feasibility. Any specific concerns?"

**Spec content quality gate:**

8. **Check if there's enough to review.** If the spec has no content beyond a title or stub, **stop:** "This spec is empty — there's nothing to review. Did you mean to write a spec? If so, the `write-spec` skill can help."

### Phase 2: Review

Evaluate the spec against four dimensions. For each issue found, note the section and classify it as **blocking** or **suggestion**.

**Completeness:**
- Does every section have meaningful content (not placeholders or TODOs)?
- Are success metrics defined and measurable (not just "improve X")?
- Is scope explicitly bounded — are non-goals stated?
- Are dependencies and risks identified?
- Is there at least one open question acknowledged?

**Clarity:**
- Can each requirement be interpreted only one way?
- Are there vague terms that need quantifying ("user-friendly", "fast", "easy", "seamless")?
- Would a developer know what to build from this alone?
- Are user flows concrete enough to trace step by step?

**Feasibility:**
- Are there unstated technical assumptions?
- Are dependencies realistic and identified?
- Is the scope achievable for the implied timeline?
- Are there requirements that might conflict with existing system behavior?

**Consistency:**
- Do goals and proposed solution actually align?
- Do user flows cover the scenarios implied by the problem statement?
- Any contradictions between sections?
- Does the scope match the problem statement (not too narrow, not too broad)?

### Phase 3: Summary

Present findings in this structure:

```
## Spec Review: {spec title}

### Blocking Issues
(Must fix before this spec can be approved)

1. **[Section Name]** — {issue description}
   Suggestion: {how to fix}

### Suggestions
(Would improve the spec but not blocking)

1. **[Section Name]** — {issue description}
   Suggestion: {how to fix}

### Strengths
(What's already good — reinforces quality patterns)

- {strength}

### Verdict
- APPROVE / NEEDS REVISION / MAJOR GAPS
```

**After presenting findings, grill each blocking issue:**

For each blocking issue, don't just list it — work through it with the user one at a time:
- "Section X has this gap. What's the answer? Let me help you figure it out."
- Push for resolution on the spot where possible
- If the user can resolve it now, suggest the updated wording
- If it genuinely needs more research, keep it as an open question

Continue until all blocking issues are either resolved or explicitly deferred.

### Phase 4: Wrap-Up

1. Summarize what was resolved during the review
2. List remaining blocking issues that need further work
3. If the spec passes review, suggest changing status to `approved`
4. Suggest next steps:
   - "Ready to break this into epics?" → suggest the `create-epic` skill
   - "Complex business rules need formal documentation?" → suggest `define-business-rules`
   - "Need a technical design?" → suggest `create-design`
   - "Want to check if requirements are testable?" → suggest `review-testability`

## Constraints

- This is a read-only advisory skill — do not modify the spec directly
- Always reference specific sections when giving feedback
- Be concrete — "Section X says 'fast response times' — what does fast mean? Under 200ms? Under 2 seconds?" not "some parts are vague"
- Give strengths alongside issues — don't make every review feel like a failure
- If the spec is mostly good, say so — don't manufacture issues
