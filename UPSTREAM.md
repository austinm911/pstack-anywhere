# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Author: Lauren Tan (@poteto) · MIT
Pinned SHA: b9ddc83c32972210b8a94d389130713e8eed346e (2026-08-31)
Upstream version: pstack 0.14.5

## Refresh

The `upstream/pstack` branch contains unmodified snapshots of Cursor's `pstack/`
directory mapped to this repository's root. Each selected revision adds a commit
parented to the previous import, with the original Cursor SHA recorded in its
message. This imports release snapshots, not every commit in the plugins repo.
Port corrections live directly in `skills/` and merge against that shared base.

Connect the current pin once:

```sh
bun run upstream init
```

Initialization adds a baseline merge commit with exactly the previous HEAD tree.
It records that the pinned snapshot has already been ported, without modifying
the index or working files. Existing staged and unstaged changes remain pending.
It does not rewrite published history. On a fresh clone, the same command
recovers the import branch from ancestry already included in the port branch.

For an update, commit the current work on a development branch, select an
explicit full Cursor commit SHA, and run:

```sh
bun run upstream merge <full-cursor-commit-sha>
git diff --cached
```

Both commands accept `--source <existing-clone-or-url>` to fetch from a different
source. The default is `upstream.repo` in `coupling.yaml`. They never choose the
latest revision, push, or rewrite upstream commits. The import branch accepts
only revisions descending from its latest imported source revision.
Use a complete clone for a local source. If a partial clone cannot serve missing
objects, omit `--source` to fetch from the public upstream repository.

Update merges require a clean worktree and always stop before committing.
Resolve conflicts and review the full result, including new files in omitted
Cursor directories and changes to the renamed setup skill. A clean textual
merge does not establish behavioral compatibility. `git merge --abort` cancels
the merge; the imported snapshot remains available for retrying the same SHA
or importing a descendant. Do not edit the import branch itself.

After reviewing the merge, update `coupling.yaml`'s upstream SHA and this
document's pin and version. Keep orchestration scripts byte-identical to the
reviewed Cursor pin. Their SHA-256 hashes, derived from
`git show <pin>:pstack/skills/poteto-mode/scripts/orch/...`, are recorded in
`conformance/upstream-orch.json` and enforced by `test/upstream-orch.test.mjs`.
Update those hashes only from the reviewed upstream source, never from local
runtime edits to make a test pass.

Skill and mode names stay upstream-compatible except for the setup rename
recorded below. Portability substitutions remain in `coupling.yaml` and the
divergence table. Remove a local correction when upstream supplies its equivalent.
Recovery instructions and install diagnostics belong to setup-pstack-anywhere.
Run `bun run render`, `bun run check`, and `bun test test/`, then commit the
reviewed merge and pin changes before proposing a new port revision.
Installations then update to that reviewed port revision. Updating an installed
copy does not advance the Cursor pin or merge upstream changes into this port.

## Intentional divergence

Readiness work: the install doctor accepts a manager-owned
`setup-pstack-anywhere/install-policy.json` with version 1 and an explicit
`skipped` list of optional skill names. It rejects missing or changed required
definitions and refuses to skip a sibling dependency. A manager can preserve
existing optional skills such as `tdd` and `teach`; the pack does not rename them.
Installer subprocesses reuse
the current runtime executable so PATH version-manager shims do not change the
runtime or require trust configuration inside isolated test homes.

Managers may also supply `definitions`, mapping deliberately overlaid skill
names to SHA-256 hashes of their expected SKILL.md bodies, excluding YAML
frontmatter. A changed body fails until the manager explicitly updates its hash.
This permits reviewed overlays without treating arbitrary drift as a pass.

| Path | Change | Why |
|---|---|---|
| `skills/create-verification-skill/SKILL.md` | Keep `features/` inside the skill directory chosen in step 2 | Step 3 hardcoded a different directory. The correction lives in the skill and is preserved through upstream merges. |
| `skills/poteto-mode/playbooks/orchestrate.md`, `skills/setup-pstack-anywhere/references/recovery.md` | Project-local `.pstack/runs/<run-id>` store and reconciliation protocol | Persist briefs, gates and reports independently of the chat using the unchanged upstream store. |
| `automations/benny/` | dropped | Pure Cursor Automations + Cursor Slack actions, nothing portable |
| `.cursor-plugin/plugin.json` | dropped | Cursor packaging |
| `docs/` (upstream guide) | dropped | Mirrored prose plus 2.3MB of images, readable upstream at the pinned SHA |
| `scripts/` (repo root) | dropped | Byte-identical duplicate of `skills/poteto-mode/scripts/`; skills stay self-contained |
| `skills/setup-pstack` | renamed `setup-pstack-anywhere` | Installs skills, not a Cursor plugin |
| `skill://<name>/...` in skill text (23 refs) | `../<name>/...`, relative to the reading skill's directory | The port's own first replacement for `pstack/skills/...`; `skill_identify` showed no harness resolves it as written (omp keys the scheme by frontmatter name, the others have no scheme, claude and pi hide a `disable-model-invocation` skill from the model). A sibling path under one skill root resolves on all four. |
| `setup-pstack-anywhere` Cursor config target | `~/.cursor/rules/pstack-models.mdc` → project `.cursor/rules/pstack-models.mdc` or project `AGENTS.md` | Cursor has no file-based user scope. User rules live in Settings, and the CLI reads project `.cursor/rules`, `AGENTS.md`, and `CLAUDE.md` (cursor.com/docs/rules, /docs/cli/using). Upstream's path is a directory Cursor does not load. |

