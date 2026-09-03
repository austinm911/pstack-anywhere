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
| harness cells | 40 verified of 120 (24 domains x 5 harnesses) |
| occurrences | 91 resolved, 0 unresolved, 0 missing, 2 not checked |
| token hits | 0 attributed to a domain, 0 unattributed Cursor mentions, 0 in total |
| skills reached | 13 of 45: `architect` (1 of 1 checked), `arena` (2 of 2 checked), `automate-me` (3 of 3 checked), `how` (2 of 2 checked), `interrogate` (2 of 2 checked), `no-comments` (1 of 1 checked), `poteto-mode` (67 of 68 checked), `recall` (1 of 1 checked), `reflect` (6 of 6 checked), `setup-pstack-anywhere` (0 of 1 checked), `show-me-your-work` (1 of 1 checked), `swarm` (3 of 3 checked), `why` (2 of 2 checked) |
| skills with work left | 0 of 45; the other 32 carry neither a declared occurrence nor a token hit |
| regressions | 0 |
| `frontmatter_portable` assert | 39 of 45 skills carry `disable-model-invocation`, counted from the tree on every run |

## Work remaining

0 token hits carry a domain and collapse into 0 unresolved occurrences, one per file and domain. 0 hits name Cursor in prose with no domain to resolve into, across 0 files. That is 0 diagnostics in total, and not one of them lands in a skill the port already reached, so not one is a regression. 2 further declarations sit inside skills the port reached, as every declaration does, but no check reads their files, so they yield no diagnostic either way and the count above neither covers nor clears them.

Declared occurrences no check reads. These are the only claims in the ledger the lint cannot confirm or contradict:

| file | domain | status | why |
| --- | --- | --- | --- |
| `skills/poteto-mode/scripts/check-plan.mjs` | `model_roles` | not checked | Not Markdown, so lint.scan never reaches it, and its directory is allowlisted for the shell -gt comparisons in its siblings. It is not checked rather than resolved. |
| `skills/setup-pstack-anywhere/SKILL.md` | `model_roles` | not checked | Allowlisted whole-file in lint.allowlist, because it names the Cursor rule-file location on purpose. The lint therefore never reads it, so this occurrence is not checked rather than resolved. |

Next:

- Bring the 2 unchecked occurrences inside `lint.scan`, or retire them from the ledger.
- Run `bun scripts/coupling.mjs check` as the gate. Cells earn a verification through `probe list`, `probe prepare <scenario> <harness>`, and `probe inspect <run-id>`; none of those drive a harness or write an attestation.

## Domain resolutions

10 domains of 24 resolve differently depending on the harness. Each cell reads `parity, replacement, verification`, and an `extension` cell adds `, else <fallback>` after the replacement for when the tool is not installed. Cursor is the upstream column: its resolutions are what upstream already does, not a substitution this port made.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `spawn_worker` (capability) | native, Task with environment: "cloud", unverified | substitute, Agent tool (named Task in older docs), subagent_type, exercised | substitute, task tool, exercised | extension, subagent({agent:"<name>"}) via pi-subagents; fresh child context from .pi/agent/extensions/subagent/config.json, else without pi-subagents, no delegation primitive, exercised | substitute, task tool, agent field selects the specialist, exercised |
| `worker_durability` (capability) | native, cloud agents run off-machine and survive a restart, unverified | drop, subagents die with the session, exercised | drop, subagents die with the session, exercised | degrade, mission records under ~/.pi/agent/missions/ persist the run; no subagent({action:"children.list"}) reattachment or live report recovery after /quit; externalize side effects, exercised | drop, subagents die with the session, exercised |
| `probe_worker` (capability) | native, dashboard shows agent state without a resume, unverified | degrade, job status only, no liveness for every delegate kind, exercised | substitute, list_agents, running or completed with the final message; no idle state, exercised | extension, the job status the task extension exposes, else none, wait for the result, exercised | substitute, hub op:"jobs" while live, hub op:"list" once settled, exercised |
| `wake_on_event` (capability) | native, /loop built-in, unverified | substitute, one background Bash wait, wake on its completion; heartbeat only when no such wait fits, exercised | degrade, heartbeat sized to when the result is worth re-checking, exercised | degrade, 30-second blocking bash poll; heartbeat only when no such wait fits, exercised | substitute, hub op:"wait", exercised |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, unverified | substitute, run in background, exercised | substitute, async, exercised | degrade, subagent({async:true}) returns at once; collect the result from a file the worker wrote, exercised | substitute, async, or hub op:"wait" to block, exercised |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, unverified | degrade, Explore agent type drops Write and Edit but keeps Bash; the constraint held by the agent's instructions, not the tool surface, exercised | drop, no read-only agent type in stock Codex; a plain spawn_agent worker can write, exercised | drop, subagent({agent:"scout"}), tools: read, grep, find, ls, bash, write, exercised | substitute, scout agent is read-only, exercised |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", unverified | substitute, a poteto-agent definition in the harness subagent dir, exercised | substitute, a poteto-agent definition in the harness subagent dir, exercised | extension, subagent({agent:"<name>"}) via pi-subagents reading ~/.pi/agent/agents (harnesses.yaml:330), else without pi-subagents or a definition file, no named identity; use the parent model, exercised | substitute, a poteto-agent definition in the harness subagent dir, exercised |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, unverified | substitute, role slots, exercised | substitute, role slots, exercised | extension, role slots supplied through the pi-subagents extension, else no model selection, use the parent model, exercised | substitute, role slots, or the agent field, exercised |
| `human_question` (capability) | native, AskQuestion, unverified | substitute, the ask tool, exercised | degrade, a plain question in the reply; request_user_input exists but is mode-gated and was not offered under stock config, exercised | degrade, a plain question in the reply; no recorded extension registers an ask tool, exercised | substitute, the ask tool, exercised |
| `pack_path` (path_assumption) | native, pstack/skills/... in the vendored pack, unverified | substitute, ../<name>/<file> under ~/.claude/skills; the skill is hidden from the model's listing, so the path is the only pointer, exercised | substitute, ../<name>/<file> under ~/.agents/skills; listed to the model as Poteto Mode, exercised | substitute, ../<name>/<file> under ~/.agents/skills; the skill is hidden from the model's listing, so the path is the only pointer, exercised | substitute, ../<name>/<file> under ~/.agents/skills; skill://Poteto Mode/<file> also works, keyed by frontmatter name, exercised |

