<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->

# Portability report

Built from `coupling.yaml`, the current skill files, and the evidence under
`conformance/scenarios.yaml`, `evidence/attestations.yaml`, `evidence/runs`. Every number below is
counted on each run rather than asserted in prose.

Three units run through the report. A **domain** is one axis, or for a parameter
set one axis plus one parameter, which is why 21 axes make 24 domains. A
**cell** is one domain on one harness, so the matrix is 120 cells. An
**occurrence** is one domain in one file, and its status column reads:

- `resolved`: no coupling token remains in the file.
- `unresolved`: a coupling token is still there.
- `missing`: the declared file is gone, so the ledger is stale.
- `not checked`: the file is outside `lint.scan` or whole-file allowlisted, so no check reads it.

A cell has no status. It carries a verification instead, which is the strongest
saved evidence for it:

- `exercised`: a complete run against the scenario, an attestation, and matching file digests. Counts as verified.
- `observed_local`: one machine on one day, which never counts as verified.
- `static`: a citation into a file in this repo that still matches its digest. Counts as verified.
- `stale`: the cited file moved, so a human has to look again.
- `superseded`: a later record replaced it; it stays readable and counts for nothing.
- `unverified`: no saved evidence covers the cell.
- `void`: the grounding does not hold, so the record counts for nothing.

## Totals

| measure | value |
| --- | --- |
| ledger | v2, upstream `b9ddc83` |
| domains | 24, from 21 axes, because `worker_defaults` resolves per parameter |
| harness cells | 0 verified of 120 (24 domains x 5 harnesses) |
| occurrences | 67 resolved, 25 unresolved, 0 missing, 2 not checked |
| token hits | 53 attributed to a domain, 21 unattributed Cursor mentions, 74 in total |
| skills reached | 2 of 45: `poteto-mode` (67 of 68 checked), `setup-pstack-anywhere` (0 of 1 checked) |
| skills with work left | 13 of 45; the other 30 carry neither a declared occurrence nor a token hit |
| regressions | 0 |
| `frontmatter_portable` assert | 39 of 45 skills carry `disable-model-invocation`, counted from the tree on every run |

## Work remaining

53 token hits carry a domain and collapse into 25 unresolved occurrences, one per file and domain. 21 hits name Cursor in prose with no domain to resolve into, across 13 files. That is 74 diagnostics in total, and not one of them lands in a skill the port already reached, so not one is a regression. 2 further declarations sit inside skills the port reached, as every declaration does, but no check reads their files, so they yield no diagnostic either way and the count above neither covers nor clears them.

Attributed work, one row per file and domain:

