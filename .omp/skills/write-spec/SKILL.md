---
name: write-spec
description: Create a product specification / PRD for a new feature or initiative
roles: [product-owner]
trigger: User wants to write, create, or draft a product spec, PRD, or feature definition
output-path: docs/specs/{kebab-name}.md
---

# Write Spec

## When to use

- Starting a new feature from scratch
- Formalizing a verbal decision into a written spec
- Translating a customer request or user issue into product requirements

## Process

### Phase 1: Context Gathering (Grill for Clarity)

Use a minimum-viable-understanding approach. Read what's available, ask the 3-4 most critical questions, then draft. Do not exhaustively question every section before writing — it's faster to react to a draft than to answer abstract questions.

**Read these before asking questions:**

1. **Read existing specs.** Check `docs/specs/` for related specs — understand what's already been spec'd for this area. Avoid contradictions or duplicating scope.
2. **Read the codebase.** Explore the code in the relevant area — understand what's already built. This is critical for "extend" or "improve" features vs. greenfield.
3. **Read related artifacts.** Check for business rules docs, design docs, or stories that provide context. If the PO mentions customer feedback or support tickets, read those too.

**Present reading findings alongside your first question:**

   Example: "Before we start — I found an existing spec at docs/specs/checkout-v1.md for the current checkout flow, and the codebase has a payment module at src/payments/. Are we extending that, or is this a replacement? Now — what specific problem does this new spec solve?"

**Must-ask questions (one at a time):**

4. **What problem does this solve?** Push for specifics — reject vague answers like "improve user experience." Ask for evidence: user complaints, data, customer quotes, support tickets.
5. **Who is affected and how?** Identify the target users/personas. How are they currently working around this problem?
6. **What does success look like?** Ask for measurable outcomes. If the PO says "users should find it easier," push: "How would we measure that? What metric moves?"
7. **What's explicitly out of scope?** This prevents scope creep later. If the PO hasn't thought about it, suggest boundaries based on what you've heard.

8. **Stakeholder input?** Ask: "Who else has input on this — sales, support, customers? What have they said?" Capture any existing feedback or data points.
9. **Competitive context?** Ask: "How do competitors or similar products solve this problem?" Skip if the reading already answered this.

**Problem clarity gate:**

If the PO can't articulate the problem beyond "we need this feature" or "a customer asked for it," push harder: "What evidence do we have that this is the right thing to build — user complaints, data, customer quotes? A spec without a clear problem statement becomes a solution looking for a problem." The problem should be stated, even if the hypothesis is unverified.

**Stop grilling when** you have enough to write a meaningful first draft. Flag remaining gaps as open questions in the document rather than blocking on them.

### Phase 2: Drafting

1. Create the file at `docs/specs/{kebab-name}.md`
2. Apply the output template below with YAML frontmatter
3. Fill every section with what you learned in Phase 1
4. For sections where you lack input, write your best inference and mark it with `[NEEDS INPUT]`
5. Always include at least 2-3 open questions at the end
6. Keep the spec under 10 pages if possible. If it's growing beyond that, suggest splitting into smaller specs

### Phase 3: Deepening (Grill the Draft)

The draft is the starting point, not the finish line. Now systematically walk through it section by section to refine, deepen, and close gaps. This is where the real value is — the draft makes the grilling productive because the user is reacting to something concrete.

**Section-by-section review (one at a time):**

1. **Problem Statement** — "I wrote that the problem is X. Is that accurate? Is there a deeper root cause? Are there other user segments affected that we haven't mentioned?"
2. **Target Users** — "I listed these personas. Am I missing anyone? Are there users who would be negatively affected by this change?"
3. **Goals & Metrics** — "Are these the right metrics? What's the current baseline? Is the target realistic? How will we measure this — do we have the instrumentation?"
4. **Non-Goals** — "Are there adjacent features people might assume are included? Anything we should explicitly call out as excluded to prevent scope creep?"
5. **Proposed Solution** — "Does this approach feel right? Are there alternative approaches we should consider? What concerns do you have about this direction?"
6. **User Flows** — "Walk me through this flow — does each step make sense? What happens if the user abandons mid-flow? Are there branching paths we haven't captured?"
7. **Dependencies & Risks** — "What could go wrong? Are there external dependencies we haven't listed? What's the biggest risk to this initiative?"
8. **Open Questions** — "Which of these open questions are the most critical to resolve before moving forward? Can we answer any of them right now?"

**For each section:**
- Ask one focused question at a time
- Challenge vague or incomplete answers — push for specifics
- Update the spec file with refined content as answers come in
- Move to the next section when the user is satisfied or explicitly defers

**Stop deepening when** the user indicates the spec is good enough for its current purpose (e.g., "this is ready for review" or "let's move on to epics"). Not every spec needs to be perfect before progressing — but every section should have been examined.

### Phase 4: Wrap-Up

1. Summarize what changed from the initial draft
2. List any remaining `[NEEDS INPUT]` markers or open questions
3. Suggest next steps:
   - "Ready for stakeholder review?" → suggest changing status to `in-review`
   - "Want to break this into epics?" → suggest the `create-epic` skill
   - "Need more detail on business rules?" → suggest `define-business-rules`
   - "Want another perspective on this spec?" → suggest `review-spec`

## Output Template

```markdown
---
title: { Feature Name }
status: draft
owner: { PO name }
date: { YYYY-MM-DD }
parent: { path to upstream artifact, if any }
---

# {Feature Name}

## Problem Statement

What problem are we solving? Who has this problem? What evidence do we have (data, user feedback, support tickets)?

## Target Users

Who specifically benefits from this? Describe the user personas or segments.

## Goals & Success Metrics

| Goal                  | Metric              | Target         |
| --------------------- | ------------------- | -------------- |
| {outcome description} | {measurable metric} | {target value} |

## Non-Goals / Out of Scope

What we are explicitly NOT doing in this initiative:

- {excluded item and why}

## Proposed Solution

High-level description of the approach. Focus on WHAT the user experiences, not HOW it's implemented technically.

### Key User Flows

1. {Primary flow: step-by-step from the user's perspective}
2. {Alternate flow, if any}

## Dependencies & Risks

| Dependency / Risk | Impact                           | Mitigation          |
| ----------------- | -------------------------------- | ------------------- |
| {item}            | {what happens if this blocks us} | {how we address it} |

## Open Questions

- [ ] {Unresolved question 1}
- [ ] {Unresolved question 2}
```

## Constraints

- Always set status to `draft` on creation
- Always include at least one open question — specs are never complete on first draft
- Link to parent artifact via `parent` frontmatter if this derives from something upstream
- Do NOT make technical implementation decisions — that's for Tech Lead
- Keep under 10 pages; suggest splitting if the spec grows too large
- Use concrete, testable language — reject vague terms like "user-friendly" or "fast"