The other 14 domains resolve the same way on every harness:

- **`review_automation`** (role, substitute). An agentic reviewer that files PR comments. A GitHub-side service, not a harness feature, so it is the user's choice on every harness including Cursor. references/bugbot-triage.md generalizes to review-automation triage: its content is how to assess untrusted review text, which no harness changes. With no value for the role: Apply the same skeptical triage to human review comments. The posture is the portable part. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`slop_strip`** (role, substitute). A pre-commit pass that strips generated slop from a diff. With no value for the role: Apply the unslop skill to the diff directly. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`ui_driver`** (role, substitute). Drives a browser, Electron, or web UI for runtime verification. With no value for the role: Runtime UI verification is not available. Say so in the verification block rather than claiming a pass; a verdict of type-check-only is honest. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`cli_driver`** (role, substitute). Drives a CLI or TUI for runtime verification. With no value for the role: Same as ui_driver. Name the missing verification, do not imply one. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`skill_authoring`** (role, substitute). The house rules for writing a SKILL.md. With no value for the role: playbooks/authoring-a-skill.md carries the rules on its own. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`model_roles`** (role, substitute). Upstream already assigns these slugs to roles. Port the roles into the prose and leave the slugs to the override file, so a model release does not churn every playbook. With no value for the role: The parent chat model, which is what inherit-parent and auto already mean. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`graphite`** (prerequisite, drop). Stacked PR tooling. Upstream's stack playbooks assume it throughout. Without the binary: Stack playbooks do not apply. Shipping, autopilot-stack, and the stack safety section have no plain-git equivalent worth faking. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`github_cli`** (prerequisite, drop). scripts/watch-pr reads PR state through it. Without the binary: The Babysit playbook's watcher cannot run. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`bun`** (prerequisite, drop). Runtime for scripts/watch-pr and scripts/orch. Without the binary: Those levers cannot run. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`trunk_reread`** (path_assumption, substitute). A multi-day program re-grounds on trunk's copy of a playbook rather than its own possibly-stale context. Depends on pack_path being inside the repo. Same on every harness: Drop the git indirection. Re-read the playbook through the harness's own skill addressing, which is already current. The staleness the trunk read guarded against was context staleness, not disk staleness, and a plain re-read fixes that. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`transcript_dir`** (path_assumption, substitute). Local transcripts a worker may need to read. Same on every harness: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`setup_entrypoint`** (naming, substitute). Upstream's installer command. This port renames it, so the old name in a ported file is a regression rather than a coupling left to resolve. v1 enforced the token with no axis owning it; this is that owner. Same on every harness: The skill is /setup-pstack-anywhere. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`frontmatter_portable`** (frontmatter: `name`, `description`, `disable-model-invocation`). All three are Agent Skills standard fields. Every target honors disable-model-invocation, so the mode gating that keeps a skill out of automatic model invocation ports with no change: Claude and pi accept both the kebab-case and camelCase spellings, Codex carries it alongside its own allow_implicit_invocation, and OMP normalizes the kebab-case form to its internal `hide`. Unchanged on every harness, so there is nothing to resolve. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.
- **`frontmatter_cursor_only`** (frontmatter: `mode`, `icon`, `color`, `reminder`). Cursor presentation only, and inert rather than broken elsewhere. OMP preserves unrecognized keys as unknown metadata and the other three ignore them. Left in place: removing them would widen the refresh diff against upstream for no behavior change, and they are correct when the target is Cursor. Unchanged on every harness, so there is nothing to resolve. Verification: Cursor unverified, Claude Code unverified, Codex unverified, pi unverified, Oh My Pi unverified.

## Conformance

Conformance scenarios cover the 9 of 24 domains judged high-risk.
The 9 of them cover 50 of the 45 high-risk cells, which is 50 of the 120 in the matrix.
The other 15 domains are resolved in prose on purpose.
A scenario defines what to run and what to inspect; it does not claim a result.

