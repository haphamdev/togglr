---
name: write-docs
description: Write or update technical documentation — READMEs, runbooks, guides, architecture overviews
roles: [software-developer, tech-lead]
trigger: User wants to write documentation, document something, create a guide, write a runbook, update README, or create onboarding docs
output-path: docs/{kebab-name}.md
---

# Write Docs

## When to use

- Writing a README or project overview
- Creating a runbook for operational procedures
- Writing an onboarding guide for new team members
- Documenting architecture or system overview
- Creating API usage guides or integration instructions
- Updating existing documentation that's outdated

## Process

### Phase 1: Context Gathering

Read first, brainstorm second, ask only what you can't answer from the codebase.

**Read these before engaging the user:**

1. **Read existing documentation.** Check `docs/`, README files, and any inline documentation in the relevant area. Understand what already exists — what's current, what's outdated, what's missing.
2. **Read the code.** Understand what the system actually does, not just what it should do. Read configuration files, environment variables, setup scripts, and deployment configs.
3. **Read related artifacts.** Check for design docs in `docs/design/`, API contracts in `docs/api/`, and ADRs. These contain decisions and context that should inform the documentation.
4. **Check for gotchas.** Look for non-obvious requirements, common pitfalls, version-specific behavior, and things that break in unexpected ways. These are the most valuable things to document.

**Brainstorm from what you read:**

5. **Analyze the documentation gap.** Based on what exists and what the code does, identify:
   - What's missing entirely — undocumented systems, processes, or setup steps
   - What's outdated — docs that no longer match the code
   - Who the likely audience is — based on the subject matter and existing doc style
   - What format fits best — README, runbook, guide, overview (see format guidance in Phase 2)

**Present your analysis with proposals:**

6. **Share and confirm.** Present what you found and propose the documentation approach — don't ask open-ended questions. The user confirms, corrects, or adds to your proposals.

   Example: "I found a README that covers setup but stops at 'run the server' — it doesn't cover testing, deployment, or the worker process. There's also a design doc for the payment system but no runbook for payment failures. Based on the codebase, I'd suggest updating the README with testing and deployment sections first. Does this sound right, or is there something more urgent?"

**Documentation quality gate:**

7. **Check if the subject is documentable.** If any of the following are true, **stop and suggest the appropriate skill before writing docs:**
   - The system being documented doesn't exist yet → suggest `implement` or `create-design` first
   - The system is actively mid-redesign with pending design docs in `draft` status → suggest completing the design first, or scope the docs to what's stable
   - The code has no tests and the docs would include behavioral claims → flag that the documented behavior is unverified

   Explain what's blocking: "The payment gateway is being redesigned — the design doc is still in draft and the current code won't match what ships. I'd suggest either waiting for the design to stabilize, or scoping this doc to the parts that aren't changing (auth, logging, monitoring)."

### Phase 2: Draft

Write the documentation, adapting style to the audience and format.

**General principles:**
- **Start with why** — What is this, and why does the reader care?
- **Show, don't just tell** — Include code examples, commands, and expected output
- **Be specific** — Exact commands, exact file paths, exact config values. Not "set up the database" but "run `docker compose up -d postgres` and wait for the health check"
- **Assume nothing** — State prerequisites explicitly. Don't assume the reader knows which version of Node to use
- **Reference, don't copy** — Point to source files instead of copying code into docs. Copied code goes stale; a reference like "see `src/config/defaults.ts` for all available options" stays current

**Format-specific guidance:**

**README:**
- What is this project?
- How do I set it up? (step-by-step, copy-pasteable commands)
- How do I run it?
- How do I run tests?
- How do I deploy?
- Where do I go for help?

**Runbook:**
- When to use this procedure
- Prerequisites and access requirements
- Step-by-step instructions with exact commands
- Expected output at each step
- What to do if something goes wrong
- Who to escalate to

**Architecture overview:**
- System context — what does this system do and where does it fit?
- Key components and their responsibilities
- Data flow — how does data move through the system?
- Key decisions — why is it built this way? (reference ADRs if they exist)
- Diagrams (ASCII or Mermaid)

**Onboarding guide:**
- Environment setup (step-by-step)
- Key concepts and terminology
- Codebase tour — where to find things
- First task walkthrough
- Who to ask for what

### Phase 3: Verification

After drafting, do one thorough pass:

1. **Verify commands and paths** — Run every command in the doc. Check that every file path exists. Verify that environment variables are real and config values are correct. For runbooks, execute the full procedure if possible. Flag any command you can't verify.
2. **Newcomer test** — Read the doc as if you have no context. Could someone follow it start to finish without getting stuck? Are prerequisites stated? Are steps in the right order? Is anything assumed but not explained?
3. **Accuracy check** — Does the documentation match what the code actually does? Compare documented behavior against source code. Check that version numbers, dependency names, and API endpoints are current.
4. **Gotcha coverage** — Are the common mistakes and confusing parts called out? Are there warnings for things that silently fail or behave differently across environments?
5. **Staleness risk** — Which parts will go stale fastest? Replace copied code with references to source files. Replace hardcoded version numbers with instructions to check. Flag sections that need updating when specific files change.
6. **Cross-references** — Are there related docs that should link here? Should this doc link to design docs, ADRs, or API contracts? Update both directions.

Address issues as they surface — fix the doc, add missing steps, update commands.

### Phase 4: Wrap-Up

1. Summarize what was documented, target audience, and file location
2. Note any areas that couldn't be documented (missing access, unclear behavior, unverifiable commands)
3. Suggest next steps:
   - "Found gaps in the architecture?" → suggest the `create-design` skill
   - "API needs formal documentation?" → suggest the `define-api` skill
   - "Discovered decisions worth recording?" → suggest the `create-adr` skill
   - "Want to link this from the README or other docs?" → suggest where to add cross-references
   - "Related docs are outdated?" → offer to update them in the same session

## Constraints

- Read existing docs and code before writing — understand the current state first
- Verify commands and paths against the actual codebase — don't write docs with untested instructions
- Adapt depth and style to the audience — don't write a developer guide for ops, or vice versa
- Include exact commands with expected output — vague instructions are worse than no instructions
- State prerequisites explicitly — never assume "they'll know to do that"
- Prefer referencing code over copying it — copied code goes stale
- If updating existing docs, preserve the parts that are still accurate — don't rewrite from scratch unless needed
- Don't document systems that are actively being redesigned — scope to what's stable, or wait for the design to land