| file | domain | reason | lines |
| --- | --- | --- | --- |
| `skills/architect/SKILL.md` | `model_roles` | model slugs are role slots | 33 |
| `skills/arena/SKILL.md` | `model_roles` | model slugs are role slots | 28, 41 |
| `skills/arena/SKILL.md` | `worker_defaults.background` | run_in_background is the worker_defaults background parameter | 33 |
| `skills/automate-me/SKILL.md` | `human_question` | AskQuestion is Cursor's human_question primitive | 17, 44 |
| `skills/automate-me/SKILL.md` | `skill_authoring` | create-skill is the skill_authoring role | 3, 11, 67, 72, 77, 96, 102, 109 |
| `skills/automate-me/SKILL.md` | `transcript_dir` | agent-transcripts is the transcript_dir path assumption | 29 |
| `skills/how/SKILL.md` | `model_roles` | model slugs are role slots | 48, 67, 79, 112 |
| `skills/how/SKILL.md` | `worker_defaults.identity` | subagent_type is the worker_defaults identity parameter | 47, 66, 78, 115 |
| `skills/interrogate/SKILL.md` | `model_roles` | model slugs are role slots | 40, 41, 42, 43 |
| `skills/interrogate/SKILL.md` | `worker_defaults.identity` | subagent_type is the worker_defaults identity parameter | 46 |
| `skills/no-comments/SKILL.md` | `worker_defaults.identity` | subagent_type is the worker_defaults identity parameter | 19 |
| `skills/recall/SKILL.md` | `transcript_dir` | agent-transcripts is the transcript_dir path assumption | 15 |
| `skills/reflect/references/synthesizer.md` | `review_automation` | review_automation is a role, not a vendor | 27 |
| `skills/reflect/references/synthesizer.md` | `skill_authoring` | create-skill is the skill_authoring role | 17, 44 |
| `skills/reflect/SKILL.md` | `model_roles` | model slugs are role slots | 41, 42, 43, 49 |
| `skills/reflect/SKILL.md` | `skill_authoring` | create-skill is the skill_authoring role | 64, 65, 66 |
| `skills/reflect/SKILL.md` | `transcript_dir` | agent-transcripts is the transcript_dir path assumption | 25, 28 |
| `skills/reflect/SKILL.md` | `worker_defaults.identity` | subagent_type is the worker_defaults identity parameter | 37, 49 |
| `skills/show-me-your-work/SKILL.md` | `transcript_dir` | agent-transcripts is the transcript_dir path assumption | 56 |
| `skills/swarm/SKILL.md` | `model_roles` | model slugs are role slots | 25 |
| `skills/swarm/SKILL.md` | `spawn_worker` | a cloud worker couples spawn_worker and worker_durability | 30 |
| `skills/swarm/SKILL.md` | `worker_defaults.background`, `worker_defaults.identity` | run_in_background is the worker_defaults background parameter; subagent_type is the worker_defaults identity parameter | 30 |
| `skills/swarm/SKILL.md` | `worker_durability` | a cloud worker couples spawn_worker and worker_durability | 30 |
| `skills/why/SKILL.md` | `model_roles` | model slugs are role slots | 120, 166 |
| `skills/why/SKILL.md` | `worker_defaults.identity` | subagent_type is the worker_defaults identity parameter | 119, 165 |

Unattributed Cursor mentions. Each is either a legitimate reference to the Cursor column or a coupling that needs an axis to own it:

| file | lines |
| --- | --- |
| `skills/arena/SKILL.md` | 28, 41 |
| `skills/automate-me/SKILL.md` | 11, 17, 29, 67, 69, 109 |
| `skills/create-verification-skill/SKILL.md` | 9, 25 |
| `skills/interrogate/SKILL.md` | 36 |
| `skills/maintain-verification-skill/SKILL.md` | 25 |
| `skills/recall/SKILL.md` | 15 |
| `skills/reflect/references/divergent-reviewer.md` | 23 |
| `skills/reflect/references/judgment-reviewer.md` | 22 |
| `skills/reflect/references/tooling-reviewer.md` | 37 |
| `skills/reflect/SKILL.md` | 25, 64 |
| `skills/show-me-your-work/SKILL.md` | 56 |
| `skills/swarm/SKILL.md` | 25 |
| `skills/why/SKILL.md` | 100 |

Declared occurrences no check reads. These are the only claims in the ledger the lint cannot confirm or contradict:

| file | domain | status | why |
| --- | --- | --- | --- |
| `skills/poteto-mode/scripts/check-plan.mjs` | `model_roles` | not checked | Not Markdown, so lint.scan never reaches it, and its directory is allowlisted for the shell -gt comparisons in its siblings. It is not checked rather than resolved. |
| `skills/setup-pstack-anywhere/SKILL.md` | `model_roles` | not checked | Allowlisted whole-file in lint.allowlist, because it names the Cursor rule-file location on purpose. The lint therefore never reads it, so this occurrence is not checked rather than resolved. |

Next:

