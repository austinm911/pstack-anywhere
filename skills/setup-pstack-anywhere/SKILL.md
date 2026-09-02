---
name: setup-pstack-anywhere
description: Configure which tools and models pstack uses per role. Detects what this harness and machine actually have, then writes an override block your harness loads every session. Use for /setup-pstack-anywhere, "configure pstack", "pstack uses the wrong model", or telling pstack which review bot, UI driver, or slop-strip skill you use.
---

# Setup pstack anywhere

Write one override block that names your tool per role. The skills read it and
fall back to their absent path when a line is missing, so this is an override
layer, not a requirement. The pack works with no setup at all, it just verifies
less and asks more.

Read `../poteto-mode/capabilities.md` (every `../<skill>/` path in this pack is relative to this skill's own directory, so it names a sibling under the same skill root) first. It lists every role, what the
role does, and what happens when it has no value. This skill fills those slots.

## Where the block goes

Prefer the shared standard. `~/.agents/AGENTS.md` is one file that every harness
honoring the agents convention reads, so one write covers them instead of four
copies that drift. Write there when the harness reads it and nothing shadows it.

Two things stop that, and both are checkable.

**Shadowing.** A harness that keeps only one user-scope context file will drop
the shared one in favor of its own. OMP is the known case. Its native
`~/.omp/agent/AGENTS.md` has the highest discovery priority, only one user
context file survives across all providers, and the shared file loses. So on OMP
the block goes in `~/.omp/agent/RULES.md`, which is an always-apply rule rather
than a context file, does not compete in that dedup at all, and gets re-attached
near the current turn so it holds across a long session.

**No support.** Claude Code reads `~/.claude/CLAUDE.md` and has no agents-directory
convention, so it needs its own copy.

| harness | preferred target | why |
| --- | --- | --- |
| OMP | `~/.omp/agent/RULES.md` | sticky rule, and native `AGENTS.md` would shadow the shared file |
| Codex | `~/.agents/AGENTS.md`, else `~/.codex/AGENTS.md` | reads the shared standard |
| pi | `~/.agents/AGENTS.md`, else `~/.pi/agent/AGENTS.md` | reads the shared standard |
| Claude Code | `~/.claude/CLAUDE.md` | no agents-directory convention |
| Cursor | `~/.cursor/rules/pstack-models.mdc` with `alwaysApply: true` | upstream's original location |

Prove the shared file is loaded before relying on it. Write the block, start a
fresh session, and confirm the harness shows it in context. If you cannot confirm
it, use the harness-specific fallback in the table. A block the harness never
reads is worse than no block, because every role silently reverts to its absent
path while the file suggests otherwise.

Only role values belong here. Hooks, tool names, and subagent definitions are not
shareable, because the formats differ per harness. Claude Code and Codex use an
event map with a matcher and a shell command, in `settings.json` and `hooks.json`
respectively. pi takes an array of TS module paths in `settings.json`. OMP loads a
default-exported factory that registers handlers on a `HookAPI`. Nothing this
skill writes depends on a hook, and if that changes it needs four writers, not
one.

These files belong to the user and hold their own content. Never overwrite one.
Write only between the markers shown in step 5, and replace what is already
between them on a re-run. If the file does not exist, create it with the block
as its whole content.

Offer project scope only if the user asks. The project equivalents are
`.claude/CLAUDE.md`, `AGENTS.md`, and `.omp/RULES.md` at the repository root.

## Steps

### 1. Detect what this machine has

Roles divide by how you detect them.

**Models.** Enumerate the model identifiers you can pass to a delegate in this
session. That is the dependable source. If the harness exposes a model list
command, prefer it for completeness. If you cannot detect any, ask the user to
paste what they have. Never write a model you have not confirmed. The aliases
`inherit-parent` and `auto` are always valid and both mean the role runs on the
parent chat model, which is how Auto users stay on Auto.

**Skills.** For `slop_strip`, `ui_driver`, `cli_driver`, and `skill_authoring`,
read the skills this session discovered and look for one that does the job. Name
the candidate and let the user confirm, since a plausible name is not proof.

**Services and binaries.** For `review_automation`, ask. It is a GitHub-side
service and nothing in the session proves which one the user's repos run. Check
`gt`, `gh`, and `bun` on PATH and report which are missing, since each absence
removes playbooks.

### 2. Load current state

If the target file already holds a pstack block, read it and treat its values as
the current choices. Otherwise start from the defaults in step 5.

### 3. Map and confirm

Show every role with its current value, marking any value not in the detected
set as needing a choice. Ask whether to accept as-is or change specific roles.
Offer the detected values plus `inherit-parent` and `auto` for model roles, and
`none` for every role, which selects the absent path in `capabilities.md`.

Use your harness's structured question primitive where it has one, per the
`human_question` row in `capabilities.md`. Where it does not, ask in prose and
number the options.

For panel roles (how critics, arena runners, architect runners, interrogate
reviewers) the value is a list, and one delegate runs per entry, alias entries
included, so the list length sets the fan-out. `arena cross-judge pool` is also
a list, but Arena selects one value from it whose model family differs from the
parent's when possible. `swarm workers` is the default for every worker unless a
race or matrix names its own.

### 4. Validate

Every model written must be in the detected set. `inherit-parent`, `auto`, and
`none` always pass. If a chosen model is not available, stop and ask again. A
block pointing at a model the user cannot reach breaks every delegation that
reads it.

Never write a tool you did not detect or the user did not confirm. A wrong value
is worse than an absent one, because the absent path is honest and a wrong value
sends the agent after something that is not there.

### 5. Write the block

Replace everything between the markers. Keep the markers. Overwrite the whole
block so re-runs stay idempotent.

```
<!-- pstack-anywhere:begin -->
# pstack configuration. One line per role. Delete a line to fall back to the skill default.
# `none` selects the absent path in ../poteto-mode/capabilities.md.
# `inherit-parent` or `auto` on a model role: the role runs on the parent chat model.

## Tools
review automation: none
slop strip: none
ui driver: none
cli driver: none
skill authoring: none

## Models
feature, refactoring: auto
bug-fix: auto
perf-issue: auto
hillclimb: auto
judgment and prose: auto
hardest tasks: auto
how explorer: auto
how explainer: auto
how critics: auto, auto, auto
why investigators: auto
why synthesizer: auto
reflect tooling: auto
reflect judgment, divergent, synthesizer: auto
arena runners: auto, auto, auto
arena cross-judge pool: auto, auto, auto
swarm workers: auto
architect runners: auto, auto, auto
interrogate reviewers: auto, auto, auto
<!-- pstack-anywhere:end -->
```

Those are the defaults, not a recommendation. `auto` everywhere is the honest
starting point on a harness whose models you have not detected. Panel roles show
three entries because that is the smallest useful panel. Add entries to widen the
fan-out.

On Cursor, write the same body inside the `.mdc` frontmatter shape upstream used,
with `description` and `alwaysApply: true`, and drop the HTML markers since the
file is pstack's alone.

### 6. Confirm

Say which file you wrote, which roles are set, and which are `none` with what
that costs. Name any missing binary from step 1. State that the block applies to
new sessions.

### 7. Offer a verification skill

Check whether the project has a way to drive the real app for proof, a `verify-*`
skill or an existing harness. If not, offer once. "Want a project-local
verification skill, so agents can drive the app the way a user does and prove
changes work? I can generate one with /create-verification-skill." On yes, invoke
`/create-verification-skill`. On no, move on without pushing.

This offer matters more when `ui_driver` and `cli_driver` are `none`, because a
project-local verification skill is the only remaining path to runtime proof.
