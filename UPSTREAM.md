# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Author: Lauren Tan (@poteto) · MIT
Pinned SHA: b42effe0aa50f59c693d7e2924714e015e00bf7c (2026-09-23)
Upstream version: pstack 0.15.3

## Refresh

The port keeps ordinary Git merge ancestry. Each import is an unmodified
snapshot of Cursor's `pstack/` directory mapped to this repository's root,
parented to this branch's previously accepted import. Its commit message records
the original Cursor SHA. Port corrections live directly in `skills/` and merge
against that shared base. This preserves upstream deletions and local changes
without maintaining a second patch stack.

The accepted baseline comes from the current branch's ancestry and must agree
with `coupling.yaml`. The old `upstream/pstack` branch is no longer read or
updated. It may remain in older clones as a historical reference. Imports are
retained through `MERGE_HEAD` while reviewing and through the final merge commit
after acceptance. An aborted attempt cannot control another branch's update.

### Prepare

1. Record the current port commit and working-tree status. Preserve pending work
   in a reviewed commit when authorized. If the tree is already clean, its HEAD
   is the checkpoint. Use a development branch for the update.
2. Run `bun run validate` to establish the baseline. A pre-existing failure must
   be explained or fixed before it can be distinguished from a regression.
3. Select one full Cursor commit SHA that descends from the accepted pin. When
   asked for the latest pstack, resolve upstream's default branch, then identify
   its newest commit affecting `pstack/`. Record its version from
   `pstack/.cursor-plugin/plugin.json`. Keep that SHA fixed for the entire update.
   Review the commit log and full path inventory between the pins.

On a checkout without recorded import ancestry, run `bun run upstream init`
before validation. Initialization records the current pin as already ported and
preserves the HEAD tree, index, and working files. This is a one-time assertion
about the existing port, not a way to accept a new pin. On established histories
it validates the accepted pin and does nothing else. A fresh full clone contains
the required ancestry. A shallow clone must recover that history first.

### Import and review

```sh
bun run upstream merge <full-cursor-commit-sha>
git status --short
git diff --cached
```

The importer requires a clean worktree, rejects ignored-file collisions, and
stops before committing. It accepts only descendants of this branch's accepted
pin. The upstream source can be fetched by SHA without changing another branch.
Commands accept `--source <complete-clone-or-url>` for a different fetch source.
Use the public upstream repository if a partial clone cannot serve its objects.

Review every changed upstream path, including paths Git merged cleanly. Record
accepted changes, portability adaptations, and omitted paths in
`maintenance/updates/<date>-<version>.md`. The report must account for the full
upstream diff, not just conflicts. In particular:

- Preserve the omitted Cursor packaging, automations, guide, and duplicate root
  scripts listed below. New files in an omitted directory can reappear during a
  merge. Reconcile the upstream README with this port's README.
- Reconcile changes and new files under `skills/setup-pstack` into the renamed
  `skills/setup-pstack-anywhere`. Keep upstream-compatible skill and mode names.
- Accept upstream improvements and remove local corrections that they replace.
  Record any retained divergence here before changing the skill content.
- Review new instructions for unsupported capabilities. Extend `coupling.yaml`
  and its conformance scenarios where needed. Known-token lint does not detect
  every new dependency, semantic change, or broken prose reference.
- Account for new and deleted skills in installation inventories and every
  sibling reference. An explicit manager allowlist will not discover additions
  automatically. Remove obsolete owned definitions without deleting unrelated
  user definitions or intentional overrides.
- Keep orchestration scripts byte-identical to the selected upstream source.
  Review runtime changes before executing them. Recovery guidance and install
  diagnostics belong to setup-pstack-anywhere.

### Record and validate

Update `coupling.yaml`'s upstream SHA and this document's pin and upstream
version. Increment the port's own plugin version for a published update and keep
its marketplace version aligned. The port version is independent of Cursor's.
Generate the orchestration manifest from the selected source, never from locally
edited runtime files:

```sh
manifest_tmp=$(mktemp)
bun run upstream hashes <full-cursor-commit-sha> > "$manifest_tmp" && mv "$manifest_tmp" conformance/upstream-orch.json
bun run render
bun run validate
```

`validate` runs strict portability lint, all repository tests, source-backed
import verification, and Git whitespace checks. Source verification checks that
the pin matches the active or accepted import and that the orchestration file
inventory and bytes match upstream, even if someone changed the local manifest.
The import tests exercise conflicts, abort/retry, branch isolation, dirty and
ignored files, fresh clones, incorrect pins, and edited runtime hashes.

Review generated changes and the evidence state. Saved observations describe
their recorded versions and scenarios. A successful static check does not prove
changed workflows run correctly on every agent. Exercise affected behavior where
the current environment permits it and label the remaining behavior unverified.

Review the staged result, including the pins, then commit the merge. Run
`bun run upstream verify` once more on the committed state and record the port
commit and results in the handoff. The final working tree should be clean.

### Publish and install

Publishing and installation are separate actions. When authorized, push the
reviewed port commit and verify it is available from the distribution remote.
Then advance the existing skill manager's pin to that port commit, refresh its
vendor and projection, review overrides against the new definitions, and run the
installed `setup-pstack-anywhere/scripts/doctor.mjs`. Check added and removed
skills as well as the version pin. Use a fresh agent session to confirm discovery.
The manager owns these commands and inventories. This repository does not add a
competing installer or manager-specific configuration.

### Recovery

During a merge, inspect `git status`, `MERGE_HEAD`, and the report. Resume the
same review or use `git merge --abort` to restore the pre-merge tracked state.
Preserve any work created since the merge before aborting. Retrying the same SHA
recreates the same import, and selecting another descendant starts from the
accepted baseline. A source rewind or changed upstream directory requires an
explicit migration plan rather than bypassing the ancestry check.

For an installed regression, restore the previous manager pin and refresh its
projection. Preserve the failed release and report for diagnosis. Reverting a
published merge requires a separate review of its ancestry and recorded pin.
An ordinary `git revert -m 1` leaves the import in ancestry and cannot be treated
as a fresh baseline for the next update.

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
- path_assumption: `pack_path`, `trunk_reread`, `mcp_discovery`, `transcript_dir`
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
