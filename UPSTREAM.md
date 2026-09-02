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

## Open decisions

**Name collisions.** `tdd`, `teach`, and `unslop` are common skill names. If a
harness already loads a skill by one of those names, two definitions load at
once with no way to tell which fired. Decide ownership per name before the first
install, and record it here.

**Install model.** One canonical store, per-skill symlinks into each harness
root. Not copies. `~/.agents/skills` is a native user-scope root for Codex, pi,
and OMP, verified in source at the pins recorded in `references/harnesses/`, so
it plus `~/.claude/skills` covers all four. OMP also scans the Claude and Codex
roots, so a copy per root makes it see the same skill several times and warn on
the name; symlinks collapse by realpath and stay silent. Target roots and hook
mechanisms are in `harnesses.yaml`.

OMP does not scan any `.pi` root, so pi and OMP do not share through
`~/.pi/agent/skills`. They share through `~/.agents/skills`.

No adapter-per-harness: harness difference is the root path and the hook format,
not the skill content. The installer needs a manifest of the names this repo
owns and a pre-flight collision check against every target root.
