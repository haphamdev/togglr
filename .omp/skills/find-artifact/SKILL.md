---
name: find-artifact
description: Locate artifacts related to a topic, feature, or keyword
roles: [product-owner, product-manager, business-analyst, software-developer, qa, tech-lead]
trigger: User wants to find a spec, story, task, or artifact related to a topic
output-path: null
---

# Find Artifact

## When to use

- Looking for the spec, story, or design doc for a specific feature
- Finding all artifacts related to a topic
- Tracing the artifact chain from spec to implementation

## Process

### Phase 1: Understanding the Query

- What is the user looking for? A specific artifact or everything related to a topic?
- What type of artifact — spec, epic, story, task, design doc, test plan?
- Narrow down the search scope if possible

### Phase 2: Search

- Search across `docs/` and `tasks/` directories
- Match by file name, title in frontmatter, and content
- Follow `parent` links to show the traceability chain
- Present results with: file path, title, status, owner

### Phase 3: Presentation

- Show results grouped by type (specs, epics, stories, tasks, etc.)
- Highlight the traceability chain if one exists
- Suggest next actions based on what was found

## Constraints

- This is a read-only advisory skill — do not modify any files
- Search is best-effort — mention if areas were not searched
- Show status of each found artifact so the user knows where things stand
