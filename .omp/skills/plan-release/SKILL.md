---
name: plan-release
description: Sequence epics and stories into milestone-based release plan
roles: [product-manager]
trigger: User wants to plan a release, sequence work, create a roadmap, or order deliverables
output-path: null
---

# Plan Release

## When to use

- Grouping epics or stories into named milestones/releases
- Sequencing work across multiple releases
- Deciding what goes into a specific release based on dependencies and value

## Process

### Phase 1: Context Gathering (Grill for Clarity)

Ask pointed questions one at a time:

1. **What's being planned?** Read the relevant epics and stories. Ask if we're planning the full roadmap or a specific release.
2. **Milestones?** Are there named releases or milestones already defined (v1.0, MVP, Phase 1)? Or should we propose them?
3. **Timeline?** Are there hard deadlines, external commitments, or launch windows?
4. **Dependencies?** Ask about cross-epic dependencies, external team dependencies, or third-party integrations that constrain ordering.
5. **Capacity?** What's the rough team capacity — how much can ship per milestone?

### Phase 2: Sequencing

**Step 1 — Map dependencies:**
- Read all epics/stories being planned
- Identify hard dependencies (B can't start until A is done)
- Identify soft dependencies (B is easier after A, but not strictly required)
- Identify external dependencies (waiting on another team, third-party API, etc.)

**Step 2 — Group into milestones:**
- Start with the highest-value, lowest-dependency items for the first milestone
- Group items that naturally ship together (same user flow, same feature area)
- Respect dependency chains — prerequisites go in earlier milestones
- Balance milestone sizes against team capacity

**Step 3 — Validate the sequence:**
- Each milestone should deliver tangible value on its own
- No milestone should be "just setup" with no user-facing outcome
- Dependencies should flow forward (Milestone 1 → 2 → 3), not backward
- Flag any milestone that's overloaded or has high risk

### Phase 3: Presentation

Present the release plan in this format:

```
## Release Plan: {initiative name}

### Milestone 1: {name} — {target date or "first"}
**Theme:** {one-sentence description of what ships}

| Item | Type | Size | Dependencies |
|------|------|------|-------------|
| {name} | Epic/Story | S/M/L | {none or dependency} |

**Value delivered:** {what users/stakeholders get after this milestone}
**Risks:** {what could delay this milestone}

### Milestone 2: {name} — {target date or "after M1"}
...

### Dependency Map
{ASCII or text description of the critical path}

### Risks & Assumptions
- {risk 1 and mitigation}
- {assumption that could change the plan}
```

**After presenting, grill the plan milestone by milestone:**

Don't stop at showing the plan. Walk through each milestone and challenge it:
- "Milestone 1 has these items. Is this achievable given team capacity? What would you cut if it's too much?"
- "The critical path goes through X. What happens if X is delayed? Do we have a fallback?"
- "Milestone 2 depends on Milestone 1 being fully done. Is that realistic, or should we decouple them?"
- "Are there items in later milestones that should move earlier because of external deadlines?"
- "What's the biggest risk to this plan? What would make you re-sequence everything?"

Continue iterating until the PM is confident in the plan or explicitly decides to proceed with known risks.

## Constraints

- This is an advisory skill — recommends sequencing, does not modify epic/story files
- Don't try to be a sprint planning tool — keep it at the milestone level
- Always surface dependency risks explicitly
- Flag items that are too large or too vague for reliable planning
- If there are too many unknowns for reliable planning, say so — recommend resolving unknowns first
- Challenge plans where every item is in Milestone 1 — that's not a plan, that's a wishlist
