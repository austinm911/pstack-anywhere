# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Author: Lauren Tan (@poteto) · MIT
Pinned SHA: b9ddc83c32972210b8a94d389130713e8eed346e (2026-08-31)
Upstream version: pstack 0.14.5

## Refresh

```sh
# diff upstream against the pinned SHA before copying anything
git -C <clone-of-cursor/plugins> diff b9ddc83..HEAD -- pstack/skills
```

Skill directory names are byte-identical to upstream so this diff stays cheap.
Do not rename skills or modes. `/poteto-mode` stays `/poteto-mode`.

## Intentional divergence

| Path | Change | Why |
|---|---|---|
| `automations/benny/` | dropped | Pure Cursor Automations + Cursor Slack actions, nothing portable |
| `.cursor-plugin/plugin.json` | dropped | Cursor packaging |
| `docs/` (upstream guide) | dropped | Mirrored prose plus 2.3MB of images, readable upstream at the pinned SHA |
| `scripts/` (repo root) | dropped | Byte-identical duplicate of `skills/poteto-mode/scripts/`; skills stay self-contained |
| `skills/setup-pstack` | renamed `setup-pstack-anywhere` | Installs skills, not a Cursor plugin |
| `skill://<name>/...` in skill text (23 refs) | `../<name>/...`, relative to the reading skill's directory | The port's own first replacement for `pstack/skills/...`; `skill_identify` showed no harness resolves it as written (omp keys the scheme by frontmatter name, the others have no scheme, claude and pi hide a `disable-model-invocation` skill from the model). A sibling path under one skill root resolves on all four. |

## Cursor coupling to resolve

Four capabilities carry nearly all of it. Everything else is file placement.

1. **spawn_worker** — upstream spawns a Cursor cloud agent per PR
   (`autopilot-full`, `autopilot-stack`, `shipping`, `orchestrate`).
2. **probe_worker** — liveness without resuming, via the Cursor dashboard.
   Upstream is explicit that a resume restarts an idle agent.
3. **wake_on_event** — Cursor's `/loop` built-in, used by `autonomous-run`.
4. **review_findings** — Bugbot, named in 11 files incl. `references/bugbot-triage.md`.

Named Cursor built-ins also referenced: `create-skill`, the built-in `babysit`
(which `poteto-mode` deliberately overrides), `deslop` from the separate
`cursor-team-kit` plugin, the `mcps/` directory for MCP discovery, and model
slugs read from the Cursor model picker into `.cursor/rules/pstack-models.mdc`.

## Decisions

**Name collisions.** The pack keeps upstream's `tdd`, `teach`, and `unslop`.
Rule 1 forbids renaming. The doctor
(`skills/setup-pstack-anywhere/scripts/doctor.mjs`) reports another definition
of the same name in any known root, and which one wins or whether both load is
the harness's rule. Renaming is the user's skill manager's job: loadout-style
overrides do it. No skill in the pack addresses those three as `../<name>/`, so
a rename of any of them breaks nothing here.

**Install model.** No pack installer that competes with a skill manager. The
layout `skills/<name>/SKILL.md` is what every manager consumes, so a vendoring
manager, `npx skills add`, or a plugin install each take `skills/` whole.
Claude and Codex plugins share `.claude-plugin/plugin.json`, which Codex
discovers at its pin (`references/harnesses/codex/MANIFEST.md`), with a Claude
marketplace at `.claude-plugin/marketplace.json` and a Codex one at
`.agents/plugins/marketplace.json`. `scripts/install.mjs` is the plain fallback:
per-skill symlinks from the one canonical `skills/` copy into
`~/.agents/skills` and `~/.claude/skills`, refusing to overwrite. The doctor is
the post-install check on every path.

Symlinks, not copies. `~/.agents/skills` is a native user-scope root for Codex,
pi, and OMP, verified in source at the pins recorded in `references/harnesses/`,
so it plus `~/.claude/skills` covers all four. OMP also scans the Claude and
Codex roots, so a copy per root makes it see the same skill several times and
warn on the name; symlinks collapse by realpath and stay silent. Target roots
are in `harnesses.yaml`. No hooks ship: no skill depends on one.

OMP does not scan any `.pi` root, so pi and OMP do not share through
`~/.pi/agent/skills`. They share through `~/.agents/skills`.

No adapter-per-harness: harness difference is the root path, not the skill
content.
