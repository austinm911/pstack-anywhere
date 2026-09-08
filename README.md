# pstack-anywhere

**pstack for Claude Code, Codex, pi, OMP, and other agent harnesses.**

[pstack](https://github.com/cursor/plugins/tree/main/pstack) by
[Lauren Tan (@poteto)](https://x.com/poteto) is a pack of skills and principles
for rigorous AI-assisted engineering: 21 principle skills, a `/poteto-mode`
router, and playbooks for stacked PRs and subagent fleets. It ships as a Cursor
plugin and assumes Cursor primitives throughout. This repo is a port. Same
skills, same mode names, same playbook vocabulary, with the Cursor-specific
parts named and replaced. Whether it works on your harness is answered in
[Status](#status).

## Install

The recommended path is `npx skills add`. It walks `skills/<name>/SKILL.md` and
links or copies each skill into every agent root it knows.

```sh
npx skills add austinm911/pstack-anywhere
```

Then run the doctor from the root it installed into:

```sh
bun <skills root>/setup-pstack-anywhere/scripts/doctor.mjs
```

The doctor checks that every sibling the pack references is present in that
root, that no skill in that root or any other known root resolves to a different
copy, and names the three common skill names, `tdd`, `teach`, `unslop`, when
another definition of one is found.

Install the pack whole. Skills address each other as `../<name>/`, so a partial
install (`npx skills add --skill <one>`, or linking a single directory) leaves
dangling references.

### Other ways

The pack is `skills/<name>/SKILL.md`, the layout every skill manager consumes,
so any of these works. Every path finishes with the same doctor command above.

A vendoring skill manager. Point it at this repo and take
the whole `skills/` directory. It flattens the pack into one root and links that
root into `~/.agents/skills`, `~/.claude/skills`, and `~/.pi/agent/skills`.

A plugin. Claude Code: `/plugin marketplace add austinm911/pstack-anywhere`,
then install `pstack-anywhere`. Codex: `/plugins`, then Add Marketplace with
`austinm911/pstack-anywhere` and install `pstack-anywhere` from it. The repo
carries `.agents/plugins/marketplace.json`, and at the pinned Codex source
plugins sit behind `[features] plugins = true` in `config.toml`. Both harnesses
read `.claude-plugin/plugin.json` and take skills from the plugin's `skills/`
directory. Each path was exercised once, on Claude Code and Codex 0.153.0,
under a scratch HOME.

The plain fallback:

```sh
bun scripts/install.mjs            # ~/.agents/skills and ~/.claude/skills
bun scripts/install.mjs --dry-run  # list the links first
bun scripts/install.mjs --root <dir>
```

It symlinks each `skills/<name>` into the root, refuses to overwrite anything
that is not already a link to the same skill, and runs the doctor when done.

Symlinks rather than copies. Codex handles a symlinked skill directory in its
loader and OMP deduplicates by realpath, so one canonical copy behind two links
is seen once. Four copies in four roots collide by skill name instead. Evidence
for each claim is pinned upstream source under `references/harnesses/<id>/`,
cited line by line in each `MANIFEST.md`.

## Vocabulary

These terms are used the same way in every doc and ledger in this repo.

**harness**: one of Cursor (upstream), Claude Code, Codex, pi, Oh My Pi (OMP).

**domain**: one axis, or one axis plus one parameter for a parameter set. 21
axes make 24 domains.

**cell**: one domain on one harness. 24 x 5 = 120 cells.

**occurrence**: one domain in one file. Its status is resolved, unresolved,
missing, or not checked.

**parity**: how a cell resolves: native, substitute, degrade, drop, extension.

**verification**: the strongest saved evidence for a cell: exercised, static
(both count as verified), observed_local, stale, superseded, unverified, void.

Rendered tables use this legend:

| term | legend |
| --- | --- |
| parity | 🟢 substitute, 🟡 degrade, 🔴 drop, 🧩 extension, ⚫ native |

Verification is shown as a suffix: (unverified), (stale), (void); no suffix
means a recorded run or cited source backs the cell.

## Layout

```
skills/          the pack, one directory per skill, names byte-identical to upstream
coupling.yaml    every Cursor primitive this port replaces, and how, per harness
harnesses.yaml   distribution targets, config files, and hook mechanism per harness
references/      pinned upstream source per harness, with the pin and a refetch block
scripts/         coupling.mjs: derives the ledger, renders what it derives, lints
scripts/install.mjs  fallback: symlinks skills/ into a root, then runs the doctor
.claude-plugin/, .agents/plugins/  plugin manifests for Claude and Codex, plus each marketplace
PORTABILITY.md   generated: what remains, per-harness resolutions, evidence state
UPSTREAM.md      pinned SHA, divergence log, decisions
```

Claude, Codex, and OMP discover skills as `<root>/<skill-name>/SKILL.md`, one
level deep. pi also walks nested Markdown but stops at any directory holding a
`SKILL.md`, so one layout works everywhere and the pack needs no per-harness
transform. Skills are self-contained, so `skills/poteto-mode/scripts/` travels
with its skill and a skill directory works anywhere on its own.

## Status

Per-harness results are in [PORTABILITY.md](PORTABILITY.md#for-reviewers); the
table below is rendered from coupling.yaml.

<!-- BEGIN GENERATED coupling-summary -->

<!-- Generated from coupling.yaml by `bun scripts/coupling.mjs render`. Do not edit. -->

| measure | value |
| --- | --- |
| upstream pin | `b9ddc83`, path `pstack` |
| skills reached | 13 of 45, [see PORTABILITY.md](PORTABILITY.md#skills-the-port-reached) |
| skills with work left | 0 of 45 |
| occurrences | 92 resolved, 0 unresolved, 0 missing, 2 not checked |
| token hits | 0 attributed to a domain, 0 unattributed Cursor mentions |
| verification | 40 of 120 cells verified, 53 attestations, 10 scenarios defined |

`bun scripts/coupling.mjs check` is the gate. The work left, the per-harness
resolutions, and the evidence state are in [PORTABILITY.md](PORTABILITY.md).

<!-- END GENERATED coupling-summary -->

## Maintenance

Use the repository's [update-pstack-anywhere skill](.agents/skills/update-pstack-anywhere/SKILL.md)
for upstream updates. The [refresh procedure](UPSTREAM.md#refresh) owns the
steps and recovery rules. `bun run validate` runs the maintenance checks.

## Credit

MIT, same as upstream. All skill content is Lauren Tan's work unless a file says
otherwise.
