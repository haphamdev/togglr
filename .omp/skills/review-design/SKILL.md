---
name: review-design
description: Review a technical design document and provide structured feedback
roles: [tech-lead]
trigger: User wants to review a technical design, critique an architecture proposal, or give design feedback
output-path: null
---

# Review Design

## When to use

- Reviewing a design doc before approving it
- Providing technical feedback on another team member's proposal
- Checking a design for completeness, feasibility, and risk

## Process

### Phase 1: Context Gathering

Read first, then ask only what you can't determine from the artifacts and codebase.

**Read these before engaging the user:**

1. **Read the design doc.** Ask for the file path, or list available designs in `docs/design/` for the user to pick. Read it thoroughly — every section, every diagram, every TODO.
2. **Read related artifacts.** Follow the `parent` field and any references in the design. Read related specs, stories, and ADRs. Understand what problem the design is trying to solve.
3. **Read the codebase.** Explore the code in the area this design covers. Understand the current implementation state — what exists, what patterns are used, what constraints are in play. This is essential for judging feasibility and consistency.

**Brainstorm from what you read:**

4. **Analyze the design.** Based on the design doc, artifacts, and codebase, identify:
   - Which review dimensions matter most for this design (a payment flow gets security and error handling emphasis; a UI layout change gets maintainability and consistency emphasis)
   - Potential issues spotted during reading — contradictions with existing code, missing error handling, scalability concerns
   - What's already well-handled — strengths to call out

**Present your analysis with a proposed focus:**

5. **Share and confirm.** Tell the user which dimensions you'll emphasize and why. Ask if there are specific concerns.

   Example: "This is a payment flow touching user data and an external gateway. I'll weight security, error handling, and operational concerns heavily. The codebase has a similar pattern at src/checkout/ — I'll check consistency against that. The design references ADR-007 for the retry strategy. Any specific areas you're worried about?"

**Design doc quality gate:**

6. **Check if there's enough to review.** If the design doc is a stub — all sections are TODOs or placeholders with no meaningful content — **stop:** "This design doc is mostly empty — there's not enough content to review meaningfully. I'd suggest completing it first with `create-design`."

### Phase 2: Review

Evaluate the design across 8 dimensions. **Adapt emphasis to the design** — a small internal feature gets lighter treatment on scalability and security, while a payment flow gets heavier treatment.

**Identify which dimensions matter most** for this design and note them to the user before starting: "This is a user-facing payment flow, so I'll weight security, error handling, and operational concerns heavily."

**1. Correctness**
- Does the design solve the problem stated in the spec/story?
- Does the proposed data model support all the required operations?
- Are the flows complete — do they handle all the use cases from the spec?

**2. Completeness**
- Are there missing pieces — components without interfaces, flows without error handling?
- Are all integration points defined?
- Does every section have meaningful content, or are there TODOs?

**3. Feasibility**
- Can this be built with the current tech stack and team skills?
- Is the scope achievable in the implied timeline?
- Are there dependencies on systems or teams that could block progress?

**4. Scalability**
- What breaks first if traffic/data doubles? 10x?
- Are there bottlenecks — single database, synchronous calls, unbounded queues?
- Is the data model designed for growth?

**5. Maintainability**
- Can this be changed later without major rework?
- Is it over-engineered — complexity without justification?
- Does it introduce new patterns when existing patterns would work?

**6. Security**
- What's the attack surface?
- Is authentication and authorization properly defined?
- Is sensitive data handled appropriately (encryption, access control, logging)?

**7. Consistency**
- Does it follow existing codebase patterns and conventions?
- Does it introduce a new way of doing things without good reason?
- Are naming conventions consistent with the rest of the system?

**8. Operational Concerns**
- How do we know this is working in production? What metrics, alerts?
- How do we debug issues? What's logged?
- How do we roll back if something goes wrong?
- What's the deployment strategy?

### Phase 3: Summary

Present findings in this structure:

```
## Design Review: {design title}

### Emphasis
{Which dimensions were weighted heavily for this review and why}

### Blocking Issues
(Must address before approving)

1. **[Dimension: Section]** — {issue description}
   Suggestion: {how to fix}

### Suggestions
(Would improve the design but not blocking)

1. **[Dimension: Section]** — {issue description}
   Suggestion: {how to fix}

### Strengths
(What's well done — reinforces quality patterns)

- {strength}

### Verdict
- APPROVE / NEEDS REVISION / MAJOR GAPS
- Key risks to monitor even if approved
```

**After presenting, grill each blocking issue:**

Walk through blocking issues one at a time:
- "This component has no error handling defined. What should happen when the external service returns a 500? Let's work through it."
- "The data model doesn't account for X. Is that intentional, or should we add a field for it?"
- Push for resolution on the spot where possible — suggest specific fixes

Continue until all blocking issues are resolved or explicitly deferred with documented rationale.

### Phase 4: Wrap-Up

1. Summarize what was resolved during the review
2. List remaining items that need further work
3. If the design passes review, suggest changing status to `approved`
4. Suggest next steps:
   - "Key decisions should be recorded" → suggest the `create-adr` skill
   - "Ready for implementation" → suggest the `break-task` skill
   - "Testability concerns surfaced?" → suggest `review-testability`
   - "Implementation patterns need cleanup first?" → suggest `refactor`

## Constraints

- This is a read-only advisory skill — do not modify the design doc directly
- Adapt emphasis to the design — don't apply all 8 dimensions equally to every design
- State which dimensions you're emphasizing and why
- Always reference specific sections when giving feedback
- Be concrete — "Component X has no retry logic for API calls to Service Y" not "error handling could be improved"
- Give strengths alongside issues
- Challenge assumptions about scalability, failure modes, and maintenance burden
- If the design is mostly good, say so — don't manufacture issues
