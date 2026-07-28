---
name: create-adr
description: Record an architecture decision with context, options considered, and rationale
roles: [tech-lead]
trigger: User wants to record an architecture decision, write an ADR, or document a technical choice
output-path: docs/design/adr-{kebab-name}.md
---

# Create ADR

## When to use

- Recording a significant technical decision
- Documenting why a particular approach was chosen over alternatives
- Creating a reference for future developers who will ask "why did we do it this way?"

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the Tech Lead:**

1. **Read related design docs.** Many ADRs are triggered by design work. Find and read the design doc that prompted this decision — it often contains the alternatives and criteria already.
2. **Read existing ADRs.** Check `docs/design/adr-*` for related or potentially superseded decisions. If an existing ADR covers similar ground, the new one may need to reference or supersede it.
3. **Read related specs and stories.** Understand what problem or requirement prompted this decision. The context section of the ADR should trace back to a concrete need.

**Brainstorm from what you read:**

4. **Analyze the decision space.** Based on what was read, identify:
   - What the decision is actually about — push for precision ("sync vs async payment processing" not "architecture decision")
   - What alternatives seem to be in play — the design doc may already discuss options
   - Whether an existing ADR covers similar ground and might need superseding
   - What criteria seem most relevant based on the context (performance, simplicity, team expertise, cost, compliance)

**Present your analysis with proposals:**

5. **Share and confirm.** Present what you found and what you think the decision is about. Propose the alternatives and criteria you identified — don't ask open-ended questions.

   Example: "The design doc at docs/design/payment-flow.md discusses sync vs async processing but leaves it as an open question. I also found ADR-003 which decided on PostgreSQL for the data store — this new decision is related but separate. It looks like the key criteria are latency requirements and failure handling. What alternatives are on the table beyond sync and async?"

**Alternatives quality gate:**

6. **Check that real alternatives exist.** If after reading and discussion, only one alternative has been identified, push harder before proceeding to draft: "An ADR with one option is a rubber stamp, not a decision. What else was considered, even briefly? What would you do if this option weren't available?"

   The model should not proceed to drafting with fewer than 2 alternatives. If the Tech Lead insists there's truly only one option, document why the alternatives were non-starters — that's still valuable context.

### Phase 2: Drafting

1. Create the file at `docs/design/adr-{kebab-name}.md`
2. Use the Nygard format with Alternatives Considered section
3. Write the Context as value-neutral facts — forces at play, not opinions
4. Write the Decision in active voice: "We will..."
5. Write Consequences honestly — include both positive and negative
6. Keep to 1-2 pages. ADRs should be concise and scannable.

### Phase 3: Deepening (Grill the ADR)

After drafting, walk through each section and grill:

1. **Context** — "Are these all the forces at play? Is there a constraint we're not acknowledging? Is the context neutral, or are we biasing toward our preferred option?"
2. **Alternatives** — "For each rejected option: is the rejection reason fair? Would someone who preferred that option agree with why it was rejected? Are we strawmanning any alternatives?"
3. **Decision** — "Is the decision statement clear and specific? Would a new team member in 6 months understand exactly what was decided?"
4. **Consequences** — "What are the negative consequences? Every decision has trade-offs — if we only listed positives, we're not being honest. What's the cost of this decision? What becomes harder?"
5. **Reversal** — "How hard is this to reverse? If we're wrong, what's the migration path?"

Update the ADR with refined content as answers come in.

### Phase 4: Wrap-Up

1. Read back the decision statement and consequences for final confirmation
2. Suggest next steps:
   - "Ready for team review?" → suggest changing status to `proposed` (becomes `accepted` after review)
   - "Decision affects an existing design doc?" → suggest updating the design doc to reference this ADR
   - "Decision unblocks implementation?" → suggest `break-task` to plan the work
   - "Related to a design that needs review?" → suggest `review-design`

## Output Template

```markdown
---
title: {ADR Title}
status: proposed
owner: {Tech Lead name}
date: {YYYY-MM-DD}
parent: {path to related design doc or spec}
---

# ADR: {Decision Title}

## Status

Proposed

## Context

{Value-neutral description of the forces at play. What situation are we in? What requirement, problem, or trigger prompted this decision? What constraints exist?}

## Alternatives Considered

### {Option 1: Chosen Approach}
- **Approach:** {description}
- **Pros:** {advantages}
- **Cons:** {disadvantages}

### {Option 2}
- **Approach:** {description}
- **Pros:** {advantages}
- **Cons:** {disadvantages}
- **Rejected because:** {specific reason}

### {Option 3}
- **Approach:** {description}
- **Pros:** {advantages}
- **Cons:** {disadvantages}
- **Rejected because:** {specific reason}

## Decision

We will {decision in active voice}.

{Brief rationale linking back to the criteria and constraints from Context.}

## Consequences

### Positive
- {positive consequence}

### Negative
- {negative consequence or trade-off}

### Risks
- {risk and how we'll monitor or mitigate it}
```

## Constraints

- ADRs are immutable — if a decision changes, write a new ADR that supersedes the old one (update old ADR status to `superseded by: adr-{new-name}.md`)
- Always set status to `proposed` on creation (changes to `accepted` after team review)
- Link to related design doc or spec via `parent` frontmatter field
- Document ALL options considered, not just the winner
- Be honest about negative consequences — every decision has trade-offs
- Keep to 1-2 pages — concise and scannable
- Write Context as neutral facts, not arguments for the chosen option
