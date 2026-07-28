---
name: update-status
description: Change the status of an artifact in its frontmatter
roles: [product-owner, product-manager, business-analyst, software-developer, qa, tech-lead]
trigger: User wants to update status, mark something as done, move to in-review, change artifact state
output-path: null
---

# Update Status

## When to use

- Changing an artifact's status (draft, in-review, approved, in-progress, done)
- Marking work as complete
- Signaling a handoff to the next role

## Process

### Phase 1: Context Gathering

- Which artifact needs a status update? (read the file)
- What should the new status be?
- If the status transition seems unusual (e.g., draft → done, skipping in-review), confirm with the user

### Phase 2: Update

- Update the `status` field in the artifact's YAML frontmatter
- If moving to `done`, verify there are no unresolved open questions in the document
- If moving to `in-review`, suggest who should review

### Phase 3: Confirmation

- Confirm the change was made
- Suggest downstream actions (e.g., "This spec is now approved — ready to create epics?")

## Status Lifecycle

```
draft → in-review → approved → in-progress → done
```

## Constraints

- Soft enforcement — inform about unusual transitions but don't block
- Always read the current status before changing it
- Log the previous status in conversation for traceability
