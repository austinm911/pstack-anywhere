# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Author: Lauren Tan (@poteto) · MIT
Pinned SHA: b9ddc83c32972210b8a94d389130713e8eed346e (2026-08-31)
Upstream version: pstack 0.14.5

## Refresh

```sh
git -C ~/.repo-autopsy/cursor/plugins pull
# diff upstream against the pinned SHA before copying anything
git -C ~/.repo-autopsy/cursor/plugins diff b9ddc83..HEAD -- pstack/skills
```

Skill directory names are byte-identical to upstream so this diff stays cheap.
Do not rename skills or modes. `/poteto-mode` stays `/poteto-mode`.

## Intentional divergence

| Path | Change | Why |
|---|---|---|
| `automations/benny/` | dropped | Pure Cursor Automations + Cursor Slack actions, nothing portable |
| `skills/setup-pstack` | renamed `setup-pstack-anywhere` | Installs adapters, not a Cursor plugin |
| `.cursor-plugin/plugin.json` | dropped | Replaced by `adapters/` |

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

## Collisions with existing local skills

`tdd`, `teach`, and `unslop` already exist in `~/.pi/agent/skills` or
`~/.agents/skills`. Decide ownership before the first projection, or two
definitions load at once with no way to tell which fired.
