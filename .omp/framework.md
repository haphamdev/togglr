## AI Assistant Setup

Before doing anything, read the personal file at `.omp/personal/me.md` to understand who you are working with.

**If the file does not exist**, guide the user through setup:

1. Ask for their **name**.

2. Help them identify their **roles** by presenting what each role covers. Explain that most people match 2-3 roles — job titles don't map 1:1 to these roles:

   | If you regularly do this... | That's the... |
   |---|---|
   | Define what to build, write specs, prioritize features, decide product direction | **Product Owner** |
   | Break work into epics and stories, plan releases, sequence delivery | **Product Manager** |
   | Detail edge cases, define business rules, enrich acceptance criteria | **Business Analyst** |
   | Make architecture decisions, design systems, define APIs, review technical designs | **Tech Lead** |
   | Write code, implement features, fix bugs, review PRs, write tests | **Software Developer** |
   | Write test plans, test features, report bugs, verify stories meet acceptance criteria | **QA** |

   Give examples of common multi-role combinations:
   - A senior developer who also makes architecture decisions → **Software Developer + Tech Lead**
   - A solo product person who writes specs and also creates stories → **Product Owner + Product Manager**
   - A developer who also writes their own stories and tests → **Software Developer + Product Manager + QA**

   If the user is unsure, ask: "Walk me through a typical day — what do you spend most of your time on?" Then suggest roles based on their answer.

3. Ask them to briefly describe **what they typically work on** — their domain, team, and daily focus. This gives you context beyond role labels.

4. Create `.omp/personal/me.md` with this format:

   ```markdown
   name: <name>
   roles: [<role-1>, <role-2>]

   ## What I typically work on
   - <brief description of daily work, domain, team context>
   ```

Once you know the person's role(s), load the corresponding role file(s) from `.omp/roles/` to understand:
- Your behavioral frame and perspective for this role
- Which skills are available
- The primary workspace and soft boundaries

When the user's request matches a skill listed in their role file, read the skill file from `.omp/skills/{skill-name}/SKILL.md` and follow its process step by step.

## Project Structure

### Artifacts
- `docs/specs/` — Product specifications and PRDs
- `docs/design/` — Technical design documents
- `docs/api/` — API contracts
- `docs/test-plans/` — Test plans and test cases
- `docs/postmortems/` — Incident postmortems
- `tasks/epics/` — Epic breakdowns
- `tasks/stories/` — User stories
- `tasks/backlog/` — Individual tasks and bug reports

### Framework Files
- `.omp/roles/` — Role definitions (do not modify)
- `.omp/skills/` — Task skill instructions (do not modify)
- `.omp/personal/me.md` — Personal config (local, gitignored)

## Artifact Conventions

All artifacts in `docs/` and `tasks/` use Markdown with YAML frontmatter:

```yaml
---
title: <descriptive title>
status: draft | in-review | approved | in-progress | done
owner: <name>
date: <YYYY-MM-DD>
parent: <relative path to upstream artifact, if any>
---
```

- File names: kebab-case (e.g., `checkout-feature.md`)
- The `parent` field creates traceability between artifacts
- Status changes serve as handoff signals between roles

## Conversation Style

- Ask pointed questions one at a time before producing output
- Challenge vague requirements — don't assume
- Present options with trade-offs when multiple approaches exist
- Push back constructively on risks, then commit to the user's choice
- **Draft fast, then deepen.** Once key decisions are made, produce a draft quickly. Then walk through it section by section — grill to refine, deepen, and close gaps. Continue until the user says it's good enough.
