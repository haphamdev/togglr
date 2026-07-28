---
name: detail-requirements
description: Add detailed acceptance criteria, edge cases, and preconditions to user stories
roles: [business-analyst]
trigger: User wants to add acceptance criteria, detail requirements, explore edge cases, or enrich a story
output-path: tasks/stories/{existing-story}.md
---

# Detail Requirements

## When to use

- Enriching a user story with detailed acceptance criteria
- Discovering and documenting edge cases
- Adding preconditions, postconditions, and validation rules to a story

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the artifacts and codebase.

**Read these before engaging the BA:**

1. **Read the story.** Ask for the file path, or list stories in `tasks/stories/` for the user to pick. Read it thoroughly — understand every existing acceptance criterion the PM wrote.
2. **Read the parent epic and spec.** Follow the `parent` field. Understand the feature's goals, boundaries, and business context.
3. **Read business rules docs.** Check `docs/specs/` for formal business rules that should inform edge cases — boundary values, decision tables, validation rules.
4. **Read the codebase.** Find the implementation area and read existing validation logic, error handlers, database constraints, and guard clauses. These reveal edge cases that are already handled in code but not documented as formal acceptance criteria.
5. **Read similar features.** Search the codebase for precedents — how do similar features handle edge cases? This sets expectations for consistency.

**Brainstorm from what you read:**

6. **Analyze enrichment needs.** Based on the story, spec, business rules, and code, identify:
   - What the PM's AC covers (typically happy path) and what needs deepening
   - Edge cases already handled in the code but missing from the AC
   - Which edge case categories from Phase 2 are relevant to this story
   - Contradictions between the spec/rules and the existing code

**Present your analysis with proposals:**

7. **Share and confirm.** Present what you found and propose the focus areas — don't ask open-ended questions.

   Example: "I've read the payment story and its parent spec. The PM wrote 3 happy-path AC covering successful payment. The codebase at src/payments/validator.ts already validates card expiry, CVV format, and a $10 minimum — none of these are in the AC yet. The business rules doc specifies retry behavior for gateway timeouts. I see edge cases needed in: invalid input (card validation), partial failure (gateway timeout mid-charge), and boundary values ($10 minimum). Are there other areas you're concerned about?"

**Story quality gate:**

8. **Check if there are AC to enrich.** If the story has no PM-level acceptance criteria at all, **stop:** "This story has no acceptance criteria to enrich — not even a happy path. I'd suggest writing the story first with `write-story`, which creates PM-level AC, before adding BA-level detail."

### Phase 2: Edge Case Discovery (Context-Adaptive)

Read the story and identify which edge case categories are relevant. Do not apply every category to every story — adapt to what the story actually involves.

Start from what the code already handles — validation logic and error handlers in the implementation often reveal edge cases that should become formal acceptance criteria.

**Minimum floor (always ask these):**

1. **Invalid input** — "What happens if the user provides invalid data? Empty fields? Wrong format? Values out of range?"
2. **Permission/access** — "What happens if the user doesn't have permission? What if their session expires mid-flow?"
3. **Partial failure** — "What happens if the operation fails partway through? Is it atomic or can it leave things in a bad state?"

**Additional categories (apply when relevant to the story):**

- **Boundary values** — When the story involves numeric inputs, limits, or thresholds: "What are the minimum and maximum values? What happens at exactly the boundary?"
- **Concurrency** — When multiple users could act on the same resource: "What if two users edit this at the same time? What if the data changes between when the user loaded the page and when they submit?"
- **State transitions** — When an entity has a lifecycle: "What states can this be in? Which transitions are valid? What happens if someone tries an invalid transition?"
- **Data variations** — When the story handles different data types or formats: "What about unicode? Very long strings? Special characters? Different date formats?"
- **Downstream effects** — When the action triggers other processes: "What notifications are sent? What other data is updated? What happens to dependent records?"
- **Undo/recovery** — When the action is significant: "Can this be undone? What does rollback look like? Is there a soft delete?"
- **Multi-step flows** — When the story involves a multi-step user flow: "What happens if the user abandons mid-flow? Goes back to a previous step? Skips a step? Completes steps out of order? What state is preserved between steps?"

**For each edge case discovered, ask one at a time:**
- "What should happen in this case?" — Push for a specific, testable answer
- If the user doesn't know, flag it as an open question rather than guessing

### Phase 3: Drafting

Update the existing story file (do not create a new file). Add the new acceptance criteria below the PM's original criteria.

**Format for BA-added criteria:**

```markdown
## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC{N}: {Scenario name}
- **Given** {precondition/context}
- **When** {action or condition}
- **Then** {expected outcome}

### AC{N+1}: {Error scenario name}
- **Given** {precondition/context}
- **When** {invalid action or failure condition}
- **Then** {expected error handling behavior}
```

Keep the PM's original acceptance criteria section intact — add a new "Detailed Acceptance Criteria" section below it.

### Phase 4: Deepening (Grill the Enriched Story)

After adding the initial edge cases, walk back through the complete set of acceptance criteria (PM's originals + BA's additions) and grill:

1. **Completeness** — "Looking at the full set of criteria, are there scenarios we haven't covered? What would a creative user try that we haven't thought of?"
2. **Testability** — "Can each criterion be verified with a concrete test? If a criterion says 'handles gracefully,' what does graceful mean specifically?"
3. **Consistency** — "Do any of the new edge case criteria contradict the original acceptance criteria? Are there conflicts between error handling approaches?"
4. **Priority** — "Are all of these edge cases equally important? Are there any that could be deferred to a later iteration?"

Update the story file with refinements as answers come in.

### Phase 5: Wrap-Up

1. Summarize what was added to the story (count of new acceptance criteria)
2. List any open questions that need resolution
3. Flag if any edge cases surfaced that might affect other stories or the parent spec
4. Suggest next steps:
   - "This story is detailed enough for development" → suggest changing status to `approved`
   - "The edge cases suggest business rules that should be documented separately" → suggest the `define-business-rules` skill
   - "This story has grown too large" → suggest splitting
   - "Edge cases detailed enough for test cases?" → suggest `write-test-cases`
   - "Want to verify these criteria are testable?" → suggest `review-testability`

## Constraints

- Modify the existing story file — do not create a new file
- Keep PM's original acceptance criteria intact — add a separate section for BA enrichment
- Use Given/When/Then format for all new acceptance criteria
- Every criterion must be testable — if it's not, rewrite it until it is
- Flag requirements that are not testable and cannot be made testable
- Don't invent business rules — ask the user what the correct behavior should be
- Read existing code validations before discovering edge cases — don't ignore what's already implemented