## What was Cursor-specific

Every Cursor primitive the port replaces is an axis in `coupling.yaml`. The
per-harness resolution of each axis is in
[PORTABILITY.md](PORTABILITY.md#domain-resolutions). The axes, grouped by
their `kind` value:

- capability: `spawn_worker`, `worker_durability`, `probe_worker`, `wake_on_event`, `human_question`
- parameter_set: `worker_defaults`
- role: `review_automation`, `slop_strip`, `ui_driver`, `cli_driver`, `skill_authoring`, `model_roles`
- prerequisite: `graphite`, `github_cli`, `bun`
- path_assumption: `pack_path`, `trunk_reread`, `transcript_dir`
- naming: `setup_entrypoint`
- frontmatter: `frontmatter_portable`, `frontmatter_cursor_only`

Named Cursor built-ins also referenced: `create-skill`, the built-in `babysit`
(which `poteto-mode` deliberately overrides), `deslop` from the separate
`cursor-team-kit` plugin, the `mcps/` directory for MCP discovery, and model
slugs read from the Cursor model picker into `.cursor/rules/pstack-models.mdc`.

## Decisions

**Name collisions.** The pack keeps upstream's `tdd`, `teach`, and `unslop`
under their own names. Rule 1 forbids renaming, and no skill in the pack
addresses those three as `../<name>/`, so a rename of any of them breaks
nothing here. The doctor (`skills/setup-pstack-anywhere/scripts/doctor.mjs`)
reports another definition of the same name in any known root. Which one wins,
or whether both load, is the [harness](README.md#vocabulary)'s rule. Renaming
is the user's skill manager's job, using its own override mechanism.

**Install model.** The pack ships no installer that competes with a skill
manager. The layout `skills/<name>/SKILL.md` is what every manager consumes,
so a vendoring manager, `npx skills add`, or a plugin install each take
`skills/` whole. Claude and Codex plugins share `.claude-plugin/plugin.json`,
which Codex discovers at its pin (`references/harnesses/codex/MANIFEST.md`).
The Claude marketplace is `.claude-plugin/marketplace.json` and the Codex one
is `.agents/plugins/marketplace.json`. `scripts/install.mjs` is the plain
fallback: per-skill symlinks from the one canonical `skills/` copy into
`~/.agents/skills` and `~/.claude/skills`, refusing to overwrite. The doctor is
the post-install check on every path.

**Symlinks, not copies.** `install.mjs` links each skill instead of copying
it. OMP also scans the Claude and Codex roots, so a copy per root makes it see
the same skill several times and warn on the name; symlinks collapse by
realpath and stay silent. `~/.agents/skills` is a native user-scope root for
Codex, pi, and OMP, verified in source at the pins recorded in
`references/harnesses/`, so it plus `~/.claude/skills` covers all four. Target
roots are in `harnesses.yaml`. No hooks ship: no skill depends on one.

**pi and OMP roots.** pi and OMP share through `~/.agents/skills`, not through
`~/.pi/agent/skills`. OMP does not scan any `.pi` root.

**No adapter per harness.** The skill content is the same on every harness.
The only difference between harnesses is the root path, so an adapter would
have nothing to hold.

**Generated context files.** `setup-pstack-anywhere` writes the block into the
source a context manager renders from, not into the rendered `AGENTS.md` or
`CLAUDE.md`, which the next run overwrites markers and all. Where such a
manager is in use it usually emits one native file per harness, which removes
the shadowing the skill's OMP row works around: nothing competes for the shared
file because nothing shares it. The only copy that stays justified is a format
the manager cannot cross, Cursor's `.mdc` frontmatter against plain Markdown.

**Skill identity in the doctor.** Two installs of the same skill are the same
definition when the `SKILL.md` body matches, frontmatter excluded, not when the
paths resolve alike. A vendoring manager rebuilds each skill directory as
per-file links and materializes `SKILL.md` to inject its own frontmatter, so
realpath comparison called every skill in the pack shadowed and buried the two
real collisions.
