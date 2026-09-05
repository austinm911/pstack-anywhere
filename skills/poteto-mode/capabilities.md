<!-- Generated from coupling.yaml by scripts/coupling.mjs render. Do not edit. -->

# Capability map

Read your own harness column. Everything upstream resolved through a Cursor
primitive resolves here instead.

Cursor is one column, not the baseline. If you are running in Cursor, its column
is upstream's original behavior.

Your column is the default, not a ceiling. If your tool list already has a tool
that does the job, use it and skip the fallback.

## Capabilities

| capability | cursor | claude | codex | pi | omp |
| --- | --- | --- | --- | --- | --- |
| `spawn_worker` | Task with environment: "cloud" | Agent tool (named Task in older docs), subagent_type | spawn_agent with the exact brief; send_message for live steering and followup_task for another turn when offered | not on by default: subagent({agent:"<name>"}) via pi-subagents; fresh child context from .pi/agent/extensions/subagent/config.json, else without pi-subagents, no delegation primitive | task tool, agent field selects the specialist |
| `worker_durability` | cloud agents run off-machine and survive a restart | uninterrupted execution is not guaranteed after process exit; saved sessions and eligible subagents can resume with their history | uninterrupted execution is not guaranteed after process exit; saved sessions can resume by ID, while child resumption must be checked against the current tools | degraded, saved sessions can resume by path or ID; child/job recovery depends on the installed subagent extension; inspect its native resume support before falling back to saved reports | uninterrupted execution is not guaranteed after process exit; saved sessions can resume by ID or path, while child/job recovery depends on the current runtime |
| `probe_worker` | dashboard shows agent state without a resume | degraded, job status only, no liveness for every delegate kind | list_agents for observed status; collect completion messages and use wait_agent when offered | not on by default: the job status the task extension exposes, else none, wait for the result | hub op:"jobs" while live, hub op:"list" once settled |
| `wake_on_event` | /loop built-in | one background Bash wait, wake on its completion; heartbeat only when no such wait fits | degraded, wait_agent for live worker events when offered; otherwise a bounded status check or a user-authorized heartbeat | degraded, 30-second blocking bash poll; heartbeat only when no such wait fits | hub op:"wait" |
| `human_question` | AskQuestion | the ask tool | degraded, request_user_input_async when offered for clarification; request_user_input only in an allowed mode; otherwise a plain question, with pending gates persisted | degraded, a plain question in the reply; no recorded extension registers an ask tool | the ask tool |

### `worker_defaults`

The parameters upstream sets on every Task call. Highest-traffic coupling in the pack, since every playbook that delegates inherits them.

| parameter | cursor | claude | codex | pi | omp |
| --- | --- | --- | --- | --- | --- |
| `background` | run_in_background: true | run in background | async | degraded, subagent({async:true}) returns at once; collect the result from a file the worker wrote | async, or hub op:"wait" to block |
| `readonly` | agent mode strips MCP | degraded, Explore agent type drops Write and Edit but keeps Bash; the constraint held by the agent's instructions, not the tool surface | no read-only agent type in stock Codex; a plain spawn_agent worker can write | subagent({agent:"scout"}), tools: read, grep, find, ls, bash, write | scout agent is read-only |
| `identity` | subagent_type: "poteto-agent" | a poteto-agent definition in the harness subagent dir | an available worker agent with the pstack brief and standing orders; use poteto-agent only if that definition is actually offered | not on by default: subagent({agent:"<name>"}) via pi-subagents reading ~/.pi/agent/agents (harnesses.yaml:330), else without pi-subagents or a definition file, no named identity; use the parent model | a poteto-agent definition in the harness subagent dir |
| `model` | explicit slug per role | role slots | role slots | not on by default: role slots supplied through the pi-subagents extension, else no model selection, use the parent model | role slots, or the agent field |

### What the gaps cost

