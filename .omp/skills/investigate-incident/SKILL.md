---
name: investigate-incident
description: Investigate a production incident — reconstruct timeline, find root cause, write blameless postmortem
roles: [software-developer, tech-lead]
trigger: User is dealing with an incident, outage, production issue, wants to do a root cause analysis, RCA, or write a postmortem
output-path: docs/postmortems/{kebab-name}.md
---

# Investigate Incident

## When to use

- A production incident occurred and needs investigation
- Writing a postmortem after an incident is resolved
- Performing root cause analysis on a recurring issue
- Documenting what happened for the team to learn from

## Process

### Phase 1: Context Gathering

Read first, then ask only what you can't determine from the codebase and git history.

**Read these before engaging the user:**

1. **Read existing postmortems.** Check `docs/postmortems/` for previous incidents — understand conventions, format, and any related past incidents that might share root causes.
2. **Check recent git history.** Look at recent deployments, merges, and config changes. Identify what changed recently — this is the most common incident trigger and answers the "was there a recent deployment?" question proactively.
3. **Read affected code.** If the user mentions a specific component, service, or error, read the relevant code to understand the system that failed.

**Present your findings with the first question:**

4. **Share and ask.** Present what you found from git history and past postmortems alongside your first questions — don't ask open-ended questions about what changed recently when you can check.

   Example: "I've checked git history — there were 2 deployments in the last 48 hours: v2.3.1 (merged PR #142, payment retry logic) at 14:30 yesterday, and a config change to rate limits this morning. There's one previous postmortem in docs/postmortems/ from the auth outage last month. Is this incident ongoing or resolved? And what's the current impact?"

**Then ask what you can't determine from the codebase, one at a time:**

5. **What happened?** "Describe the incident — what broke, when was it detected, who is affected, what's the severity?"
6. **Timeline?** "Walk me through the sequence of events — when was it first noticed, who investigated, what was tried, when was it mitigated?" Build the timeline as you go.
7. **Impact?** "How many users affected? For how long? Any data loss or financial impact? Was there customer communication?"
8. **Evidence?** "Do you have logs, monitoring dashboards, error messages, or alerts?" Read any available data.

**Ongoing incident gate:**

9. **Check if the incident is resolved.** If the incident is ongoing, **stop the postmortem flow:** "Let's focus on mitigation first. What's the current state, and what's been tried so far? We can do the full postmortem once the incident is resolved."

### Phase 2: Timeline Reconstruction

Build a precise timeline of events:

```
| Time | Event | Source |
|------|-------|--------|
| 14:30 | Deploy v2.3.1 to production | Deploy log |
| 14:45 | Error rate spikes to 15% | Monitoring alert |
| 14:50 | On-call engineer paged | PagerDuty |
| 15:10 | Root cause identified — DB migration timeout | Investigation |
| 15:20 | Rollback initiated | Deploy log |
| 15:25 | Error rate returns to baseline | Monitoring |
```

Fill in gaps by asking: "What happened between X and Y? Who did what?"

### Phase 3: Root Cause Analysis

Go beyond the proximate cause to find contributing factors:

**The 5 Whys approach:**
1. Why did the system fail? → The database migration timed out
2. Why did it time out? → The migration locked a table with 50M rows
3. Why wasn't this caught? → No migration review process for large tables
4. Why no review process? → Migration testing only runs on small datasets
5. Why small datasets? → Test environment has 1000 rows, production has 50M

**Identify contributing factors:**
- **Trigger** — What directly caused the incident?
- **Condition** — What pre-existing state made the incident possible?
- **Process gap** — What process, if it existed, would have prevented this?
- **Detection gap** — Why wasn't this caught earlier (in review, testing, monitoring)?

Present the root cause analysis clearly: "The trigger was X, but the underlying cause was Y, and it wasn't caught because Z."

### Phase 4: Postmortem Draft

Create the postmortem document using the output template. Follow blameless postmortem principles:

- **Focus on systems, not individuals** — "The deployment process didn't include X" not "Person A forgot to do X"
- **Be specific about impact** — numbers, duration, affected users
- **Include what went well** — rapid detection, effective communication, good incident response
- **Action items must be specific and assigned** — "Add migration review step to deploy checklist (owner: TL, due: next sprint)" not "Be more careful with migrations"

### Phase 5: Deepening (Grill the Postmortem)

After presenting the draft, grill it:

1. **Timeline completeness** — "Are there gaps in the timeline? What were people doing during the 20 minutes between detection and mitigation?"
2. **Root cause depth** — "Did we stop at the proximate cause or get to the systemic issue? Could this happen again in a different form?"
3. **Action items** — "Are the action items specific enough? Each one should have an owner, a due date, and a clear definition of done. Are we missing any?"
4. **Detection improvement** — "What monitoring or alerting would have caught this earlier? How much earlier?"
5. **Prevention** — "What would prevent this entire class of incident, not just this specific one?"
6. **Blamelessness check** — "Does the postmortem blame anyone? Rewrite any language that points fingers — focus on process and system improvements."

Update the postmortem as issues surface.

### Phase 6: Wrap-Up

1. Summarize: incident severity, root cause, number of action items
2. List action items with owners and due dates
3. Suggest next steps:
   - "Action items need tasks?" → suggest creating tasks with `break-task`
   - "Need an architecture change?" → suggest `create-design` or `create-adr`
   - "Need to fix the underlying code?" → suggest `debug` or `refactor`
   - "Need regression tests to prevent recurrence?" → suggest `write-tests`
   - "Root cause affects other areas?" → suggest `analyze-impact`
   - "Ready to share with the team?" → note the postmortem location

## Output Template

```markdown
---
title: "Postmortem: { Brief incident description }"
status: draft
owner: { Author name }
date: { YYYY-MM-DD }
severity: { P0 / P1 / P2 / P3 }
---

# Postmortem: { Brief incident description }

## Summary

{ One-paragraph description of the incident: what happened, impact, duration, resolution }

## Impact

- **Duration:** { start time — end time }
- **Users affected:** { count or percentage }
- **Data impact:** { none / describe data loss or corruption }
- **Financial impact:** { none / estimated cost }

## Timeline

| Time | Event |
|------|-------|
| { HH:MM } | { event } |

## Root Cause

{ Clear explanation of the root cause — what happened and why }

### Contributing Factors

- **Trigger:** { what directly caused the incident }
- **Condition:** { pre-existing state that made it possible }
- **Detection gap:** { why it wasn't caught earlier }

### 5 Whys

1. { Why 1 }
2. { Why 2 }
3. { Why 3 }
4. { Why 4 }
5. { Why 5 }

## What Went Well

- { effective response, good detection, clear communication, etc. }

## What Went Poorly

- { slow detection, unclear runbooks, missing monitoring, etc. }

## Action Items

| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | { specific action } | { name } | { date } | TODO |

## Lessons Learned

{ Key takeaways for the team }
```

## Constraints

- Always set status to `draft` on creation
- Blameless — focus on systems and processes, not individuals
- Action items must be specific, assigned, and have due dates
- Timeline must include sources (how we know this happened)
- Include "what went well" — incident response is a team effort and good work deserves recognition
- If the incident is ongoing, focus on mitigation first — suggest coming back for the full postmortem after resolution
- Check git history for recent deployments before asking about related changes — come with facts, not open-ended questions about what changed recently
