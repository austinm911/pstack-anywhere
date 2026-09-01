<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->

# Portability report

Every value below is derived on each run. `parity` and the replacement come from
the ledger's resolution for that harness. `implementation` comes from the working
tree: an occurrence whose file still matches a token of its own domain is
unported, one whose file is gone is missing, one the lint cannot reach is
unverifiable. Verification comes from `evidence/attestations.yaml`, and
`unverified` is the default rather than a failure: it means no saved evidence
names that cell yet. An `observed_local` record is one machine's observation and
never counts as verified.

Cursor is upstream's own target. It has no harness registry entry and no saved
source, so its column reports upstream behavior and no Cursor cell can reach
`static`, which is the parity method that reads a saved source. A Cursor cell
can still reach `exercised`, on the same conformance run contract as every
other harness.

A cell reads `parity, replacement, verification`.

## Totals

| measure | value |
| --- | --- |
| ledger | v2, upstream `b9ddc83` |
| axes | 21 |
| harness cells | 0 verified of 120 |
| occurrences | 67 ported, 25 unported, 0 missing, 2 unverifiable |
| skills reached | 2: `poteto-mode`, `setup-pstack-anywhere` |
| skills not reached | 13, 74 token hits |
| regressions | 0 |
| conformance | 9 scenarios over 9 high-risk domains, 45 of 45 harness cells, 0 run directories, 0 attestations |

## Conformance

A domain is an axis and, for a parameter set, one of its parameters, with no
harness in it: one domain is one row below and one cell per harness. The
9 domains that carry a conformance scenario, defined in
`conformance/scenarios.yaml`, are 45 of the 120
harness cells in the tables above, and the scenarios apply to 45
of them. Those are the domains where a wrong cell changes what a playbook does
instead of failing loudly, which is every capability axis and every parameter of
a parameter set. A scenario is a procedure and a rubric: it records no outcome,
and it asserts no parity value.

| scenario | domain | observations | artifacts | runs | Cursor | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `spawn_worker` | `spawn_worker` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `worker_durability` | `worker_durability` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `probe_worker` | `probe_worker` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `wake_on_event` | `wake_on_event` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `worker_defaults_background` | `worker_defaults.background` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `worker_defaults_readonly` | `worker_defaults.readonly` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `worker_defaults_identity` | `worker_defaults.identity` | 4 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `worker_defaults_model` | `worker_defaults.model` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |
| `human_question` | `human_question` | 5 | 7 | 0 | unverified | unverified | unverified | unverified | unverified |

`n/a` is a harness the scenario does not apply to. No column reaches
`exercised` without a run directory that is complete against that scenario's
evidence contract and a record citing it whose per-file digests still match the
bytes on disk. Cursor is no exception: upstream's own target earns a run on the
same artifacts as everyone else.

### Evidence freshness

| measure | value |
| --- | --- |
| scenarios | 9 defined, covering 9 high-risk domains, 45 of 45 harness cells |
| attestations | none recorded |
| evidence classes | none |
| run directories | none under `evidence/runs` |
| cells exercised | 0 of 120 |
| digests | sha256, recomputed from disk on every run |

No run directory exists and no attestation has been recorded, so every cell above is `unverified`. That is a statement about what has been done, not about what is true: nothing here has been looked at.

`observed_local` never counts as verified, at any count: it is one machine on one day, recorded so it stops being mistaken for proof.

`bun scripts/coupling.mjs probe list` names the scenarios, `probe prepare <scenario> <harness>` writes an unexecuted run manifest and its artifact checklist, and `probe inspect <run-id>` judges a run directory against the contract. None of the three drives a harness, and none of them writes an attestation.

## Skills the port reached

A token hit in one of these is a regression, because the ledger declares
occurrences here and the port resolved them.

### `poteto-mode`

poteto's agent style for concise, detailed responses, deliberate subagents, unslopped prose, simple code, and verified work.

