---
name: analyze-impact
description: Analyze the impact of a change across existing artifacts and requirements
roles: [business-analyst]
trigger: User wants to understand the impact of a change, what a change affects, or cross-cutting concerns
output-path: null
---

# Analyze Impact

## When to use

- Evaluating how a proposed change affects existing features
- Understanding cross-cutting concerns before making a decision
- Identifying artifacts that need updating when requirements change

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts.

**Read these before engaging the BA:**

1. **Read the artifact being changed.** Ask for the file path, or find it from the user's description. Read it thoroughly — understand what it defines and what depends on it.
2. **Trace parent/child links.** Find all artifacts whose `parent` field points to the changed artifact. These are directly downstream.
3. **Search for content references.** Search `docs/` and `tasks/` for artifacts that mention the changed artifact by name, feature, or key terms.
4. **Find sibling artifacts.** Read the changed artifact's `parent` field and find other artifacts under the same parent — they share context and may be affected.

**Brainstorm from what you read:**

5. **Map the dependency network.** Based on the link trace, identify:
   - The artifact's downstream dependents (children via `parent` field)
   - Artifacts that reference it by content (mentions, shared terminology)
   - Siblings that share context and assumptions
   - The likely blast radius — how many artifacts are in the affected zone

**Present your analysis with proposals:**

6. **Share and confirm.** Present the dependency map and ask what's actually changing — don't ask open-ended questions.

   Example: "I've read the payment validation spec and traced its links. It's the parent of 3 stories (checkout-flow, refund-process, payment-retry), referenced in the test plan at docs/test-plans/payment-tests.md, and has a sibling spec for order-management. What specifically is changing about the payment validation, and what motivated the change?"

**Change clarity quality gate:**

7. **Check if the change is specific enough.** If the user's request is too vague to identify which artifact is changing, **stop:** "I need to know which artifact is changing to trace its impact. Can you point me to the spec, story, or design doc that's being modified — or describe the change specifically enough that I can find the relevant artifacts?"

### Phase 2: Analysis

Using the dependency map from Phase 1 and the user's description of what's changing, classify the impact on each affected artifact. Trace impacts through three channels:

**Direct links (via `parent` field):**
- Artifacts whose `parent` field points to the changed artifact
- These are directly affected — the change flows downstream

**Content references:**
- Artifacts that mention the changed artifact by name, feature, or key terms
- These may reference assumptions that are now invalid

**Sibling artifacts:**
- Other artifacts under the same parent
- These share context and may be affected by the change

**For each affected artifact, classify the impact:**

| Impact Level | Meaning | Action Needed |
|-------------|---------|---------------|
| **Direct** | This artifact references or depends on what changed | Must review and likely update |
| **Probable** | This artifact shares context and likely needs updating | Should review |
| **Possible** | This artifact touches the same area but may not be affected | Review if time permits |

### Phase 3: Report

Present findings in this format:

```
## Impact Analysis: {description of change}

### Change Summary
{What changed and why}

### Direct Impact (must review)

| Artifact | Type | Why Affected | What Likely Needs Updating |
|----------|------|-------------|---------------------------|
| {path} | {spec/epic/story/etc} | {relationship to change} | {specific sections or criteria} |

### Probable Impact (should review)

| Artifact | Type | Why Affected | What Likely Needs Updating |
|----------|------|-------------|---------------------------|
| {path} | {type} | {reason} | {what to check} |

### Possible Impact (review if time permits)

| Artifact | Type | Why Affected |
|----------|------|-------------|
| {path} | {type} | {reason} |

### Code Impact (for developer assessment)
{If the change likely affects implementation, note it here but do not analyze code.
E.g., "This business rule is likely implemented in code — a developer should assess the code impact."}

### Risks
- {risk of not updating artifact X}
- {cascading risk if change propagates further}

### Recommended Actions
1. {Update artifact X — specific section}
2. {Review artifact Y — check if assumption Z still holds}
3. {Involve developer to assess code impact}
```

**After presenting, grill the findings:**

Walk through each directly impacted artifact one at a time:
- "This story has acceptance criteria based on the old requirement. Should I suggest updated wording?"
- "This epic's scope section assumes X — does the change invalidate that?"
- "This test plan covers the old behavior — it needs updating. Want to flag it for QA?"

Continue until the user is satisfied with the coverage and has a clear action plan.

### Phase 4: Wrap-Up

1. Summarize total artifacts affected by level (direct / probable / possible)
2. List recommended actions in priority order
3. Flag if the change is large enough to warrant updating the parent spec
4. Suggest next steps:
   - "Want to update the affected stories now?" → work through them one by one
   - "This change affects business rules" → suggest the `define-business-rules` skill
   - "This change warrants recording the decision?" → suggest `create-adr`
   - "Affected stories need their AC updated?" → suggest `detail-requirements`
   - "The parent spec may need updating?" → suggest `review-spec`
   - "Code is likely affected" → suggest involving a developer

## Constraints

- This is a read-only advisory skill — do not modify any files unless the user explicitly asks
- Search within `docs/` and `tasks/` only — do not analyze source code
- Always distinguish between certain impacts and potential impacts
- If the change is likely implemented in code, flag it for developer assessment but don't attempt code analysis
- Be thorough — missing an affected artifact is worse than flagging one that turns out to be fine
- Read the artifact and trace its links before asking questions — come to the conversation with the dependency map, not empty-handed