| domain | scenario | observations | runs | verification |
| --- | --- | --- | --- | --- |
| `spawn_worker` | `spawn_worker` | 5 | 6 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `worker_durability` | `worker_durability` | 5 | 5 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `probe_worker` | `probe_worker` | 5 | 6 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `wake_on_event` | `wake_on_event` | 5 | 5 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `worker_defaults.background` | `worker_defaults_background` | 5 | 4 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `worker_defaults.readonly` | `worker_defaults_readonly` | 5 | 5 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `worker_defaults.identity` | `worker_defaults_identity` | 4 | 7 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `worker_defaults.model` | `worker_defaults_model` | 5 | 5 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `human_question` | `human_question` | 5 | 5 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |
| `pack_path` | `skill_identify` | 5 | 8 | Cursor: unverified; Claude Code: exercised; Codex: exercised; pi: exercised; Oh My Pi: exercised |

Cursor follows the same evidence rules as every other harness, and cannot reach `static` only because this repo has no saved Cursor source to cite.

### Evidence freshness

| measure | value |
| --- | --- |
| scenarios | 10 defined |
| attestations | 53 recorded |
| evidence classes | 47 exercised, 6 superseded |
| run directories | 51 complete, 3 incomplete, 2 void |
| cells exercised | 40 of 120, a subset of the 40 verified cells in Totals |

5 of 56 run directories are not complete against their scenario's evidence contract, so nothing may be attested from them: `probe_worker.pi.2026-09-02.01` (incomplete), `probe_worker.pi.2026-09-02.02` (incomplete), `spawn_worker.pi.2026-09-03.01` (void), `worker_defaults_identity.codex.2026-09-02.01` (incomplete), `worker_defaults_identity.pi.2026-09-03.01` (void).

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

### `architect`

Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in.

Reached: 1 declared occurrence across 1 file, 1 resolved.

Domains: `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/architect/SKILL.md` | resolved | `model_roles` |

### `arena`

Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it.

Reached: 2 declared occurrences across 1 file, 2 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/arena/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles` |

### `automate-me`

Use for "automate me", "create/update/refresh my -mode skill", "turn/capture my preferences or working style into a skill"...

Reached: 3 declared occurrences across 1 file, 3 resolved.

Domains: `human_question`, `skill_authoring`, `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/automate-me/SKILL.md` | resolved | `human_question`, `skill_authoring`, `transcript_dir` |

### `how`

Use for "how does X work", code walkthroughs before changing something...

Reached: 2 declared occurrences across 1 file, 2 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/how/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles` |

### `interrogate`

Use for "interrogate", "adversarial review", "multi-model review", "challenge this", "stress test this code", "find blind spots"...

Reached: 2 declared occurrences across 1 file, 2 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/interrogate/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles` |

### `no-comments`

Spawn Comment Sicko, fix accepted findings, and offer encodings for claimed constraints.

Reached: 1 declared occurrence across 1 file, 1 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/no-comments/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model` |

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

### `recall`

Reconstruct your recent working context from your own chat history, live state, and the shared record (user reports, prior fixes, incidents)...

Reached: 1 declared occurrence across 1 file, 1 resolved.

Domains: `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/recall/SKILL.md` | resolved | `transcript_dir` |

### `reflect`

Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill.

Reached: 6 declared occurrences across 2 files, 6 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `review_automation`, `skill_authoring`, `model_roles`, `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/reflect/references/synthesizer.md` | resolved | `review_automation`, `skill_authoring` |
| `skills/reflect/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `skill_authoring`, `model_roles`, `transcript_dir` |

### `setup-pstack-anywhere`

Configure which tools and models pstack uses per role.

Reached: 1 declared occurrence across 1 file, 1 not checked.

Domains: `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/setup-pstack-anywhere/SKILL.md` | not checked | `model_roles` |

1 row above reads `not checked`; the reason is in [Work remaining](#work-remaining).

### `show-me-your-work`

Keep a reviewable decision trail for long-running or unattended work: a TSV log with one row per decision (what, why, evidence, result).

Reached: 1 declared occurrence across 1 file, 1 resolved.

Domains: `transcript_dir`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/show-me-your-work/SKILL.md` | resolved | `transcript_dir` |

### `swarm`

Fan out N parallel workers, drain them, and return one report.

Reached: 3 declared occurrences across 1 file, 3 resolved.

Domains: `worker_durability`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/swarm/SKILL.md` | resolved | `worker_durability`, `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles` |

### `why`

Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds.

Reached: 2 declared occurrences across 1 file, 2 resolved.

Domains: `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles`. Resolutions are in [Domain resolutions](#domain-resolutions).

| file | status | domains |
| --- | --- | --- |
| `skills/why/SKILL.md` | resolved | `worker_defaults.background`, `worker_defaults.readonly`, `worker_defaults.identity`, `worker_defaults.model`, `model_roles` |

## Skills the port has not reached

These are the skills the lint found coupling in. Their hits are porting work,
not regressions. The 32 skills with neither a declared occurrence nor a token
hit are not listed.



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
