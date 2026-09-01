# pstack-anywhere

**pstack for Claude Code, Codex, pi, OMP, and other agent harnesses.**

[pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan (@poteto)](https://x.com/poteto) is a pack of skills and principles
for rigorous AI-assisted engineering: 21 principle skills, a `/poteto-mode`
router, and playbooks for stacked PRs and subagent fleets. It ships as a Cursor
plugin and assumes Cursor primitives throughout.

This is a port. Same skills, same mode names, same playbook vocabulary, with the
Cursor-specific parts named and replaced.

## Where it goes

`~/.agents/skills` is read natively by Codex, pi, and OMP. Claude Code reads only
`~/.claude/skills`. So two locations cover all four harnesses, and the second can
be a symlink.

```sh
# one canonical copy
ln -s "$PWD/skills"/* ~/.agents/skills/

# Claude Code, the only harness that does not read ~/.agents/skills
ln -s "$PWD/skills"/* ~/.claude/skills/
```

Symlinks rather than copies. Codex handles a symlinked skill directory in its
loader and OMP deduplicates by realpath, so one canonical copy behind two links
is seen once. Four copies in four roots collide by skill name instead.

Evidence for each claim is pinned upstream source, saved under
`references/harnesses/<id>/`, and cited line by line in each `MANIFEST.md`.
`harnesses.yaml` carries the conclusions under `distribution`.

Three names collide with common skills, `tdd`, `teach`, and `unslop`. Check your
target root before linking.

## Layout

```
skills/          the pack, one directory per skill, names byte-identical to upstream
coupling.yaml    every Cursor primitive this port replaces, and how, per harness
harnesses.yaml   distribution targets, config files, and hook mechanism per harness
references/      pinned upstream source per harness, with the pin and a refetch block
scripts/         coupling.mjs: derives the ledger, renders what it derives, lints
PORTABILITY.md   generated: per-skill parity, replacement, and verification tables
UPSTREAM.md      pinned SHA, divergence log, open decisions
```

Claude, Codex, and OMP discover skills as `<root>/<skill-name>/SKILL.md`, one
level deep. pi also walks nested Markdown but stops at any directory holding a
`SKILL.md`, so that one layout works everywhere and the pack needs no
per-harness transform. Skills are self-contained, so `skills/poteto-mode/scripts/`
travels with its skill and a skill directory works anywhere on its own.

## Status

<!-- BEGIN GENERATED coupling-summary -->

<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->

| measure | value |
| --- | --- |
| upstream pin | `b9ddc83`, path `pstack` |
| ported skills | 2: `poteto-mode`, `setup-pstack-anywhere` |
| skills not reached | 13, in 74 places the lint counts |
| occurrences | 67 ported, 25 unported, 0 missing, 2 unverifiable |
| verification | 0 of 120 cells verified, 0 attestations, 9 scenarios defined |

`bun scripts/coupling.mjs check` is the gate. Per-skill parity, replacement, and
verification tables, including every skill the port has not reached, are in
[PORTABILITY.md](PORTABILITY.md).

<!-- END GENERATED coupling-summary -->

## Credit

MIT, same as upstream. All skill content is Lauren Tan's work unless a file says
otherwise.