Reached by the port. 68 occurrences across 17 files and 16 domains.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `spawn_worker` (capability) | native, Task with environment: "cloud", upstream behavior | substitute, Task tool, subagent_type, unverified | substitute, task tool, unverified | substitute, task tool, unverified | substitute, task tool, agent field selects the specialist, unverified |
| `worker_durability` (capability) | native, cloud agents run off-machine and survive a restart, upstream behavior | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified |
| `probe_worker` (capability) | native, dashboard shows agent state without a resume, upstream behavior | degrade, job status only, no liveness for every delegate kind, unverified | degrade, job status only, unverified | degrade, job status only, unverified | substitute, hub op:"jobs", unverified |
| `wake_on_event` (capability) | native, /loop built-in, upstream behavior | degrade, heartbeat sized to when the result is worth re-checking, unverified | degrade, heartbeat sized to when the result is worth re-checking, unverified | degrade, heartbeat sized to when the result is worth re-checking, unverified | substitute, hub op:"wait", unverified |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `human_question` (capability) | native, AskQuestion, upstream behavior | substitute, the ask tool, unverified | degrade, a plain question in the reply, unverified | degrade, a plain question in the reply, unverified | substitute, the ask tool, unverified |
| `review_automation` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `slop_strip` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `ui_driver` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `cli_driver` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `skill_authoring` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `graphite` (prerequisite) | drop, harness-independent, upstream behavior | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified |
| `pack_path` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `trunk_reread` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `transcript_dir` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `review_automation`, with no value for the role: Apply the same skeptical triage to human review comments. The posture is the portable part.
- `slop_strip`, with no value for the role: Apply the unslop skill to the diff directly.
- `ui_driver`, with no value for the role: Runtime UI verification is not available. Say so in the verification block rather than claiming a pass; a verdict of type-check-only is honest.
- `cli_driver`, with no value for the role: Same as ui_driver. Name the missing verification, do not imply one.
- `skill_authoring`, with no value for the role: playbooks/authoring-a-skill.md carries the rules on its own.
- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.
- `graphite`, without the binary: Stack playbooks do not apply. Shipping, autopilot-stack, and the stack safety section have no plain-git equivalent worth faking.
- `pack_path`: Harness-relative skill addressing. skill://poteto-mode/playbooks/x.md where the harness provides it, otherwise the skill directory the harness already resolves.
- `trunk_reread`: Drop the git indirection. Re-read the playbook through the harness's own skill addressing, which is already current. The staleness the trunk read guarded against was context staleness, not disk staleness, and a plain re-read fixes that.
- `transcript_dir`: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/poteto-mode/playbooks/authoring-a-skill.md` | `skill_authoring` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autonomous-run.md` | `human_question` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autonomous-run.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `pack_path` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `slop_strip` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `spawn_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-full.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `pack_path` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `slop_strip` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `spawn_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/babysit.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/babysit.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/babysit.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/bug-fix.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/eval.md` | `transcript_dir` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `pack_path` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `slop_strip` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `trunk_reread` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | `worker_defaults` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | `slop_strip` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `human_question` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `probe_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `spawn_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `transcript_dir` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `worker_defaults` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/orchestrate.md` | `worker_durability` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/pause-safely.md` | `worker_durability` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/session-pickup.md` | `transcript_dir` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/session-pickup.md` | `worker_durability` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `probe_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `spawn_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/shipping.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/visual-parity.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/playbooks/visual-parity.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/references/bugbot-triage.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/scripts/check-plan.mjs` | `model_roles` | declared | unverifiable | Not Markdown, so lint.scan never reaches it, and its directory is allowlisted for the shell -gt comparisons in its siblings. Its implementation derives unverifiable rather than ported. |
| `skills/poteto-mode/SKILL.md` | `cli_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `graphite` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `human_question` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `model_roles` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `review_automation` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `skill_authoring` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `slop_strip` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `spawn_worker` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `ui_driver` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `wake_on_event` | declared | ported | no token of this domain matches the file |
| `skills/poteto-mode/SKILL.md` | `worker_defaults` | declared | ported | no token of this domain matches the file |

### `setup-pstack-anywhere`

Configure which tools and models pstack uses per role.

Reached by the port. 1 occurrence across 1 file and 1 domain.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/setup-pstack-anywhere/SKILL.md` | `model_roles` | declared | unverifiable | Allowlisted whole-file in lint.allowlist, because it names the Cursor rule-file location on purpose. The lint therefore never reads it, so this occurrence derives unverifiable rather than ported. |

## Skills the port has not reached

No occurrence is declared in any of these, so their hits are unported work
rather than regressions. Each domain table is the resolution a port would
inherit; each occurrence row is detected on this run, not maintained by hand.

### `architect`

Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in.

Not reached by the port. 1 token hit across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/architect/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |

### `arena`

Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it.

