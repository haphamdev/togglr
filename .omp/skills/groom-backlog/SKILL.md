---
name: groom-backlog
description: Review and refine the existing backlog — flag stale, blocked, or oversized items and re-prioritize
roles: [product-owner, product-manager]
trigger: User wants to groom the backlog, refine backlog, review backlog, clean up backlog, check what's stale, or prepare items for sprint
output-path: null
---

# Groom Backlog

## When to use

- Regular backlog refinement sessions
- Preparing stories for an upcoming sprint
- Cleaning up after a priority shift or scope change
- Checking for stale or blocked items that need attention

## Process

### Phase 1: Context Gathering (Grill for Clarity)

Ask pointed questions one at a time:

1. **Scope?** Ask: "Full backlog review, or focused on a specific area — an epic, a milestone, or sprint-ready items only?"
2. **Current priorities?** Ask: "Have priorities shifted recently? Any new business context that affects what's important?"
3. **Team capacity?** Ask: "What's the team's capacity for the next iteration? How many stories can realistically be picked up?"
4. **Blockers?** Ask: "Are there any known blockers — waiting on design, waiting on dependencies, waiting on decisions?"

### Phase 2: Backlog Scan

Read all items in scope from `tasks/stories/`, `tasks/epics/`, and `tasks/backlog/`. For each item, assess:

**Staleness:**
- Is the date more than 4 weeks old with no status change?
- Does it reference artifacts or decisions that have since changed?
- Is it still relevant given current priorities?

**Readiness:**
- Are acceptance criteria clear and testable?
- Is there a design doc or technical approach defined (if needed)?
- Are dependencies resolved?
- Is it sized appropriately (not too large, not too vague)?

**Priority alignment:**
- Does the current priority still make sense given business context?
- Are there items that should move up or down?

Present findings as a summary table:

```
| Item | Status | Issue | Recommendation |
|------|--------|-------|----------------|
| stories/checkout-flow.md | draft | Stale (6 weeks), AC vague | Update AC or archive |
| stories/user-export.md | approved | Blocked on API design | Wait for TL or descope |
| backlog/fix-pagination.md | draft | Too large (multiple concerns) | Split into 2-3 tasks |
| stories/email-templates.md | draft | Ready | Move to approved |
```

### Phase 3: Deepening (Grill the Backlog)

Walk through the findings one at a time and grill:

1. **Stale items** — "This story has been in draft for 6 weeks. Is it still relevant? Should we update it, defer it, or remove it?"
2. **Blocked items** — "This is waiting on X. Is that blocker going to resolve soon? Should we descope the dependency and simplify?"
3. **Oversized items** — "This story covers too much ground. Can we split it? What's the minimum viable slice?"
4. **Priority challenges** — "This is marked high priority but hasn't moved. Is it really high priority, or has something changed? What's actually most important right now?"
5. **Sprint readiness** — For items being considered for the next sprint: "Is the AC clear enough for a developer to start? Is the design ready? Are all questions answered?"

Update frontmatter (status, priority) and content as decisions are made.

### Phase 4: Wrap-Up

1. Summarize changes made: items updated, archived, split, re-prioritized
2. List the sprint-ready items in recommended priority order
3. Flag items that need action from other roles:
   - "This story needs BA enrichment before it's ready" → suggest `detail-requirements`
   - "This needs a technical design" → suggest involving a Tech Lead
   - "This AC is untestable" → suggest `review-testability`
4. Note any items removed or archived

## Constraints

- This is a review-and-update skill — modifies existing artifacts, does not create new ones
- Always confirm before archiving or removing items — never delete without explicit agreement
- Update frontmatter fields (status, date) when changes are made
- Focus on actionability — every finding should have a clear recommendation
- Don't re-prioritize without the user's agreement — present the case, let them decide
