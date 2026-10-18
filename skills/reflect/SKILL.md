---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Read `../poteto-mode/capabilities.md` for `spawn_worker` and `worker_defaults`. Use the delegate identity and background controls the current harness actually offers. Keep reviews read-only through their briefs and available permission controls without broadening the caller's access.

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Find this conversation's transcript through the current harness's session path and record format (`transcript_dir` in `../poteto-mode/capabilities.md`). Stay inside the current project's sessions. Match its opening user message, rather than assuming a JSON field layout. If no transcript resolves, pass a tight digest of this session instead.

## 2. Spawn three reviewers in parallel

One batch, three `spawn_worker` calls. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references. Keep their work read-only by instruction and preserve the caller's access mode.

Resolve model roles from the override block `/setup-pstack-anywhere` writes. Missing roles, `auto`, and `inherit-parent` use the parent model. An alias panel entry still creates one seat. If a configured model is rejected, discover the current tool's available models and prefer one from the same family, otherwise use the parent model. Report the substitution and any lost model diversity. Never invent a model identifier. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.

| Lens | Role line | Fallback model | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `auto` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `auto` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `auto` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings through the current harness's delegate result channel.

## 3. Synthesize

One `spawn_worker` call using `reflect judgment, divergent, synthesizer`, or the parent model when missing. The synthesizer spot-verifies citations through available MCP access. Keep it read-only by instruction and preserve the caller's access mode. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Follow each approved row's Routing exactly. Resolve `skill_authoring` through the override block, or use `../poteto-mode/playbooks/authoring-a-skill.md` when absent:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the configured `skill_authoring` skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `skill_authoring` and run its description-optimization loop.
- `new skill via skill_authoring: <kebab-name>`: hand creation to `skill_authoring`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
