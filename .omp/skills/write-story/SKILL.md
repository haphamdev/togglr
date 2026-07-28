---
name: write-story
description: Write user stories from an epic or spec with acceptance criteria
roles: [product-manager]
trigger: User wants to write a user story, break down an epic into stories, or create stories
output-path: tasks/stories/{kebab-name}.md
---

# Write Story

## When to use

- Breaking an epic into user stories
- Writing a standalone user story for a well-scoped piece of work
- Converting informal requirements into structured stories

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts.

**Read these before engaging the PM:**

1. **Read the parent epic or spec.** Find and read the parent file — understand the scope, business value, user flows, and acceptance criteria.
2. **Check for existing stories.** Look in `tasks/stories/` for stories already created for this epic. Understand what's been covered and avoid duplicating work.
3. **Read related design docs.** Check `docs/design/` for technical constraints that affect story boundaries — e.g., "the API must be built before the UI" forces story ordering.
4. **Read business rules docs.** Check `docs/specs/` for business rules that affect which stories need which acceptance criteria.

**Brainstorm from what you read:**

5. **Identify natural story boundaries.** Based on the epic's capabilities and user flows, identify:
   - Distinct user actions or capabilities that could be individual stories
   - How the story splitting heuristics apply (by flow steps, data variation, user role, operation)
   - Which stories have enough context for PM-level AC, and which will need BA enrichment
   - Dependencies between stories based on the design doc

**Present your analysis with proposals:**

6. **Share and confirm.** Present the story boundaries you identified and propose an initial list — don't ask open-ended questions. The PM confirms, corrects, or adds constraints.

   Example: "I've read the checkout epic and the design doc. I see 4 natural user stories: 'Add item to cart', 'Apply discount code', 'Submit payment', and 'View order confirmation'. The design doc says payment requires the cart API first, so that's the dependency order. Two existing stories cover cart basics — we'd be adding discount and payment. Should I write all 4, or focus on the new ones? And who's the primary user persona?"

**Epic quality gate:**

7. **Check if the epic supports story writing.** If the epic lacks business value or acceptance criteria, **stop:** "The epic has a title but no defined business value or acceptance criteria. Writing stories from a vague epic means guessing at scope. I'd suggest grilling the epic first — either revisit it with `create-epic` or add details."

### Phase 2: Drafting

Use the **hybrid format**: "As a..." for the story statement, Given/When/Then for acceptance criteria.

**For a single story:**
1. Write the story statement: "As a [user], I want to [action], so that [benefit]"
2. Write 2-4 core acceptance criteria covering the happy path in Given/When/Then format
3. Add a rough size estimate (S/M/L)
4. Create the file at `tasks/stories/{kebab-name}.md`

**For batch breakdown from an epic:**
1. Refine the proposed story list based on PM feedback from Phase 1
2. Present the final list with one-line "As a..." statements for confirmation
3. Once confirmed, create individual story files for each

**Story splitting heuristics** — if a story feels too large:
- Split by user flow steps (registration → verification → profile setup)
- Split by data variation (basic form → advanced fields → file upload)
- Split by user role (customer view → admin view)
- Split by operation (create → read → update → delete)

**PM vs BA split:**
- PM writes: the story statement, 2-4 happy-path acceptance criteria, size estimate
- BA adds later: edge cases, error states, business rules, boundary conditions
- Mark the story as ready for BA enrichment in the open questions

### Phase 3: Deepening (Grill Each Story)

After creating the initial story files, go through each story one at a time to refine and strengthen. The first pass captures the "what" — this pass makes sure the story is clear enough to estimate and implement.

**For each story, grill (one question at a time):**

1. **Story statement** — "Does 'As a [user], I want to [action], so that [benefit]' accurately capture the intent? Is the benefit the real reason, or is there a deeper motivation?"
2. **Acceptance criteria** — Walk through each Given/When/Then scenario: "Is this the right precondition? Is the expected outcome specific enough? What if the user does something slightly different?"
3. **Missing scenarios** — "Are there other happy-path scenarios we should capture at the PM level? What about the most obvious alternate path?" (Don't go into full edge cases — that's the BA's job, but catch the obvious ones.)
4. **Sizing** — "I estimated this as M. Does that feel right? If it feels too big, should we split it?"
5. **Dependencies** — "Can a developer pick this up without waiting on another story? Does it need a design decision first?"

**Update the story file** with refined content as answers come in.

**After all stories are reviewed, apply the INVEST checklist:**
- **I**ndependent — can be developed without depending on another story
- **N**egotiable — not an implementation contract, details can flex
- **V**aluable — delivers something meaningful to the user
- **E**stimable — team can reasonably estimate the effort
- **S**mall — completable within one sprint
- **T**estable — acceptance criteria are verifiable

Flag any story that fails INVEST and suggest how to fix it.

### Phase 4: Wrap-Up

1. Summarize the story set with sizes
2. Flag stories that still need BA enrichment
3. Suggest next steps:
   - "Want the BA to add detailed acceptance criteria?" → suggest the `detail-requirements` skill
   - "Ready to estimate and plan?" → suggest the `plan-release` skill
   - "Discovered complex business rules?" → suggest `define-business-rules`
   - "Stories need a technical design before implementation?" → suggest `create-design`

## Output Template

```markdown
---
title: {Story Title}
status: draft
owner: {PM name}
date: {YYYY-MM-DD}
parent: epics/{parent-epic-name}.md
size: {S|M|L}
---

# {Story Title}

## Story

As a {user persona}, I want to {action/capability}, so that {benefit/outcome}.

## Acceptance Criteria

### AC1: {Scenario name}
- **Given** {precondition/context}
- **When** {action the user takes}
- **Then** {expected outcome}

### AC2: {Scenario name}
- **Given** {precondition/context}
- **When** {action the user takes}
- **Then** {expected outcome}

## Notes

{Any additional context, assumptions, or design references}

## Open Questions

- [ ] {Unresolved question — e.g., "Edge cases to be detailed by BA"}
```

## Constraints

- Always set status to `draft` on creation
- Always link to parent epic via `parent` frontmatter field
- PM writes happy-path acceptance criteria only (2-4 per story) — BA enriches later
- Use Given/When/Then format for all acceptance criteria
- Stories should be small enough to complete in one sprint
- Name stories from the user's perspective ("Save payment method" not "Implement card storage API")
- Don't write stories from a vague epic — if the epic lacks business value or AC, suggest refining it first
