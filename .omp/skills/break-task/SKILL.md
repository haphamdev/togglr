---
name: break-task
description: Break a user story into concrete implementation tasks
roles: [software-developer]
trigger: User wants to break down a story into tasks, create implementation tasks, or plan implementation
output-path: tasks/backlog/{kebab-name}.md
---

# Break Task

## When to use

- Breaking a user story into concrete implementation steps
- Planning the implementation approach before coding
- Creating trackable tasks from a story or design doc

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the developer:**

1. **Read the story.** Find and read the story from `tasks/stories/`. Understand the acceptance criteria — both PM-level and BA-enriched. Follow the `parent` frontmatter to the upstream spec if needed.
2. **Read the design doc.** Check `docs/design/` for a related design doc. Read it for architectural decisions, technical approach, and any constraints on implementation order.
3. **Read existing patterns.** Search the codebase for similar features already built. If the story adds a payment flow, find an existing flow. Read the pattern — this is what the tasks should follow.

**Brainstorm from what you read:**

4. **Propose an initial breakdown.** Based on the AC and codebase patterns, identify:
   - The distinct implementation steps needed to fulfill all acceptance criteria
   - The dependency chain — what must be built before what
   - What testing pattern similar features use in the codebase
   - Whether any AC seems too vague to break into concrete tasks

**Present your analysis with proposals:**

5. **Share the proposed breakdown and ask what you can't determine from reading.** Present the initial task list and dependency order. Then ask:
   - How familiar the developer is with this area (determines task granularity — see guidelines in Phase 2)
   - What level of testing is expected per task (unit, integration, both)

   Example: "I've read the checkout story and the design doc at docs/design/payment-flow.md. The codebase has a similar flow in src/api/checkout.ts — that's the pattern to follow. Based on the AC, I see 5 implementation steps: validation schema, endpoint handler, gateway integration, confirmation flow, and error handling. Before I size the tasks — how familiar are you with this part of the codebase? And should each task include both unit and integration tests?"

**Story quality gate:**

6. **Check AC clarity before breaking down.** If the story's acceptance criteria are vague or missing, **stop and suggest detailing them first:** "The story's acceptance criteria say 'user can make payments' but don't define error scenarios or edge cases. Breaking this into tasks now means guessing at scope. I'd suggest running `detail-requirements` to close these gaps first."

### Phase 2: Breakdown

Refine the proposed breakdown based on developer feedback from Phase 1.

**Apply granularity based on familiarity:**

**Coarse (very familiar — half-day to full-day chunks):**
```
Task 1: Implement payment validation endpoint
Task 2: Add payment processing integration
Task 3: Build payment confirmation flow
```

**Medium (somewhat familiar — 2-4 hour chunks):**
```
Task 1: Add PaymentRequest validation schema
Task 2: Implement POST /api/payments handler with gateway call
Task 3: Add error handling for payment failures
Task 4: Build payment confirmation flow
```

**Fine-grained (unfamiliar — 1-2 hour chunks with explicit guidance):**
```
Task 1: Add PaymentRequest validation schema (follow pattern in UserRequest schema)
Task 2: Write unit test for PaymentRequest validation
Task 3: Implement POST /api/payments handler
Task 4: Write integration test for payment endpoint
Task 5: Add error handling for payment gateway failures
Task 6: Wire up route in router config
```

**Process:**
1. Apply the granularity level to the proposed breakdown
2. For each task, note: what files are involved, what pattern to follow, what test to write
3. Present the final task list for confirmation — ask the developer to confirm, merge, or split
4. Once confirmed, create individual task files

**Each task should have:**
- A clear "done" state — how do you know it's complete?
- A verification step — a test to run, a build to check, or a behavior to confirm
- Enough context that someone could pick it up cold (especially at fine granularity)

### Phase 3: Deepening (Grill the Task List)

After creating the task files, walk through the list and grill:

1. **Coverage** — "Do these tasks cover all the acceptance criteria from the story? Let me map each AC to a task." Walk through the mapping explicitly.
2. **Dependencies** — "Are the tasks in the right order? Can any be parallelized? Is there a task that blocks everything else?"
3. **Missing pieces** — "Are there infrastructure tasks we forgot — migrations, config changes, environment variables? What about error handling and logging?"
4. **Testing** — "Does each task have a clear verification step? Are we testing at the right level?"
5. **Sizing** — "Does any task feel too large? If it would take more than a day (or a few hours at fine granularity), should we split it?"

Update the task files with refinements as answers come in.

### Phase 4: Wrap-Up

1. Summarize the task list with estimated sequence
2. Map each acceptance criterion to the task(s) that fulfill it
3. Suggest next steps:
   - "Ready to start implementing?" → suggest the `implement` skill with the first task
   - "Need a design decision first?" → suggest `create-design`
   - "AC needs more detail for some tasks?" → suggest `detail-requirements`

## Output Template

```markdown
---
title: {Task Title}
status: draft
owner: {Developer name}
date: {YYYY-MM-DD}
parent: stories/{parent-story-name}.md
sequence: {N}
---

# {Task Title}

## What

{Clear description of what to implement}

## Why

{Which acceptance criteria this fulfills — reference the story}

## How

{Implementation guidance — files to change, patterns to follow, key decisions}

## Verification

{How to confirm this task is done — test to run, behavior to check}

## Notes

{Any additional context, gotchas, or references to existing code}
```

## Constraints

- Always set status to `draft` on creation
- Always link to parent story via `parent` frontmatter field
- Each task should be independently completable and verifiable
- Include a verification step in every task
- Adapt granularity to developer familiarity — ask, don't assume
- Map every acceptance criterion to at least one task — nothing should be missed
- Don't break a story with vague acceptance criteria into tasks — if AC is unclear, suggest `detail-requirements` first