- 4 of the 25 rows name a domain that resolves the same way on every harness. Replace the token with that resolution from [Domain resolutions](#domain-resolutions).
- 10 rows name a domain whose resolution differs per harness, and a SKILL.md is harness-neutral, so there is no single string to substitute. Carry the domain's whole row from [Domain resolutions](#domain-resolutions) as harness-conditional prose rather than picking one column.
- 11 rows name a role. Name the role in the prose and leave its value to the override file `/setup-pstack-anywhere` writes; the row's no-value fallback is what the prose says when the role has none.
- Decide each of the 21 Cursor mentions: keep it, or give the coupling an axis in `coupling.yaml` so the lint can attribute it.
- Bring the 2 unchecked occurrences inside `lint.scan`, or retire them from the ledger.
- Run `bun scripts/coupling.mjs check` as the gate. Cells earn a verification through `probe list`, `probe prepare <scenario> <harness>`, and `probe inspect <run-id>`; none of those drive a harness or write an attestation.

## Domain resolutions

9 domains of 24 resolve differently depending on the harness. Each cell reads `parity, replacement`, and an `extension` cell adds `, else <fallback>` after the replacement for when the tool is not installed. Every cell in the matrix is `unverified`. Cursor is the upstream column: its resolutions are what upstream already does, not a substitution this port made.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `spawn_worker` (capability) | native, Task with environment: "cloud" | substitute, Task tool, subagent_type | substitute, task tool | extension, a task tool an extension registers, else do the work inline, sequentially, and say no worker ran | substitute, task tool, agent field selects the specialist |
| `worker_durability` (capability) | native, cloud agents run off-machine and survive a restart | drop, subagents die with the session | drop, subagents die with the session | drop, subagents die with the session | drop, subagents die with the session |
| `probe_worker` (capability) | native, dashboard shows agent state without a resume | degrade, job status only, no liveness for every delegate kind | degrade, job status only | extension, the job status the task extension exposes, else none, wait for the result | substitute, hub op:"jobs" |
| `wake_on_event` (capability) | native, /loop built-in | degrade, heartbeat sized to when the result is worth re-checking | degrade, heartbeat sized to when the result is worth re-checking | degrade, heartbeat sized to when the result is worth re-checking | substitute, hub op:"wait" |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true | substitute, run in background | substitute, async | substitute, async | substitute, async, or hub op:"wait" to block |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP | substitute, read-only agent type | substitute, read-only agent type | substitute, read-only agent type | substitute, scout agent is read-only |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent" | substitute, a poteto-agent definition in the harness subagent dir | substitute, a poteto-agent definition in the harness subagent dir | extension, a poteto-agent definition where the extension reads its agents, else no identity, the parent model does the work | substitute, a poteto-agent definition in the harness subagent dir |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role | substitute, role slots | substitute, role slots | substitute, role slots | substitute, role slots, or the agent field |
| `human_question` (capability) | native, AskQuestion | substitute, the ask tool | substitute, request_user_input tool, root thread only, mode-gated | extension, an ask tool an extension registers via registerTool, else a plain question in the reply | substitute, the ask tool |

The other 15 domains resolve the same way on every harness:

- **`review_automation`** (role, substitute). An agentic reviewer that files PR comments. A GitHub-side service, not a harness feature, so it is the user's choice on every harness including Cursor. references/bugbot-triage.md generalizes to review-automation triage: its content is how to assess untrusted review text, which no harness changes. With no value for the role: Apply the same skeptical triage to human review comments. The posture is the portable part.
- **`slop_strip`** (role, substitute). A pre-commit pass that strips generated slop from a diff. With no value for the role: Apply the unslop skill to the diff directly.
- **`ui_driver`** (role, substitute). Drives a browser, Electron, or web UI for runtime verification. With no value for the role: Runtime UI verification is not available. Say so in the verification block rather than claiming a pass; a verdict of type-check-only is honest.
- **`cli_driver`** (role, substitute). Drives a CLI or TUI for runtime verification. With no value for the role: Same as ui_driver. Name the missing verification, do not imply one.
- **`skill_authoring`** (role, substitute). The house rules for writing a SKILL.md. With no value for the role: playbooks/authoring-a-skill.md carries the rules on its own.
- **`model_roles`** (role, substitute). Upstream already assigns these slugs to roles. Port the roles into the prose and leave the slugs to the override file, so a model release does not churn every playbook. With no value for the role: The parent chat model, which is what inherit-parent and auto already mean.
- **`graphite`** (prerequisite, drop). Stacked PR tooling. Upstream's stack playbooks assume it throughout. Without the binary: Stack playbooks do not apply. Shipping, autopilot-stack, and the stack safety section have no plain-git equivalent worth faking.
- **`github_cli`** (prerequisite, drop). scripts/watch-pr reads PR state through it. Without the binary: The Babysit playbook's watcher cannot run.
- **`bun`** (prerequisite, drop). Runtime for scripts/watch-pr and scripts/orch. Without the binary: Those levers cannot run.
- **`pack_path`** (path_assumption, substitute). Upstream reads its own playbooks and scripts through a repo-relative path, which only exists when the pack is vendored into the working repo. Fails silently for anyone who installed the pack into a harness skills dir. Same on every harness: Harness-relative skill addressing. skill://poteto-mode/playbooks/x.md where the harness provides it, otherwise the skill directory the harness already resolves.
- **`trunk_reread`** (path_assumption, substitute). A multi-day program re-grounds on trunk's copy of a playbook rather than its own possibly-stale context. Depends on pack_path being inside the repo. Same on every harness: Drop the git indirection. Re-read the playbook through the harness's own skill addressing, which is already current. The staleness the trunk read guarded against was context staleness, not disk staleness, and a plain re-read fixes that.
- **`transcript_dir`** (path_assumption, substitute). Local transcripts a worker may need to read. Same on every harness: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.
- **`setup_entrypoint`** (naming, substitute). Upstream's installer command. This port renames it, so the old name in a ported file is a regression rather than a coupling left to resolve. v1 enforced the token with no axis owning it; this is that owner. Same on every harness: The skill is /setup-pstack-anywhere.
- **`frontmatter_portable`** (frontmatter: `name`, `description`, `disable-model-invocation`). All three are Agent Skills standard fields. Every target honors disable-model-invocation, so the mode gating that keeps a skill out of automatic model invocation ports with no change: Claude and pi accept both the kebab-case and camelCase spellings, Codex carries it alongside its own allow_implicit_invocation, and OMP normalizes the kebab-case form to its internal `hide`. Unchanged on every harness, so there is nothing to resolve.
- **`frontmatter_cursor_only`** (frontmatter: `mode`, `icon`, `color`, `reminder`). Cursor presentation only, and inert rather than broken elsewhere. OMP preserves unrecognized keys as unknown metadata and the other three ignore them. Left in place: removing them would widen the refresh diff against upstream for no behavior change, and they are correct when the target is Cursor. Unchanged on every harness, so there is nothing to resolve.

## Conformance

Conformance scenarios cover the 9 of 24 domains judged high-risk.
Every scenario applies to all 5 harnesses, so the 9 of them cover every one of the 45 high-risk cells, which is 45 of the 120 in the matrix.
The other 15 domains are resolved in prose on purpose.
A scenario defines what to run and what to inspect; it does not claim a result.

| domain | observations | runs |
| --- | --- | --- |
| `spawn_worker` | 5 | 0 |
| `worker_durability` | 5 | 0 |
| `probe_worker` | 5 | 0 |
| `wake_on_event` | 5 | 0 |
| `worker_defaults.background` | 5 | 0 |
| `worker_defaults.readonly` | 5 | 0 |
| `worker_defaults.identity` | 4 | 0 |
| `worker_defaults.model` | 5 | 0 |
| `human_question` | 5 | 0 |

No cell in this table has accepted evidence, Cursor included, so the verification column would read `unverified` in all 45 of them and is omitted.

Cursor follows the same evidence rules as every other harness, and cannot reach `static` only because this repo has no saved Cursor source to cite.

### Evidence freshness

| measure | value |
| --- | --- |
| scenarios | 9 defined, one per high-risk domain |
| attestations | none under `evidence/attestations.yaml` |
| run directories | none under `evidence/runs` |
| cells exercised | 0 of 120, a subset of the 0 verified cells in Totals |

No runs or attestations exist, so no cell has accepted evidence. This says nothing about whether the substitutions work.

Every digest is sha256, recomputed from disk on each run.

## Skills the port reached

The ledger declares occurrences in these skills, so a token hit here is a
regression rather than work left.
4 paths inside them sit outside the
lint's reach, so no hit can arise there either way:

| path | mechanism | why it is exempt |
| --- | --- | --- |
| `skills/poteto-mode/capabilities.md` | allowlisted whole-file | Generated from coupling.yaml. Its cursor column names Cursor on purpose. |
| `skills/poteto-mode/playbooks/worktree-cleanup.md` | allowlisted whole-file | .cursor/worktrees/myrepo/x is a real disk path in an example about not hand-typing worktree paths. |
| `skills/poteto-mode/scripts/` | allowlisted directory prefix, and nothing under it is Markdown, so `lint.scan` never reaches it either | watch-pr detects review-automation authors by name; worktree-audit.sh uses shell -gt comparisons. |
| `skills/setup-pstack-anywhere/SKILL.md` | allowlisted whole-file | Names the Cursor rule-file location, since Cursor is a supported target. |

### `poteto-mode`

poteto's agent style for concise, detailed responses, deliberate subagents, unslopped prose, simple code, and verified work.

Reached: 68 declared occurrences across 17 files, 67 resolved, 1 not checked.

Domains: `spawn_worker`, `worker_durability`, `probe_worker`, `wake_on_event`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `human_question`, `review_automation`, `slop_strip`, `ui_driver`, `cli_driver`, `skill_authoring`, `model_roles`, `graphite`, `pack_path`, `trunk_reread`, `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/poteto-mode/playbooks/authoring-a-skill.md` | resolved | `skill_authoring` |
| `skills/poteto-mode/playbooks/autonomous-run.md` | resolved | `wake_on_event`, `human_question` |
| `skills/poteto-mode/playbooks/autopilot-full.md` | resolved | `spawn_worker`, `wake_on_event`, `review_automation`, `slop_strip`, `ui_driver`, `cli_driver`, `graphite`, `pack_path` |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | resolved | `spawn_worker`, `wake_on_event`, `review_automation`, `slop_strip`, `graphite`, `pack_path` |
| `skills/poteto-mode/playbooks/babysit.md` | resolved | `wake_on_event`, `review_automation`, `graphite` |
| `skills/poteto-mode/playbooks/bug-fix.md` | resolved | `wake_on_event` |
| `skills/poteto-mode/playbooks/eval.md` | resolved | `transcript_dir` |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | resolved | `wake_on_event`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `review_automation`, `slop_strip`, `ui_driver`, `cli_driver`, `graphite`, `pack_path`, `trunk_reread` |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | resolved | `slop_strip`, `ui_driver`, `cli_driver`, `graphite` |
| `skills/poteto-mode/playbooks/orchestrate.md` | resolved | `spawn_worker`, `worker_durability`, `probe_worker`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `human_question`, `ui_driver`, `cli_driver`, `graphite`, `transcript_dir` |
| `skills/poteto-mode/playbooks/pause-safely.md` | resolved | `worker_durability` |
| `skills/poteto-mode/playbooks/session-pickup.md` | resolved | `worker_durability`, `transcript_dir` |
| `skills/poteto-mode/playbooks/shipping.md` | resolved | `spawn_worker`, `probe_worker`, `wake_on_event`, `ui_driver`, `cli_driver`, `graphite` |
| `skills/poteto-mode/playbooks/visual-parity.md` | resolved | `wake_on_event`, `ui_driver` |
| `skills/poteto-mode/references/bugbot-triage.md` | resolved | `review_automation` |
| `skills/poteto-mode/scripts/check-plan.mjs` | not checked | `model_roles` |
| `skills/poteto-mode/SKILL.md` | resolved | `spawn_worker`, `wake_on_event`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `human_question`, `review_automation`, `slop_strip`, `ui_driver`, `cli_driver`, `skill_authoring`, `model_roles`, `graphite` |

1 row above reads `not checked`; the reason is in [Work remaining](#work-remaining).

### `setup-pstack-anywhere`

Configure which tools and models pstack uses per role.

Reached: 1 declared occurrence across 1 file, 1 not checked.

Domains: `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/setup-pstack-anywhere/SKILL.md` | not checked | `model_roles` |

1 row above reads `not checked`; the reason is in [Work remaining](#work-remaining).

## Skills the port has not reached

These are the skills the lint found coupling in. Their hits are porting work,
not regressions. The 30 skills with neither a declared occurrence nor a token
hit are not listed.

### `architect`

Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in.

Not reached: 1 token hit attributed to a domain, across 1 file.

Domains: `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `arena`

Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it.

Not reached: 3 token hits attributed to a domain and 2 unattributed Cursor mentions, across 1 file.

Domains: `worker_defaults.background`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `automate-me`

Use for "automate me", "create/update/refresh my -mode skill", "turn/capture my preferences or working style into a skill"...

Not reached: 11 token hits attributed to a domain and 6 unattributed Cursor mentions, across 1 file.

Domains: `human_question`, `skill_authoring`, `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `create-verification-skill`

Generate a project-local verification skill that drives your app the way a user does: any language, framework, or platform.

Not reached: 2 unattributed Cursor mentions, across 1 file.

No domain owns anything here, so there is nothing to resolve into yet. The lines are listed in [Work remaining](#work-remaining).

### `how`

Use for "how does X work", code walkthroughs before changing something...

Not reached: 8 token hits attributed to a domain, across 1 file.

Domains: `worker_defaults.identity`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `interrogate`

Use for "interrogate", "adversarial review", "multi-model review", "challenge this", "stress test this code", "find blind spots"...

Not reached: 5 token hits attributed to a domain and 1 unattributed Cursor mention, across 1 file.

Domains: `worker_defaults.identity`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `maintain-verification-skill`

Periodic pass that keeps a project's verification skill and feature map honest: parallel source readers per feature...

Not reached: 1 unattributed Cursor mention, across 1 file.

No domain owns anything here, so there is nothing to resolve into yet. The lines are listed in [Work remaining](#work-remaining).

### `no-comments`

Spawn Comment Sicko, fix accepted findings, and offer encodings for claimed constraints.

Not reached: 1 token hit attributed to a domain, across 1 file.

Domains: `worker_defaults.identity`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `recall`

Reconstruct your recent working context from your own chat history, live state, and the shared record (user reports, prior fixes, incidents)...

Not reached: 1 token hit attributed to a domain and 1 unattributed Cursor mention, across 1 file.

Domains: `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `reflect`

Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill.

Not reached: 14 token hits attributed to a domain and 5 unattributed Cursor mentions, across 5 files.

Domains: `worker_defaults.identity`, `review_automation`, `skill_authoring`, `model_roles`, `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `show-me-your-work`

Keep a reviewable decision trail for long-running or unattended work: a TSV log with one row per decision (what, why, evidence, result).

Not reached: 1 token hit attributed to a domain and 1 unattributed Cursor mention, across 1 file.

Domains: `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `swarm`

Fan out N parallel workers, drain them, and return one report.

Not reached: 4 token hits attributed to a domain and 1 unattributed Cursor mention, across 1 file.

Domains: `spawn_worker`, `worker_durability`, `worker_defaults.background`, `worker_defaults.identity`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

### `why`

Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds.

Not reached: 4 token hits attributed to a domain and 1 unattributed Cursor mention, across 1 file.

Domains: `worker_defaults.identity`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions). The rows are in [Work remaining](#work-remaining).

## Domains with no occurrence

No file-level check can catch a regression in these, because there is no
tracked site to check. Their resolutions are in
[Domain resolutions](#domain-resolutions).

| domain | why no site is tracked |
| --- | --- |
| `github_cli` (prerequisite) | Named only inside skills/poteto-mode/scripts/, which lint.scan does not reach. Nothing in the Markdown prose depends on the binary by name, so there is no occurrence for a refresh diff to catch. |
| `bun` (prerequisite) | The dependency is a shebang inside skills/poteto-mode/scripts/, which lint.scan does not reach. Nothing in the Markdown prose runs the binary by name, so there is no occurrence for a refresh diff to catch. |
| `setup_entrypoint` (naming) | The rename is complete in the ported skills, so there is no site to track. The token stays to catch a reintroduction. |
| `frontmatter_portable` (frontmatter) | A frontmatter surface spans every skill, so an occurrence list would be the skill index. The counted assert is the anchor instead, and the report prints its result. |
| `frontmatter_cursor_only` (frontmatter) | A frontmatter surface spans every skill, and these keys are inert everywhere but Cursor, so there is nothing to port and nothing to track per file. |