Not reached by the port. 5 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/arena/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/arena/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\brun_in_background\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/arena/SKILL.md:28`, `skills/arena/SKILL.md:41`

### `automate-me`

Use for "automate me", "create/update/refresh my -mode skill", "turn/capture my preferences or working style into a skill", or wanting agents to follow how the user works.

Not reached by the port. 17 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `human_question` (capability) | native, AskQuestion, upstream behavior | substitute, the ask tool, unverified | degrade, a plain question in the reply, unverified | degrade, a plain question in the reply, unverified | substitute, the ask tool, unverified |
| `skill_authoring` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `transcript_dir` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `skill_authoring`, with no value for the role: playbooks/authoring-a-skill.md carries the rules on its own.
- `transcript_dir`: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/automate-me/SKILL.md` | `human_question` | detected | unported | token hit at a path the ledger does not declare: `\bAskQuestion\b` |
| `skills/automate-me/SKILL.md` | `skill_authoring` | detected | unported | token hit at a path the ledger does not declare: `\bcreate-skill\b` |
| `skills/automate-me/SKILL.md` | `transcript_dir` | detected | unported | token hit at a path the ledger does not declare: `\bagent-transcripts\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/automate-me/SKILL.md:11`, `skills/automate-me/SKILL.md:17`, `skills/automate-me/SKILL.md:29`, `skills/automate-me/SKILL.md:67`, `skills/automate-me/SKILL.md:69`, `skills/automate-me/SKILL.md:109`

### `create-verification-skill`

Generate a project-local verification skill that drives your app the way a user does — any language, framework, or platform.

Not reached by the port. 2 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

No axis owns a token here. The only coupling is prose that names Cursor directly, which the lint counts but cannot attribute to a domain.

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/create-verification-skill/SKILL.md:9`, `skills/create-verification-skill/SKILL.md:25`

### `how`

Use for "how does X work", code walkthroughs before changing something, and placement / ownership / layering questions ("where should this live", "which package owns this", "is this the right layer").

Not reached by the port. 8 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/how/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/how/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\bsubagent_type\b` |

### `interrogate`

Use for "interrogate", "adversarial review", "multi-model review", "challenge this", "stress test this code", "find blind spots", or "tear this apart".

Not reached by the port. 6 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/interrogate/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/interrogate/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\bsubagent_type\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/interrogate/SKILL.md:36`

### `maintain-verification-skill`

Periodic pass that keeps a project's verification skill and feature map honest: parallel source readers per feature, one live session driving every feature, at most one PR of proven corrections.

Not reached by the port. 1 token hit across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

No axis owns a token here. The only coupling is prose that names Cursor directly, which the lint counts but cannot attribute to a domain.

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/maintain-verification-skill/SKILL.md:25`

### `no-comments`

Spawn Comment Sicko, fix accepted findings, and offer encodings for claimed constraints.

Not reached by the port. 1 token hit across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/no-comments/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\bsubagent_type\b` |

### `recall`

Reconstruct your recent working context from your own chat history, live state, and the shared record (user reports, prior fixes, incidents), then hand back a tight current-state brief.

Not reached by the port. 2 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `transcript_dir` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `transcript_dir`: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/recall/SKILL.md` | `transcript_dir` | detected | unported | token hit at a path the ledger does not declare: `\bagent-transcripts\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/recall/SKILL.md:15`

### `reflect`

Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill.

Not reached by the port. 19 token hits across 5 files, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `review_automation` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `skill_authoring` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `transcript_dir` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `review_automation`, with no value for the role: Apply the same skeptical triage to human review comments. The posture is the portable part.
- `skill_authoring`, with no value for the role: playbooks/authoring-a-skill.md carries the rules on its own.
- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.
- `transcript_dir`: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/reflect/references/synthesizer.md` | `review_automation` | detected | unported | token hit at a path the ledger does not declare: `\bBugbot\b` |
| `skills/reflect/references/synthesizer.md` | `skill_authoring` | detected | unported | token hit at a path the ledger does not declare: `\bcreate-skill\b` |
| `skills/reflect/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/reflect/SKILL.md` | `skill_authoring` | detected | unported | token hit at a path the ledger does not declare: `\bcreate-skill\b` |
| `skills/reflect/SKILL.md` | `transcript_dir` | detected | unported | token hit at a path the ledger does not declare: `\bagent-transcripts\b` |
| `skills/reflect/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\bsubagent_type\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/reflect/SKILL.md:25`, `skills/reflect/SKILL.md:64`, `skills/reflect/references/divergent-reviewer.md:23`, `skills/reflect/references/judgment-reviewer.md:22`, `skills/reflect/references/tooling-reviewer.md:37`

### `show-me-your-work`

Keep a reviewable decision trail for long-running or unattended work: a TSV log with one row per decision (what, why, evidence, result).

Not reached by the port. 2 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `transcript_dir` (path_assumption) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `transcript_dir`: Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/show-me-your-work/SKILL.md` | `transcript_dir` | detected | unported | token hit at a path the ledger does not declare: `\bagent-transcripts\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/show-me-your-work/SKILL.md:56`

