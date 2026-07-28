---
name: define-business-rules
description: Document validation rules, business logic, and data constraints
roles: [business-analyst]
trigger: User wants to define business rules, validation logic, data constraints, or decision tables
output-path: docs/specs/{kebab-name}-rules.md
---

# Define Business Rules

## When to use

- Documenting validation rules for a feature
- Defining complex business logic (discount calculations, eligibility criteria, etc.)
- Creating decision tables for conditional behavior
- Extracting business rules that were discovered during story enrichment

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the BA:**

1. **Read the related spec and stories.** Find the spec and stories for the domain area. Understand what behavior is expected and what rules are implied but not yet formalized.
2. **Read existing business rule docs.** Check `docs/specs/` for existing rule documents that might interact with, overlap, or contradict what's being defined.
3. **Read the codebase.** Search the code in the domain area for validation logic, conditionals, and constraints that are already implemented but not documented as formal rules. These are rules that exist in practice — they should be captured.

**Brainstorm from what you read:**

4. **Analyze the rule landscape.** Based on what was read, identify:
   - Rules already implicit in the code or mentioned in specs but not yet documented
   - Interactions with existing documented rules — overlaps, dependencies, potential conflicts
   - What inputs the rules operate on (based on code and spec reading)
   - Contradictions between what the code does and what the spec says

**Present your analysis with proposals:**

5. **Share what you found and ask what you can't determine from reading.** Present the rules you identified from the code and specs. Then ask:
   - Where the new rules come from — stakeholder decisions, regulatory requirements, existing system behavior, or newly discovered during story enrichment
   - What should happen when a rule is violated — block the action, warn, log, fallback

   Example: "I've read the checkout spec and found existing rules in docs/specs/pricing-rules.md. The codebase at src/validators/checkout.ts already enforces a $10 minimum order and validates card expiry — but these aren't documented as formal rules. The spec mentions a free shipping threshold but doesn't specify the exact amount. Are we formalizing the existing validations, adding new rules, or both? And where are the new rules coming from — stakeholder decisions or regulatory requirements?"

**Domain quality gate:**

6. **Check if the domain is clear enough to define rules.** If the domain is unclear or the spec is too vague to derive rules from, **stop:** "The spec mentions 'pricing logic' but doesn't describe any specific rules or conditions. I'd suggest writing the spec first with `write-spec`, or enriching the stories with `detail-requirements` to capture the actual business rules."

### Phase 2: Rule Documentation

Use **structured rules list** as the default format. Escalate to a **decision table** when a rule has 3+ interacting conditions.

**Structured rules list format:**

```markdown
### Rule {N}: {Rule Name}

- **When** {condition or trigger}
- **Then** {required action or outcome}
- **Otherwise** {fallback behavior when condition is not met}
- **Source:** {where this rule comes from — stakeholder, regulation, existing system}
```

**Decision table format** (use when 3+ conditions interact):

```markdown
### Rule {N}: {Rule Name}

| Condition A | Condition B | Condition C | Outcome |
|-------------|-------------|-------------|---------|
| Yes | Yes | Yes | {outcome 1} |
| Yes | Yes | No | {outcome 2} |
| Yes | No | Yes | {outcome 3} |
| Yes | No | No | {outcome 4} |
| No | Yes | Yes | {outcome 5} |
| No | Yes | No | {outcome 6} |
| No | No | Yes | {outcome 7} |
| No | No | No | {outcome 8} |
```

**When to escalate to a decision table:**
- 3+ conditions that interact to determine the outcome
- The user describes rules with multiple "if... and... but if..." branches
- You suspect there are condition combinations nobody has thought about — the table forces every combination to be addressed

**Process:**
1. List each rule using the structured format
2. For complex rules, propose a decision table and walk through each combination with the user: "When A is true but B is false and C is true — what should happen?"
3. Highlight any combination the user hasn't considered: "This combination isn't covered — what should the behavior be?"

### Phase 3: Deepening (Grill Each Rule)

After documenting the initial rules, walk through each one and grill:

1. **Boundaries** — "This rule says 'order over $50 gets free shipping.' What about exactly $50? Is that over or at-or-above?"
2. **Interactions** — "Does this rule override or combine with rule N? What wins when two rules conflict?"
3. **Exceptions** — "Are there cases where this rule should NOT apply? Admin overrides? Grace periods? Grandfathered users?"
4. **Temporal** — "Does this rule apply immediately? Is there a phase-in period? Does it apply to existing data or only new data?"
5. **Completeness** — For decision tables: "Every combination has an outcome. Do any of these outcomes feel wrong?"

Update the rules document with refinements as answers come in.

### Phase 4: Wrap-Up

1. Summarize the rules documented (count, complexity)
2. List any unresolved combinations or open questions
3. Flag any contradictions discovered between rules
4. Suggest next steps:
   - "These rules should be reflected in the acceptance criteria" → reference the related stories
   - "Rules should be reflected in test cases?" → suggest `write-test-cases`
   - "Rules need more detail in the stories?" → suggest `detail-requirements` to enrich the related stories
   - "This rule set is complex enough to warrant a technical design" → suggest `create-design`

## Output Template

```markdown
---
title: {Domain} Business Rules
status: draft
owner: {BA name}
date: {YYYY-MM-DD}
parent: {path to related spec or story}
---

# {Domain} Business Rules

## Context

Brief description of what these rules govern and why they exist.

## Rules

### Rule 1: {Rule Name}
- **When** {condition}
- **Then** {action}
- **Otherwise** {fallback}
- **Source:** {origin}

### Rule 2: {Rule Name}
(decision table if complex)

## Rule Interactions

How rules relate to each other. Which takes priority when rules conflict.

## Open Questions

- [ ] {Unresolved question}
```

## Constraints

- Always set status to `draft` on creation
- Link to parent spec or story via `parent` frontmatter field
- Every rule must be unambiguous and testable
- Flag contradictions between rules explicitly — don't silently pick one
- When using decision tables, every combination must have an explicit outcome — no blank cells
- Don't invent rules — ask the user for the correct behavior
- Read existing code validations before documenting rules — don't ignore what's already implemented