- **`worker_durability`.** Continuing to execute while the parent is offline, resuming a persisted conversation, and collecting child jobs are separate capabilities. Inspect liveness first, use native resume where supported, and reconcile actual work before any replacement spawn. Persist session/agent IDs, briefs and reports as recovery references; a stopped process does not erase history.
- **`wake_on_event`.** Upstream already documents the heartbeat as its own no-event path, so the degraded path is prose that already exists. Only the "pick the mechanism" step changes.
- **`worker_defaults`.** Use only worker identities the current tool exposes. Where a named poteto-agent is required, its definition must exist in the directory recorded by harnesses.yaml. Where the resolution supports an ordinary worker, supply the exact pstack brief and standing orders. Never name an absent agent type.
- **`human_question`.** orchestrate.md parks human gates in gates.md so a completion flood cannot wipe pending question state. That file-backed gate is the portable part and matters more where the primitive is off by default or absent.

## Roles

The pack names the role, never a vendor. Values come from the override file
`/setup-pstack-anywhere` writes. When a role has no value, use the absent path
and say which verification you did not perform. Never imply a capability you do
not have.

- **review_automation.** An agentic reviewer that files PR comments. A GitHub-side service, not a harness feature, so it is the user's choice on every harness including Cursor. references/bugbot-triage.md generalizes to review-automation triage: its content is how to assess untrusted review text, which no harness changes.
  Absent: Apply the same skeptical triage to human review comments. The posture is the portable part.
- **slop_strip.** A pre-commit pass that strips generated slop from a diff.
  Absent: Apply the unslop skill to the diff directly.
- **ui_driver.** Drives a browser, Electron, or web UI for runtime verification.
  Absent: Runtime UI verification is not available. Say so in the verification block rather than claiming a pass; a verdict of type-check-only is honest.
- **cli_driver.** Drives a CLI or TUI for runtime verification.
  Absent: Same as ui_driver. Name the missing verification, do not imply one.
- **skill_authoring.** The house rules for writing a SKILL.md.
  Absent: playbooks/authoring-a-skill.md carries the rules on its own.
- **model_roles.** Upstream already assigns these slugs to roles. Port the roles into the prose and leave the slugs to the override file, so a model release does not churn every playbook. Slots: `fast code`, `strong judgment`, `strong instruction following`, `prose and judgment`.
  Absent: The parent chat model, which is what inherit-parent and auto already mean.

## Prerequisites

Tools, not harness features. Missing one removes the playbooks that depend on it.

- **`gt`.** Stacked PR tooling. Upstream's stack playbooks assume it throughout. Absent: Stack playbooks do not apply. Shipping, autopilot-stack, and the stack safety section have no plain-git equivalent worth faking.
- **`gh`.** scripts/watch-pr reads PR state through it. Absent: The Babysit playbook's watcher cannot run.
- **`bun`.** Runtime for scripts/watch-pr and scripts/orch. Absent: Those levers cannot run.

## Paths

- **pack_path.** Upstream used `pstack/skills/...`.
  - cursor: pstack/skills/... in the vendored pack
  - claude: ../<name>/<file> under ~/.claude/skills; the skill is hidden from the model's listing, so the path is the only pointer
  - codex: ../<name>/<file> under ~/.agents/skills; listed to the model as Poteto Mode
  - pi: ../<name>/<file> under ~/.agents/skills; the skill is hidden from the model's listing, so the path is the only pointer
  - omp: ../<name>/<file> under ~/.agents/skills; skill://Poteto Mode/<file> also works, keyed by frontmatter name
- **trunk_reread.** Upstream used `git show origin/main:pstack/skills/...`. Drop the git indirection. Re-read the playbook through the harness's own skill addressing, which is already current. The staleness the trunk read guarded against was context staleness, not disk staleness, and a plain re-read fixes that.
- **transcript_dir.** Upstream used `agent-transcripts/`. Per-harness session directory. Left as a role-style slot because the path is user and harness specific, and no playbook depends on its shape.