### `swarm`

Fan out N parallel workers, drain them, and return one report.

Not reached by the port. 5 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `spawn_worker` (capability) | native, Task with environment: "cloud", upstream behavior | substitute, Task tool, subagent_type, unverified | substitute, task tool, unverified | substitute, task tool, unverified | substitute, task tool, agent field selects the specialist, unverified |
| `worker_durability` (capability) | native, cloud agents run off-machine and survive a restart, upstream behavior | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified | drop, subagents die with the session, unverified |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/swarm/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/swarm/SKILL.md` | `spawn_worker` | detected | unported | token hit at a path the ledger does not declare: `environment:\s*"cloud"` |
| `skills/swarm/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\brun_in_background\b`, `\bsubagent_type\b` |
| `skills/swarm/SKILL.md` | `worker_durability` | detected | unported | token hit at a path the ledger does not declare: `environment:\s*"cloud"` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/swarm/SKILL.md:25`

### `why`

Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds.

Not reached by the port. 5 token hits across 1 file, none of them a regression: the rows below are the resolution a port would inherit and the sites it would have to reach.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `worker_defaults.background` (parameter_set) | native, run_in_background: true, upstream behavior | substitute, run in background, unverified | substitute, async, unverified | substitute, async, unverified | substitute, async, or hub op:"wait" to block, unverified |
| `worker_defaults.readonly` (parameter_set) | native, agent mode strips MCP, upstream behavior | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, read-only agent type, unverified | substitute, scout agent is read-only, unverified |
| `worker_defaults.identity` (parameter_set) | native, subagent_type: "poteto-agent", upstream behavior | substitute, a poteto-agent definition in the harness subagent dir, unverified | substitute, same, unverified | substitute, same, unverified | substitute, same, unverified |
| `worker_defaults.model` (parameter_set) | native, explicit slug per role, upstream behavior | substitute, role slots, see roles below, unverified | substitute, role slots, unverified | substitute, role slots, unverified | substitute, role slots, or the agent field, unverified |
| `model_roles` (role) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |

The harness-independent replacements above, named once:

- `model_roles`, with no value for the role: The parent chat model, which is what inherit-parent and auto already mean.

| file | domain | source | implementation | reason |
| --- | --- | --- | --- | --- |
| `skills/why/SKILL.md` | `model_roles` | detected | unported | token hit at a path the ledger does not declare: `\b(grok\|gpt\|claude)-[a-z0-9.-]*(max\|xhigh\|thinking)[a-z0-9.-]*\b` |
| `skills/why/SKILL.md` | `worker_defaults` | detected | unported | token hit at a path the ledger does not declare: `\bsubagent_type\b` |

Unattributed Cursor mentions, port work with no domain to resolve into: `skills/why/SKILL.md:100`

## Domains with no occurrence

These resolve without a tracked site in the tree. Each one says why, so a
refresh diff against upstream has nothing silently exempt.

| domain | Cursor (upstream) | Claude Code | Codex | pi | Oh My Pi |
| --- | --- | --- | --- | --- | --- |
| `github_cli` (prerequisite) | drop, harness-independent, upstream behavior | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified |
| `bun` (prerequisite) | drop, harness-independent, upstream behavior | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified | drop, harness-independent, unverified |
| `setup_entrypoint` (naming) | substitute, harness-independent, upstream behavior | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified | substitute, harness-independent, unverified |
| `frontmatter_portable` (frontmatter) | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged |
| `frontmatter_cursor_only` (frontmatter) | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged | portable, standard field, unchanged |

The harness-independent replacements above, named once:

- `github_cli`, without the binary: The Babysit playbook's watcher cannot run.
- `bun`, without the binary: Those levers cannot run. Both are TypeScript with a bun shebang.
- `setup_entrypoint`: The skill is /setup-pstack-anywhere.

- `github_cli` (prerequisite). Named only inside skills/poteto-mode/scripts/, which lint.scan does not reach. Nothing in the Markdown prose depends on the binary by name, so there is no occurrence for a refresh diff to catch.
- `bun` (prerequisite). Same as github_cli. The dependency is a shebang in a script, not a coupling site in prose.
- `setup_entrypoint` (naming). The rename is complete in the ported skills, so there is no site to track. The token stays to catch a reintroduction.
- `frontmatter_portable` (frontmatter). A frontmatter surface spans every skill, so an occurrence list would be the skill index. The assert block above is the anchor instead.
- `frontmatter_cursor_only` (frontmatter). Same as frontmatter_portable. These keys are inert everywhere but Cursor, so there is nothing to port and nothing to track per file.
