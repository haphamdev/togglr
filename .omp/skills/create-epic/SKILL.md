---
name: create-epic
description: Break a product spec or initiative into scoped epics
roles: [product-manager]
trigger: User wants to break a spec into epics, plan delivery increments, or create an epic
output-path: tasks/epics/{kebab-name}.md
---

# Create Epic

## When to use

- Breaking a product spec into deliverable chunks
- Creating a new epic for a well-defined initiative
- Structuring work for phased delivery

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts.

**Read these before engaging the PM:**

1. **Read the parent spec.** Find the spec in `docs/specs/`. Read it thoroughly — understand the problem, goals, proposed solution, and user flows.
2. **Check for existing epics.** Look in `tasks/epics/` for epics that might already cover parts of this spec. Understand what work has already been scoped.
3. **Read related design docs.** Check `docs/design/` for technical context that affects how work should be divided — integration points, shared components, or technical dependencies that might force epic boundaries.

**Brainstorm from what you read:**

4. **Identify natural epic boundaries.** Based on the spec's user flows and capabilities, identify:
   - Distinct business capabilities that deliver standalone value
   - Apparent dependencies between capabilities (what must be built before what)
   - Whether the spec is too small for multiple epics or too vague to break down
   - Areas where existing epics already cover part of the scope

**Present your analysis with proposals:**

5. **Share and confirm.** Present the natural boundaries you identified and propose an initial breakdown — don't ask open-ended questions. The PM confirms, corrects, or adds constraints.

   Example: "I've read the checkout spec. I see 4 natural capability boundaries: cart management, payment processing, order confirmation, and email notifications. Cart and payment have a hard dependency (cart must exist before payment), but confirmation and email could ship independently. The spec has clear user flows for the first three but email notifications are described in one sentence — that might need more detail. Does this breakdown direction look right? Any delivery constraints or timeline pressure?"

**Spec quality gate:**

6. **Check if the spec supports breakdown.** If any of the following are true, **stop and suggest refining the spec first:**
   - The spec lacks clear user flows or acceptance criteria
   - The spec is a single paragraph of intent without concrete scope
   - Key business rules are undefined ("pricing TBD", "rules to be confirmed")

   Explain what's missing: "The spec describes the goal but doesn't define user flows or acceptance criteria. Breaking this into epics now means guessing at scope boundaries. I'd suggest fleshing out the spec with the `write-spec` skill first."

### Phase 2: Breakdown

Break the spec into epics by **business capability** — each epic should deliver standalone value to users or stakeholders. Avoid breaking by technical layer (frontend/backend/database).

**Heuristics for good epic boundaries:**
- Each epic delivers something a stakeholder can see, use, or verify
- Each epic can be described in one sentence without using "and"
- Each epic could theoretically ship without the others (even if we wouldn't)
- Each epic is roughly 3-8 user stories in size

**Process:**
1. Refine the proposed epic list based on PM feedback from Phase 1
2. For each epic, note: what value it delivers independently, dependencies on other epics
3. Ask the PM to confirm, merge, or split the proposed epics
4. Once confirmed, create individual epic files

### Phase 3: Deepening (Grill Each Epic)

After creating the initial epic files, go through each epic one at a time to deepen and clarify. The first pass captures structure — this pass ensures each epic is solid enough to break into stories.

**For each epic, grill (one question at a time):**

1. **Business Value** — "I wrote that this epic delivers X. Is that the right framing? Who specifically benefits and how would they describe the value?"
2. **Scope boundaries** — "Is everything in the Included list actually needed? Anything missing? Are the Excluded items correct — or should any of them actually be in scope?"
3. **Dependencies** — "Does this epic depend on anything from another epic, another team, or an external system? Can it truly ship independently?"
4. **Acceptance criteria** — "What must be true for you to consider this epic done? How would you verify it?"
5. **Sizing sanity check** — "Does this feel like 3-8 stories worth of work? If it feels bigger, should we split it? If smaller, should it merge with another epic?"

**Update the epic file** with refined content as answers come in. Move to the next epic when the user is satisfied.

**After all epics are reviewed:**
- Verify the full set covers the entire spec scope — "Is there anything from the spec that didn't land in any epic?"
- Check for gaps between epics — "Is there work that falls between two epics but isn't clearly owned by either?"
- Suggest a delivery sequence based on dependencies and value

### Phase 4: Wrap-Up

1. Summarize the final epic breakdown
2. Flag any remaining open questions across epics
3. Suggest next steps:
   - "Ready to write stories for an epic?" → suggest the `write-story` skill
   - "Want to sequence these into a release?" → suggest the `plan-release` skill
   - "Discovered technical risks during breakdown?" → suggest `create-design` for areas needing design work before implementation
   - "Need to align on priorities?" → suggest `prioritize` to sequence by value

## Output Template

```markdown
---
title: {Epic Name}
status: draft
owner: {PM name}
date: {YYYY-MM-DD}
parent: specs/{parent-spec-name}.md
---

# {Epic Name}

## Business Value

What does this epic deliver? Why does it matter independently?

## Scope

### Included
- {capability 1}
- {capability 2}

### Excluded
- {explicitly excluded from this epic}

## Dependencies

- {dependency on other epics, external systems, or teams}

## Acceptance Criteria (Epic-Level)

What must be true for this epic to be considered complete?
- {criterion 1}
- {criterion 2}

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] {Unresolved question}
```

## Constraints

- Always set status to `draft` on creation
- Always link to parent spec via `parent` frontmatter field
- Name epics by what they deliver, not by technical component ("User Payment Flow" not "Payment API")
- Each epic should be independently deliverable where possible
- If the spec is too small for multiple epics, say so — not everything needs an epic layer
- Don't break a vague spec into vague epics — if the spec lacks clear user flows, suggest refining it first
