---
name: prioritize
description: Evaluate and rank features, epics, or work items by priority
roles: [product-owner]
trigger: User wants to prioritize, rank, compare, or decide what to build next
output-path: null
---

# Prioritize

## When to use

- Deciding what to build next from a set of options
- Ranking a backlog of features or epics
- Comparing two initiatives for relative priority

## Process

### Phase 1: Context Gathering (Grill for Clarity)

Ask pointed questions one at a time:

1. **What items?** Ask which features, epics, or specs are being prioritized. Read the relevant files from `docs/specs/` or `tasks/epics/`.
2. **What's the decision?** Are we picking one winner, ranking everything, or scoping a specific release?
3. **What constraints exist?** Deadlines, commitments, dependencies, team capacity.
4. **What matters most?** Ask what criteria the PO cares about — this determines which framework to suggest.

### Phase 2: Framework Selection

Based on the decision type, suggest the best-fit framework:

**Ranking a long backlog → RICE**
- Score each item: (Reach x Impact x Confidence) / Effort
- Reach: how many users/customers affected in a time period (number)
- Impact: how much it moves the needle per user (3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal)
- Confidence: how sure we are about estimates (100% = high, 80% = medium, 50% = low)
- Effort: person-months or story points (number)
- Walk through each item with the PO, asking for their estimates on each dimension

**Scoping a specific release → MoSCoW**
- Sort items into four buckets:
  - **Must have** — release is useless without these
  - **Should have** — important but not critical for launch
  - **Could have** — nice to include if time permits
  - **Won't have (this time)** — explicitly deferred
- Walk through each item: "Is this a must, should, could, or won't for this release?"

**Quick comparison of 2-3 options → Value vs Effort**
- Place each option on a 2x2 matrix:
  - High value, low effort → **Do first**
  - High value, high effort → **Plan carefully**
  - Low value, low effort → **Fill gaps**
  - Low value, high effort → **Avoid**
- Discuss each option: "How high is the value? How much effort is involved?"

If the PO already has a preferred framework, use that instead. Frameworks are lenses, not laws.

### Phase 3: Recommendation

Present results in a clear format:

**For RICE:**
```
## Priority Ranking

| Rank | Item | Reach | Impact | Confidence | Effort | RICE Score |
|------|------|-------|--------|------------|--------|------------|
| 1 | {name} | {R} | {I} | {C}% | {E} | {score} |
| 2 | ... | ... | ... | ... | ... | ... |

### Key Takeaways
- {Why #1 ranks highest}
- {Any close calls or surprises in the ranking}
- {Items where low confidence makes the ranking uncertain}
```

**For MoSCoW:**
```
## Release Scope: {release name}

### Must Have
- {item} — {why it's a must}

### Should Have
- {item} — {why it's important but not critical}

### Could Have
- {item} — {what we'd gain if time permits}

### Won't Have (This Time)
- {item} — {why it's deferred and when to revisit}
```

**For Value vs Effort:**
```
## Comparison: {options}

| Option | Value | Effort | Recommendation |
|--------|-------|--------|----------------|
| {A} | {High/Med/Low} | {High/Med/Low} | {Do first / Plan / Fill / Avoid} |

### Recommendation
{Which option to pursue and why}
```

**After presenting, grill the results:**

Don't stop at showing the ranking. Challenge the user's assumptions and dig deeper:
- "Does this ranking match your intuition? If not, which item feels wrong and why?"
- For items that scored close together: "X and Y are almost tied. What would tip the balance?"
- For low-confidence items: "You said confidence on X is 50%. What would we need to learn to increase that? Is it worth investigating before committing?"
- For surprising results: "X ranked higher than you expected — does the data tell a different story than your gut? Or did we mis-estimate a dimension?"
- Challenge if the user tries to change scores to get a desired outcome: "You want to raise Impact on X — what evidence supports that?"

Continue discussing until the user is confident in the final ranking or explicitly decides to override with judgment.

## Constraints

- This is an advisory skill — present recommendations, the PO makes the final call
- Always show the reasoning behind the ranking, not just the result
- Acknowledge uncertainty explicitly — "If confidence on X is actually lower, it drops to rank 3"
- Don't force-rank items that are genuinely incomparable — say so
- Challenge the PO if all items are "must have" — that means prioritization hasn't happened
